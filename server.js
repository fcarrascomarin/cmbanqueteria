require('dotenv').config();
const express=require('express'), cors=require('cors'), session=require('express-session'), nodemailer=require('nodemailer');
const {spawn}=require('child_process'), fs=require('fs'), os=require('os'), path=require('path'), crypto=require('crypto');
const {Pool}=require('pg');
const app=express(); 
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const pool=new Pool({connectionString:process.env.DATABASE_URL, ssl:process.env.DATABASE_URL?.includes('neon.tech')?{rejectUnauthorized:false}:undefined});
app.use(cors()); app.use(express.json({limit:'15mb'})); app.use(express.urlencoded({extended:true}));
app.use(session({name:'cm_admin_sid',secret:process.env.SESSION_SECRET||'dev-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:SITE_URL.startsWith('https://'),maxAge:1000*60*60*8}}));
app.use(express.static('public',{
  etag:false,
  maxAge:0,
  setHeaders(res,filePath){if(/\.(?:html|js)$/i.test(filePath))res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate')}
}));
const schema=`

CREATE TABLE IF NOT EXISTS observations (id BIGSERIAL PRIMARY KEY, obs_date DATE NOT NULL DEFAULT CURRENT_DATE, area TEXT NOT NULL, title TEXT NOT NULL, description TEXT, priority TEXT NOT NULL DEFAULT 'media', status TEXT NOT NULL DEFAULT 'abierta', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS screen_media (id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, media_type TEXT NOT NULL DEFAULT 'video', url TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER NOT NULL DEFAULT 10, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS restaurant_orders (id BIGSERIAL PRIMARY KEY, order_date DATE NOT NULL DEFAULT CURRENT_DATE, order_time TIME, service_type TEXT NOT NULL DEFAULT 'retiro' CHECK(service_type IN ('mesa','retiro','delivery')), customer_name TEXT NOT NULL, customer_phone TEXT, party_size INTEGER, table_name TEXT, menu_summary TEXT, quantity INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'confirmado' CHECK(status IN ('confirmado','en_preparacion','listo','entregado','cancelado')), assigned_to TEXT, notes TEXT, dispatched_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS screen_messages (id BIGSERIAL PRIMARY KEY, message_date DATE NOT NULL DEFAULT CURRENT_DATE, audience TEXT NOT NULL DEFAULT 'Cocina', title TEXT NOT NULL, body TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','importante','urgente')), active BOOLEAN NOT NULL DEFAULT TRUE, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_observations_date ON observations(obs_date);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_date ON restaurant_orders(order_date,status);
CREATE INDEX IF NOT EXISTS idx_screen_messages_active ON screen_messages(active,message_date);
CREATE TABLE IF NOT EXISTS expenses (id BIGSERIAL PRIMARY KEY, expense_date DATE NOT NULL DEFAULT CURRENT_DATE, category TEXT NOT NULL, supplier TEXT, description TEXT NOT NULL, amount INTEGER NOT NULL CHECK (amount>=0), payment_method TEXT, document_url TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS inventory_items (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT, unit TEXT NOT NULL DEFAULT 'unidad', current_stock NUMERIC(12,2) NOT NULL DEFAULT 0, min_stock NUMERIC(12,2) NOT NULL DEFAULT 0, unit_cost INTEGER NOT NULL DEFAULT 0, supplier TEXT, notes TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS inventory_movements (id BIGSERIAL PRIMARY KEY, item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE, movement_date DATE NOT NULL DEFAULT CURRENT_DATE, type TEXT NOT NULL CHECK (type IN ('entrada','salida','ajuste')), quantity NUMERIC(12,2) NOT NULL, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS suppliers (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, rut TEXT, rut_normalized TEXT, phone TEXT, email TEXT, contact_name TEXT, notes TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS usual_products TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_rut_unique ON suppliers(rut_normalized) WHERE rut_normalized IS NOT NULL;
CREATE TABLE IF NOT EXISTS purchase_documents (
  id BIGSERIAL PRIMARY KEY,
  document_type TEXT NOT NULL DEFAULT 'otro' CHECK(document_type IN ('factura','boleta','comprobante_manual','comprobante_pago','conteo_stock','otro')),
  status TEXT NOT NULL DEFAULT 'requiere_revision' CHECK(status IN ('requiere_revision','confirmado','posible_duplicado')),
  supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  supplier_rut TEXT,
  document_number TEXT,
  purchase_date DATE,
  subtotal INTEGER,
  tax INTEGER,
  total INTEGER NOT NULL DEFAULT 0 CHECK(total>=0),
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pagado' CHECK(payment_status IN ('pagado','pendiente')),
  category TEXT NOT NULL DEFAULT 'Otros',
  stock_status TEXT NOT NULL DEFAULT 'pendiente' CHECK(stock_status IN ('pendiente','confirmado','no_aplica')),
  linked_document_id BIGINT REFERENCES purchase_documents(id) ON DELETE SET NULL,
  image_mime TEXT NOT NULL,
  image_data BYTEA NOT NULL,
  image_hash TEXT NOT NULL,
  extraction_confidence NUMERIC(4,3),
  extraction_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_extraction JSONB,
  notes TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_documents_image_hash ON purchase_documents(image_hash);
CREATE INDEX IF NOT EXISTS idx_purchase_documents_date ON purchase_documents(purchase_date DESC,created_at DESC);
CREATE TABLE IF NOT EXISTS purchase_document_items (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES purchase_documents(id) ON DELETE CASCADE,
  inventory_item_id BIGINT REFERENCES inventory_items(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3),
  unit TEXT,
  unit_price INTEGER,
  line_total INTEGER,
  affects_stock BOOLEAN NOT NULL DEFAULT FALSE,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS purchase_document_id BIGINT REFERENCES purchase_documents(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_purchase_document ON expenses(purchase_document_id) WHERE purchase_document_id IS NOT NULL;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS purchase_document_id BIGINT REFERENCES purchase_documents(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS kitchen_minutas (id BIGSERIAL PRIMARY KEY, minuta_date DATE NOT NULL DEFAULT CURRENT_DATE, title TEXT NOT NULL, planned_portions INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'borrador' CHECK(status IN ('borrador','confirmada')), notes TEXT, confirmed_by TEXT, confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_kitchen_minutas_date ON kitchen_minutas(minuta_date DESC,status);
CREATE TABLE IF NOT EXISTS kitchen_minuta_preparations (id BIGSERIAL PRIMARY KEY, minuta_id BIGINT NOT NULL REFERENCES kitchen_minutas(id) ON DELETE CASCADE, name TEXT NOT NULL, servings INTEGER, notes TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS kitchen_minuta_ingredients (id BIGSERIAL PRIMARY KEY, preparation_id BIGINT NOT NULL REFERENCES kitchen_minuta_preparations(id) ON DELETE CASCADE, inventory_item_id BIGINT REFERENCES inventory_items(id) ON DELETE SET NULL, ingredient_name TEXT NOT NULL, quantity NUMERIC(12,3), unit TEXT, confirmed BOOLEAN NOT NULL DEFAULT FALSE, notes TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS daily_menus (id BIGSERIAL PRIMARY KEY, menu_date DATE NOT NULL, title TEXT NOT NULL, main_dish TEXT, side_dish TEXT, salad TEXT, dessert TEXT, price INTEGER NOT NULL DEFAULT 0, planned_portions INTEGER NOT NULL DEFAULT 0, available_portions INTEGER NOT NULL DEFAULT 0, cost_per_portion INTEGER NOT NULL DEFAULT 0, notes TEXT, public_visible BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE daily_menus ADD COLUMN IF NOT EXISTS option_1 TEXT;
ALTER TABLE daily_menus ADD COLUMN IF NOT EXISTS option_2 TEXT;
ALTER TABLE daily_menus ADD COLUMN IF NOT EXISTS option_3 TEXT;
ALTER TABLE daily_menus ADD COLUMN IF NOT EXISTS accompaniment_change_price INTEGER NOT NULL DEFAULT 1200;
CREATE TABLE IF NOT EXISTS weekly_menus (id BIGSERIAL PRIMARY KEY, week_start DATE NOT NULL, week_end DATE NOT NULL, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS weekly_menu_days (id BIGSERIAL PRIMARY KEY, weekly_menu_id BIGINT NOT NULL REFERENCES weekly_menus(id) ON DELETE CASCADE, day_name TEXT NOT NULL, menu_date DATE, title TEXT, planned_portions INTEGER NOT NULL DEFAULT 0, notes TEXT);
CREATE TABLE IF NOT EXISTS rations (id BIGSERIAL PRIMARY KEY, ration_date DATE NOT NULL DEFAULT CURRENT_DATE, title TEXT NOT NULL, planned_portions INTEGER NOT NULL DEFAULT 0, estimated_total_cost INTEGER NOT NULL DEFAULT 0, estimated_cost_per_portion INTEGER NOT NULL DEFAULT 0, sale_price INTEGER NOT NULL DEFAULT 0, estimated_margin INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS event_quotes (id BIGSERIAL PRIMARY KEY, client_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, event_date DATE, event_type TEXT, guests INTEGER, location TEXT, requested_service TEXT, estimated_budget INTEGER, status TEXT NOT NULL DEFAULT 'recibida', quoted_total INTEGER NOT NULL DEFAULT 0, internal_notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS staff (id BIGSERIAL PRIMARY KEY, full_name TEXT NOT NULL, rut TEXT, role TEXT, phone TEXT, start_date DATE, contract_type TEXT, schedule TEXT, status TEXT NOT NULL DEFAULT 'activo', notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS documents (id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, document_type TEXT NOT NULL, owner_type TEXT NOT NULL DEFAULT 'empresa', staff_id BIGINT REFERENCES staff(id) ON DELETE SET NULL, document_date DATE, expiration_date DATE, file_url TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS consultation_milestones (id BIGSERIAL PRIMARY KEY, stage_key TEXT NOT NULL UNIQUE, week_number INTEGER NOT NULL, title TEXT NOT NULL, objective TEXT NOT NULL, deliverables TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','en_curso','completado','realizado','pendiente_inmediato','pendiente_posterior','bloqueado','en_revision')), sort_order INTEGER NOT NULL, notes TEXT, completed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE consultation_milestones DROP CONSTRAINT IF EXISTS consultation_milestones_sort_order_key;
ALTER TABLE consultation_milestones DROP CONSTRAINT IF EXISTS consultation_milestones_status_check;
ALTER TABLE consultation_milestones ADD CONSTRAINT consultation_milestones_status_check CHECK(status IN ('pendiente','en_curso','completado','realizado','pendiente_inmediato','pendiente_posterior','bloqueado','en_revision'));
CREATE TABLE IF NOT EXISTS consultation_documents (id BIGSERIAL PRIMARY KEY, milestone_id BIGINT NOT NULL REFERENCES consultation_milestones(id) ON DELETE CASCADE, title TEXT NOT NULL, document_type TEXT NOT NULL, file_url TEXT NOT NULL, report_date DATE NOT NULL DEFAULT CURRENT_DATE, status TEXT NOT NULL DEFAULT 'entregado' CHECK(status IN ('proyectado','en_revision','entregado','aprobado')), notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS consultation_deliverables (id BIGSERIAL PRIMARY KEY, milestone_id BIGINT NOT NULL REFERENCES consultation_milestones(id) ON DELETE CASCADE, title TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','en_preparacion','en_revision','completado','bloqueado')), document_url TEXT, document_date DATE, notes TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(milestone_id,title));
ALTER TABLE consultation_deliverables DROP CONSTRAINT IF EXISTS consultation_deliverables_status_check;
ALTER TABLE consultation_deliverables ADD CONSTRAINT consultation_deliverables_status_check CHECK(status IN ('pendiente','en_preparacion','en_revision','completado','bloqueado'));
ALTER TABLE consultation_deliverables ADD COLUMN IF NOT EXISTS responsible TEXT;
ALTER TABLE consultation_deliverables ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE consultation_deliverables ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE consultation_deliverables ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'Compartido con Claudia';
ALTER TABLE consultation_deliverables ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'Entregable';
ALTER TABLE consultation_documents ADD COLUMN IF NOT EXISTS deliverable_id BIGINT REFERENCES consultation_deliverables(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS consultation_field_records (id BIGSERIAL PRIMARY KEY, milestone_id BIGINT NOT NULL REFERENCES consultation_milestones(id) ON DELETE CASCADE, deliverable_id BIGINT REFERENCES consultation_deliverables(id) ON DELETE SET NULL, record_date DATE NOT NULL DEFAULT CURRENT_DATE, action_type TEXT NOT NULL, institution_location TEXT, participants TEXT, objective TEXT NOT NULL, facts TEXT NOT NULL, observations TEXT, agreements TEXT, responsible TEXT, due_date DATE, next_steps TEXT, evidence_url TEXT, menus_sold INTEGER, daily_sales INTEGER, average_wait_minutes INTEGER, waste_notes TEXT, staff_hours NUMERIC(8,2), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO consultation_milestones(stage_key,week_number,title,objective,deliverables,status,sort_order,notes) VALUES
('preactivacion',0,'Pre-activación y presentación inicial','Registrar los antecedentes previos al inicio formal: reunión con Claudia, observación inicial, presentación al equipo y plan preliminar.','Reunión inicial con Claudia|Jornada de observación previa|Presentación ante equipo CM|Plan preliminar presentado|Registro retrospectivo del inicio','realizado',0,'Hito previo al 16 de junio de 2026. Debe quedar como registro interno, no como semana de ejecución.'),
('activacion',1,'Activación institucional y documental','Registrar la ruta institucional, reunir documentos vigentes y dejar trazabilidad de los primeros respaldos del negocio.','Acta reunión Patentes Municipales|Recepción patente comercial vigente|Recepción resolución sanitaria vigente|Autorización de uso del inmueble|Mandato de representación o autorización de gestión|Carpeta documental base compartida','en_curso',1,'Iniciada el 18 de junio de 2026. Se mantiene abierta hasta completar autorización de uso del inmueble y carpeta base.'),
('observacion_real',2,'Observación activa de operación real','Sistematizar la participación de Metamorfosis durante el servicio completo del 19 de junio y convertir observaciones en evidencia ordenada.','Bitácora de servicio 19 de junio|Registro de afluencia y procesos|Hipótesis operativas preliminares|Evidencia fotográfica o notas de campo|Registro interno de hito realizado','realizado',2,'Hito realizado el 19 de junio de 2026; falta sistematizar evidencia y acta retrospectiva.'),
('sanitaria',3,'Preparación sanitaria y matriz de riesgos','Preparar a CM para la actualización de resolución sanitaria mediante manual, checklist, visita en terreno, croquis y matriz de riesgos sanitarios.','Manual sanitario base entregado|Checklist sanitario operativo entregado|Aplicación del checklist en terreno|Croquis operativo sanitario|Matriz de riesgos sanitarios','en_curso',3,'Proceso prioritario de julio. La matriz se entrega dentro de los cinco días siguientes a la aplicación del checklist.'),
('regularizacion',4,'Regularización web, comercial, jurídica y tributaria','Ordenar la presencia digital, el correo institucional, el flujo de cotizaciones y la revisión de figura jurídica y giro.','Maqueta web externa e interna|Dominio cmbanqueteria.cl activo|Correo contacto@cmbanqueteria.cl configurado|Flujo de cotizaciones web-correo-panel|Revisión de figura jurídica y giro','en_curso',4,'Proceso paralelo a la preparación sanitaria. Metamorfosis administra dominio, hosting y correo hasta la entrega formal.'),
('solicitud_sanitaria',5,'Solicitud sanitaria y visita inspectiva','Ingresar o preparar la solicitud sanitaria online y dejar seguimiento de SEREMI, visita inspectiva y eventuales observaciones.','Carpeta sanitaria preparada|Solicitud sanitaria online|Seguimiento SEREMI|Acta visita inspectiva|Respuesta a observaciones','pendiente_inmediato',5,'Debe activarse después de ejecutar ajustes de julio, con solicitud proyectada para agosto.'),
('municipal_sii',6,'Patente municipal y ampliación de giro SII','Volver a Municipalidad y ajustar patente o giro tributario solo después de contar con mayor claridad sanitaria.','Retorno a Patentes Municipales|Carpeta municipal robusta|Solicitud de patente o adecuación|Revisión/ampliación de giro SII|Registro de resolución o respuesta','pendiente_posterior',6,'Hito posterior a la regularización sanitaria.'),
('economica',7,'Medición económica inicial','Reemplazar estimaciones por datos reales de ventas, compras, costos, mermas, servicios básicos y punto de equilibrio.','Registro de ventas|Registro de compras y costos|Ficha de costo por menú|Control de servicios básicos y mermas|Punto de equilibrio preliminar','pendiente_posterior',7,'Debe iniciarse después de estabilizar la etapa sanitaria y documental.'),
('laboral',8,'Organización laboral y funcional','Levantar funciones, jornadas, acuerdos y brechas para ordenar progresivamente al equipo sin perder flexibilidad operativa.','Fichas laborales individuales|Matriz de roles|Brechas laborales priorizadas|Alternativas de formalización|Distribución de funciones','pendiente_posterior',8,'Etapa posterior al levantamiento sanitario/económico inicial.'),
('operativa',9,'Orden operativo y experiencia cliente','Ordenar flujos, señalética, punto de pago, menú visible y experiencia del cliente desde evidencia observada.','Diagnóstico operativo|Mejoras de flujo y señalética|Revisión de punto de pago y menú visible|Hipótesis confirmadas o descartadas|Propuesta de experiencia del cliente','pendiente_posterior',9,'Se activa cuando existan observaciones repetidas y datos suficientes.'),
('consolidacion',10,'Consolidación y plan de acción','Ordenar la evidencia, brechas e indicadores para definir un plan de acción realista de 30, 60 y 90 días.','Documento maestro de diagnóstico|Carpeta de anexos|Matriz de brechas|Indicadores iniciales|Plan de acción 30, 60 y 90 días','pendiente_posterior',10,'Cierre del proceso y base para decidir crecimiento posterior.')
ON CONFLICT(stage_key) DO UPDATE SET week_number=EXCLUDED.week_number,title=EXCLUDED.title,objective=EXCLUDED.objective,deliverables=EXCLUDED.deliverables,sort_order=EXCLUDED.sort_order,notes=EXCLUDED.notes,status=CASE WHEN consultation_milestones.status IN ('pendiente','en_curso') THEN EXCLUDED.status ELSE consultation_milestones.status END;
INSERT INTO consultation_deliverables(milestone_id,title,sort_order)
SELECT m.id,TRIM(item.title),item.ord::int FROM consultation_milestones m CROSS JOIN LATERAL unnest(string_to_array(m.deliverables,'|')) WITH ORDINALITY AS item(title,ord)
ON CONFLICT(milestone_id,title) DO NOTHING;
UPDATE consultation_deliverables d SET sort_order=s.ord::int FROM consultation_milestones m CROSS JOIN LATERAL unnest(string_to_array(m.deliverables,'|')) WITH ORDINALITY AS s(title,ord) WHERE d.milestone_id=m.id AND d.title=TRIM(s.title);
WITH known_process_docs(stage_key,deliverable_title,title,document_type,file_url,report_date,status,notes) AS (VALUES
  ('preactivacion','Plan preliminar presentado','Plan de trabajo preliminar CM Banquetería','PDF','/docs/cm/CM-DOC-000-Plan-trabajo-preliminar.pdf','2026-06-16'::date,'entregado','Documento base del inicio formal del proceso.'),
  ('sanitaria','Manual sanitario base entregado','Manual sanitario base para actualización de resolución sanitaria','Manual','/docs/cm/CM-SAN-001-Manual-sanitario-base.pdf','2026-06-26'::date,'entregado','Documento sanitario base entregado a CM.'),
  ('sanitaria','Checklist sanitario operativo entregado','Checklist sanitario operativo por zonas','Checklist','/docs/cm/CM-SAN-002-Checklist-sanitario-operativo.pdf','2026-06-26'::date,'entregado','Instrumento para aplicación en terreno y matriz sanitaria.')
)
INSERT INTO consultation_documents(milestone_id,deliverable_id,title,document_type,file_url,report_date,status,notes)
SELECT m.id,d.id,k.title,k.document_type,k.file_url,k.report_date,k.status,k.notes
FROM known_process_docs k
JOIN consultation_milestones m ON m.stage_key=k.stage_key
LEFT JOIN consultation_deliverables d ON d.milestone_id=m.id AND d.title=k.deliverable_title
WHERE NOT EXISTS (SELECT 1 FROM consultation_documents cd WHERE cd.file_url=k.file_url);
DELETE FROM consultation_deliverables d USING consultation_milestones m WHERE d.milestone_id=m.id AND d.status='pendiente' AND d.document_url IS NULL AND d.notes IS NULL AND NOT EXISTS (SELECT 1 FROM unnest(string_to_array(m.deliverables,'|')) AS x(title) WHERE TRIM(x.title)=d.title);`;
function auth(req,res,next){ if(req.session?.admin) return next(); res.status(401).json({error:'No autorizado.'}); }
function int(v){v=Number(v||0); return Number.isFinite(v)?Math.max(0,Math.round(v)):0} function num(v){v=Number(v||0); return Number.isFinite(v)?v:0}
function normalizeRut(v){const clean=String(v||'').toUpperCase().replace(/[^0-9K]/g,'');return clean||null}
function normalizeProductKey(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?v:null}
function nullableInt(v){return v===null||v===undefined||v===''?null:int(v)}
function nullableNum(v){return v===null||v===undefined||v===''?null:num(v)}
const purchaseSupplierKnowledge=[
  {name:'Comercial VYR SpA / IP Medical',rut:'77.079.655-5',aliases:['IP Medical','Comercial VYR','ipmedical'],business_type:'Comercializadora de artículos al por menor / insumos médicos',category:'Limpieza',address:'O’Higgins 108, Laja',phone:'958059831',email:'ipmedicalinsumosmedicos@gmail.com',usual_products:['cubre calzado desechable 100 unidades','alcohol desnaturalizado 70 Winkler 1L','guantes nitrilo S/L','cofias médicas'],documents:[{type:'factura',number:'427',date:'2026-06-04',total:9200,products:['cubre calzado desechable 100 unidades','alcohol desnaturalizado 70 Winkler 1L']},{type:'factura',number:'433',date:'2026-06-10',products:['alcohol 70','guantes nitrilo S/L','cubre calzado','cofias médicas']}]},
  {name:'Duria Quezada Limitada',rut:'76.942.696-5',aliases:['Duria Quezada'],business_type:'Venta al por mayor de huevos, lácteos, abarrotes y otros alimentos',category:'Alimentos',address:'C. Balmaceda 408, Laja, Biobío',usual_products:['huevos','lácteos','abarrotes','otros alimentos'],documents:[{type:'boleta',number:'286527',date:'2026-06-17',total:5370,payment_method:'Efectivo',products:['producto no legible en boleta']}]},
  {name:'Rico y Suave / Rubén Darío Medina Carrasco',rut:'17.787.498-6',aliases:['Rico y Suave','Ruben Dario Medina','Rubén Darío Medina','Medina Carrasco'],business_type:'Provisiones, artículos de cumpleaños y hogar',category:'Abarrotes',address:'Balmaceda 152, Local 9, Los Ángeles / Laja',phone:'+56 9 9597 4425',usual_products:['frutas y verduras','Daily tradicional 270 ml','Nescafé Decaf 170g','pasta choclo','papas prefritas','ensalada mixta','carnes'],documents:[{type:'factura',number:'10349',date:'2026-06-17',total:12881,products:['frutas y verduras','Daily tradicional 270 ml','Nescafé Decaf 170g']},{type:'factura',number:'10341',date:'2026-06-15',total:39000,products:['pasta choclo','papas prefritas','ensalada mixta','carnes','frutas y verduras']}]},
  {name:'Sociedad Comercial Tely Sur Ltda.',rut:'77.308.370-3',aliases:['Tely Sur','Comercial Tely Sur'],business_type:'Carnicería, rotisería y minimercado',category:'Carnes',address:'O’Higgins 99, Laja',usual_products:['chuleta de centro','carnes','rotisería','minimercado'],documents:[{type:'factura',number:'11781',date:'2026-06-17',total:25236,payment_method:'Débito',products:['chuleta de centro']}]},
  {name:'Frutería La Veguita / Ernesto Sepúlveda Concha',rut:null,aliases:['La Veguita','Frutería La Veguita','Ernesto Sepúlveda','Betsy Osses'],business_type:'Frutería / verduras',category:'Verduras',address:'Av. Arturo Prat #249-B, Laja',phone:'+56 9 6204 4972 / +56 9 5798 4001',usual_products:['lentejas','zapallo','cebollas','zanahorias','morrón','tomates','orégano','pepino ensalada','cilantro','coliflor','tomate cherry'],documents:[{type:'comprobante_manual',date:'2026-06-19',total:41300,products:['lentejas','zapallo','cebollas','zanahorias','morrón','tomates','orégano','pepino ensalada','cilantros','coliflor','cherry']}]},
  {name:'Sociedad Muñoz y Parra Limitada / Dispack',rut:'76.383.866-8',aliases:['Dispack','Muñoz y Parra','Munoz y Parra'],business_type:'Distribución / alimentos e insumos alimentarios',category:'Abarrotes',address:'Sucursal Bodega L.A., Los Ángeles',contact_name:'Jorge Hermosilla',usual_products:['Milkream','puré instantáneo','maicena','jalea','sémola con leche','concentrado arándano','concentrado frambuesa','concentrado melón','chantilly','crema Chantypak','cobertura de pastelería'],documents:[{type:'factura',number:'516971',date:'2026-06-12',total:172560,payment_method:'Contra entrega',products:['Milkream','puré instantáneo','maicena','jalea','sémola con leche','concentrados arándano/frambuesa/melón','chantilly','crema Chantypak','cobertura/insumos de pastelería']}]},
  {name:'Ariztía Comercial Ltda.',rut:'83.614.800-2',aliases:['Ariztía','Ariztia','ariztiaatunegocio'],business_type:'Carnes / aves / huevos / cecinas / vegetales',category:'Carnes',address:'Casa matriz Los Carrera 444, Melipilla. Destino: Laja',phone:'600 660 0060',usual_products:['trutro entero de pollo granel','pollo','aves','huevos','cecinas','vegetales'],documents:[{type:'factura',number:'38719517',date:'2026-06-09',total:65299,payment_method:'Transferencia',products:['trutro entero de pollo granel 34,73 kg']}]},
  {name:'Supermercado por confirmar / SMU',rut:null,aliases:['Unimarc','SMU','Supermercado'],business_type:'Supermercado / abarrotes',category:'Abarrotes',address:'Por confirmar',usual_products:['aceite vegetal','limón','galletas','limpiador','mayonesa','lavaloza','postres','abarrotes'],documents:[{type:'boleta',total:64590,products:['aceite vegetal','limón','galletas','limpiador','mayonesa','lavaloza','postres/abarrotes']}]}
];
function supplierKnowledgeForPrompt(){
  return purchaseSupplierKnowledge.map(s=>`${s.name}${s.rut?` | RUT ${s.rut}`:''} | rubro: ${s.business_type} | productos frecuentes: ${s.usual_products.join(', ')} | documentos conocidos: ${s.documents.map(d=>`${d.type}${d.number?` ${d.number}`:''}${d.date?` ${d.date}`:''}${d.total?` total $${d.total}`:''}`).join('; ')}`).join('\n');
}
function matchSupplierKnowledge(extracted={}){
  const rut=normalizeRut(extracted.supplier_rut),name=normalizeProductKey(extracted.supplier_name),doc=String(extracted.document_number||'').replace(/\D/g,''),total=int(extracted.total),itemsText=normalizeProductKey((extracted.items||[]).map(i=>i.description).join(' '));
  let best=null,score=0,matchedDoc=null;
  for(const supplier of purchaseSupplierKnowledge){
    let current=0,docMatch=null;
    if(rut&&supplier.rut&&rut===normalizeRut(supplier.rut))current+=8;
    const names=[supplier.name,...(supplier.aliases||[])].map(normalizeProductKey).filter(Boolean);
    if(name&&names.some(alias=>alias&&(name.includes(alias)||alias.includes(name))))current+=4;
    for(const knownDoc of supplier.documents||[]){
      const knownNumber=String(knownDoc.number||'').replace(/\D/g,'');
      if(doc&&knownNumber&&doc===knownNumber){current+=5;docMatch=knownDoc}
      if(total&&knownDoc.total&&Math.abs(total-knownDoc.total)<=5){current+=2;if(!docMatch)docMatch=knownDoc}
    }
    if(itemsText){
      const hits=(supplier.usual_products||[]).filter(product=>{const key=normalizeProductKey(product);return key.length>3&&itemsText.includes(key.split(' ')[0])}).length;
      current+=Math.min(3,hits);
    }
    if(current>score){best=supplier;score=current;matchedDoc=docMatch}
  }
  return score>=4?{supplier:best,score,document:matchedDoc}:null;
}
function applySupplierKnowledge(extracted={}){
  const match=matchSupplierKnowledge(extracted);
  if(!match)return extracted;
  const supplier=match.supplier,doc=match.document,warnings=[...(extracted.warnings||[])];
  warnings.push(`Base previa: posible coincidencia con ${supplier.name}. Revisa y confirma antes de guardar.`);
  const items=[...(extracted.items||[])];
  if((!items.length||items.every(i=>!String(i.description||'').trim()))&&doc?.products?.length){
    doc.products.filter(p=>!/^producto no legible/i.test(p)).forEach(product=>items.push({description:product,quantity:null,unit:null,unit_price:null,line_total:null,affects_stock:true,confidence:.55}));
    warnings.push('Se agregaron productos sugeridos desde documentos previos; confirma cantidades, unidades y stock manualmente.');
  }
  return {...extracted,supplier_name:extracted.supplier_name||supplier.name,supplier_rut:extracted.supplier_rut||supplier.rut,category:extracted.category&&extracted.category!=='Otros'?extracted.category:supplier.category,document_type:extracted.document_type==='otro'&&doc?.type?doc.type:extracted.document_type,purchase_date:extracted.purchase_date||doc?.date||null,total:extracted.total||doc?.total||0,payment_method:extracted.payment_method||doc?.payment_method||null,warnings,items};
}
async function seedKnownSuppliers(db=pool){
  for(const s of purchaseSupplierKnowledge){
    const notes=[s.address?`Dirección: ${s.address}`:null,(s.documents||[]).length?`Documentos detectados: ${s.documents.map(d=>`${d.type}${d.number?` ${d.number}`:''}${d.date?` ${d.date}`:''}${d.total?` total $${d.total}`:''}`).join('; ')}`:null,'Base inicial para compras por imagen; confirmar datos antes de contabilizar.'].filter(Boolean).join('\n');
    if(s.rut){
      await db.query(`INSERT INTO suppliers(name,rut,rut_normalized,business_type,usual_products,phone,email,contact_name,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(rut_normalized) WHERE rut_normalized IS NOT NULL DO UPDATE SET name=EXCLUDED.name,business_type=COALESCE(suppliers.business_type,EXCLUDED.business_type),usual_products=COALESCE(suppliers.usual_products,EXCLUDED.usual_products),phone=COALESCE(suppliers.phone,EXCLUDED.phone),email=COALESCE(suppliers.email,EXCLUDED.email),contact_name=COALESCE(suppliers.contact_name,EXCLUDED.contact_name),notes=CASE WHEN suppliers.notes IS NULL OR suppliers.notes='' THEN EXCLUDED.notes ELSE suppliers.notes END,updated_at=NOW()`,[s.name,s.rut,normalizeRut(s.rut),s.business_type,s.usual_products.join(', '),s.phone||null,s.email||null,s.contact_name||null,notes]);
    }else{
      await db.query(`INSERT INTO suppliers(name,rut,rut_normalized,business_type,usual_products,phone,email,contact_name,notes) SELECT $1,NULL,NULL,$2,$3,$4,$5,$6,$7 WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE LOWER(name)=LOWER($1))`,[s.name,s.business_type,s.usual_products.join(', '),s.phone||null,s.email||null,s.contact_name||null,notes]);
    }
  }
}

async function seedInitialStaff(db=pool){
  const staffBase=[
    ['Claudia Mendez','Administradora'],
    ['Silvia','Maestra de cocina'],
    ['Jenny','Ayudante de cocina'],
    ['Marlen','Aseo comedor y apoyo en cocina'],
    ['Sofia','Mesera part-time']
  ];
  for(const [fullName,role] of staffBase){
    await db.query(`INSERT INTO staff(full_name,role,status,notes)
      SELECT $1,$2,'activo','Registro inicial de equipo CM cargado desde levantamiento Metamorfosis. Completar RUT, teléfono, jornada, contrato y documentación asociada.'
      WHERE NOT EXISTS (SELECT 1 FROM staff WHERE LOWER(full_name)=LOWER($1) AND LOWER(COALESCE(role,''))=LOWER($2))`,[fullName,role]);
  }
}
function parseImageData(value){
  const match=String(value||'').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!match)throw Error('Selecciona una imagen JPG, PNG o WebP válida.');
  const buffer=Buffer.from(match[2],'base64');
  if(!buffer.length||buffer.length>8*1024*1024)throw Error('La imagen debe pesar menos de 8 MB.');
  return {mime:match[1],buffer,dataUrl:value,hash:crypto.createHash('sha256').update(buffer).digest('hex')};
}
const purchaseExtractionSchema={
  type:'object',additionalProperties:false,
  properties:{
    document_type:{type:'string',enum:['factura','boleta','comprobante_manual','comprobante_pago','conteo_stock','otro']},
    supplier_name:{type:['string','null']},supplier_rut:{type:['string','null']},document_number:{type:['string','null']},purchase_date:{type:['string','null']},
    subtotal:{type:['integer','null']},tax:{type:['integer','null']},total:{type:'integer'},payment_method:{type:['string','null']},
    category:{type:'string',enum:['Alimentos','Verduras','Carnes','Abarrotes','Bebidas','Gas','Luz / agua','Envases','Limpieza','Sueldos / anticipos','Movilización','Mantención','Otros']},
    confidence:{type:'number'},warnings:{type:'array',items:{type:'string'}},
    items:{type:'array',items:{type:'object',additionalProperties:false,properties:{description:{type:'string'},quantity:{type:['number','null']},unit:{type:['string','null']},unit_price:{type:['integer','null']},line_total:{type:['integer','null']},affects_stock:{type:'boolean'},confidence:{type:'number'}},required:['description','quantity','unit','unit_price','line_total','affects_stock','confidence']}}
  },
  required:['document_type','supplier_name','supplier_rut','document_number','purchase_date','subtotal','tax','total','payment_method','category','confidence','warnings','items']
};
async function extractPurchaseDocument(dataUrl){
  if(!process.env.OPENAI_API_KEY)return {document_type:'otro',supplier_name:null,supplier_rut:null,document_number:null,purchase_date:null,subtotal:null,tax:null,total:0,payment_method:null,category:'Otros',confidence:0,warnings:['Análisis automático no configurado. Completa los datos manualmente.'],items:[]};
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({
    model:process.env.OPENAI_VISION_MODEL||'gpt-5.5',store:false,reasoning:{effort:'low'},
    instructions:'Extrae datos de comprobantes de compra chilenos o listas de conteo de stock para revisión humana. No inventes datos. Usa null cuando una cantidad, unidad, precio, fecha, folio o RUT no sea legible. Los montos son pesos chilenos enteros. En comprobantes manuscritos no asumas cantidades ausentes. Usa conteo_stock solo si la imagen registra existencias contadas, no una compra. affects_stock solo puede ser true para productos físicos identificados; aun así, quantity debe quedar null si no aparece. Agrega advertencias por sombras, pliegues, texto cortado, totales inconsistentes o falta de detalle. Usa la base de proveedores solo para reconocer similitudes y completar nombres/RUT cuando haya evidencia visual compatible; si un producto viene solo desde la base previa y no desde la imagen, deja cantidad, unidad y precios en null y advierte que requiere confirmación.',
    input:[{role:'user',content:[{type:'input_text',text:`Analiza este documento de compra y devuelve únicamente los datos verificables. Base local de proveedores conocidos para comparar similitudes:\n${supplierKnowledgeForPrompt()}`},{type:'input_image',image_url:dataUrl,detail:'high'}]}],
    text:{format:{type:'json_schema',name:'purchase_document',strict:true,schema:purchaseExtractionSchema}}
  })});
  const payload=await response.json();
  if(!response.ok)throw Error(payload.error?.message||'El servicio de análisis no pudo procesar la imagen.');
  const outputText=payload.output_text||payload.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
  if(!outputText)throw Error('El análisis no entregó datos utilizables.');
  return applySupplierKnowledge(JSON.parse(outputText));
}
async function supplierHintsForExtraction(db,extracted){
  const rut=normalizeRut(extracted?.supplier_rut);
  let supplier=null;
  if(rut){
    const r=await db.query('SELECT * FROM suppliers WHERE rut_normalized=$1 LIMIT 1',[rut]);
    supplier=r.rows[0]||null;
  }
  if(!supplier&&extracted?.supplier_name){
    const r=await db.query('SELECT * FROM suppliers WHERE LOWER(name)=LOWER($1) LIMIT 1',[String(extracted.supplier_name).trim()]);
    supplier=r.rows[0]||null;
  }
  if(!supplier)return {supplier:null,products:new Map()};
  const rows=await db.query(`SELECT i.description,i.inventory_item_id,inv.name inventory_name,inv.unit,COUNT(*)::int uses FROM purchase_document_items i JOIN purchase_documents d ON d.id=i.document_id LEFT JOIN inventory_items inv ON inv.id=i.inventory_item_id WHERE d.supplier_id=$1 AND d.status='confirmado' AND i.inventory_item_id IS NOT NULL GROUP BY i.description,i.inventory_item_id,inv.name,inv.unit ORDER BY uses DESC`,[supplier.id]);
  const products=new Map();
  for(const row of rows.rows){
    const key=normalizeProductKey(row.description);
    if(key&&!products.has(key))products.set(key,row);
  }
  return {supplier,products};
}
function suggestedInventoryForItem(item,hints){
  const key=normalizeProductKey(item?.description);
  if(!key||!hints?.products?.size)return null;
  if(hints.products.has(key))return hints.products.get(key).inventory_item_id;
  for(const [known,row] of hints.products.entries()){
    if((known.length>3&&key.includes(known))||(key.length>3&&known.includes(key)))return row.inventory_item_id;
  }
  return null;
}
function mailer(){ if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS) return null; return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||465),secure:String(process.env.SMTP_SECURE||'true')==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}); }
function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
app.get('/health',(req,res)=>res.json({ok:true}));
app.get('/api/public/menu/today',async(req,res)=>{try{const r=await pool.query(`SELECT * FROM daily_menus WHERE menu_date=CURRENT_DATE AND public_visible=TRUE ORDER BY id DESC LIMIT 1`);res.json({menu:r.rows[0]||null})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar el menú.'})}});

app.get('/api/public/screen',async(req,res)=>{try{const [menu,media,orders,messages]=await Promise.all([pool.query(`SELECT * FROM daily_menus WHERE menu_date=CURRENT_DATE AND public_visible=TRUE ORDER BY id DESC LIMIT 1`),pool.query(`SELECT * FROM screen_media WHERE active=TRUE ORDER BY sort_order ASC,id DESC`),pool.query(`SELECT * FROM restaurant_orders WHERE order_date=CURRENT_DATE AND status<>'cancelado' ORDER BY COALESCE(order_time,'23:59'::time),id LIMIT 80`),pool.query(`SELECT * FROM screen_messages WHERE active=TRUE AND message_date<=CURRENT_DATE AND (expires_at IS NULL OR expires_at>NOW()) ORDER BY CASE priority WHEN 'urgente' THEN 1 WHEN 'importante' THEN 2 ELSE 3 END,created_at DESC LIMIT 8`)]);res.json({menu:menu.rows[0]||null,media:media.rows,orders:orders.rows,messages:messages.rows,serverTime:new Date().toISOString()})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar pantalla.'})}});
app.get('/api/public/promo-video',async(req,res)=>{try{const r=await pool.query(`SELECT url,title FROM screen_media WHERE active=TRUE AND media_type='video' ORDER BY sort_order ASC,id DESC LIMIT 1`);res.json({video:r.rows[0]||null})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar el video.'})}});

app.post('/api/public/quotes',async(req,res)=>{
  const b=req.body;
  const clientName=b.clientName||b.client_name;
  const eventDate=b.eventDate||b.event_date;
  const eventType=b.eventType||b.event_type;
  const requestedService=b.requestedService||b.requested_service;
  const estimatedBudget=b.estimatedBudget||b.estimated_budget;
  const internalNotes=b.internalNotes||b.internal_notes;

  if(!clientName||!b.phone)return res.status(400).json({error:'Nombre y teléfono son obligatorios.'});
  try{
    const r=await pool.query(
      `INSERT INTO event_quotes(client_name,phone,email,event_date,event_type,guests,location,requested_service,estimated_budget,internal_notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [clientName,b.phone,b.email||null,eventDate||null,eventType||null,b.guests?Number(b.guests):null,b.location||null,requestedService||null,int(estimatedBudget),internalNotes||null]
    );
    const m=mailer();
    if(m){
      await m.sendMail({
        from:process.env.MAIL_FROM||`"CM Banquetería" <${process.env.SMTP_USER}>`,
        to:process.env.MAIL_TO||'contacto@cmbanqueteria.cl',
        replyTo:b.email||undefined,
        subject:`Nueva cotización web - ${clientName}`,
        text:`Nueva cotización\nNombre: ${clientName}\nTeléfono: ${b.phone}\nCorreo: ${b.email||'No informado'}\nFecha: ${eventDate||'No informada'}\nTipo: ${eventType||''}\nPersonas: ${b.guests||''}\nLugar: ${b.location||''}\nServicio: ${requestedService||''}\nComentarios: ${internalNotes||''}`,
        html:`<h2>Nueva cotización</h2><p><b>Nombre:</b> ${esc(clientName)}</p><p><b>Teléfono:</b> ${esc(b.phone)}</p><p><b>Correo:</b> ${esc(b.email||'')}</p><p><b>Fecha:</b> ${esc(eventDate||'')}</p><p><b>Tipo:</b> ${esc(eventType||'')}</p><p><b>Personas:</b> ${esc(b.guests||'')}</p><p><b>Lugar:</b> ${esc(b.location||'')}</p><p><b>Servicio:</b> ${esc(requestedService||'')}</p><p>${esc(internalNotes||'')}</p>`
      });
    }
    res.status(201).json({ok:true,quote:r.rows[0]});
  }catch(e){
    console.error(e);
    res.status(500).json({error:'No se pudo enviar la cotización.'});
  }
});
app.post('/api/admin/login',(req,res)=>{const {user,password}=req.body; if(user===(process.env.ADMIN_USER||'admin@cmbanqueteria.cl')&&password===(process.env.ADMIN_PASS||'admin')){req.session.admin={user}; return res.json({ok:true,user})} res.status(401).json({error:'Usuario o contraseña incorrectos.'})});
app.post('/api/admin/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true}))); app.get('/api/admin/me',auth,(req,res)=>res.json({user:req.session.admin.user}));
app.post('/api/admin/daily_menus/publish',auth,async(req,res)=>{
  const b=req.body;
  if(!b.menu_date||!b.option_1||!b.option_2||!b.option_3)return res.status(400).json({error:'Completa la fecha y las tres opciones.'});
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    await c.query('UPDATE daily_menus SET public_visible=FALSE,updated_at=NOW() WHERE menu_date=$1',[b.menu_date]);
    const r=await c.query(`INSERT INTO daily_menus(menu_date,title,main_dish,side_dish,salad,dessert,option_1,option_2,option_3,accompaniment_change_price,public_visible)
      VALUES($1,'Menú del día',$2,$3,$4,'Sopa o ensalada y postre incluidos',$2,$3,$4,$5,TRUE) RETURNING *`,
      [b.menu_date,b.option_1.trim(),b.option_2.trim(),b.option_3.trim(),int(b.accompaniment_change_price)]);
    await c.query('COMMIT');
    res.status(201).json({item:r.rows[0]});
  }catch(e){
    await c.query('ROLLBACK'); console.error(e); res.status(500).json({error:'No se pudo guardar y publicar el menú.'});
  }finally{c.release()}
});
app.post('/api/admin/daily_menus/video',auth,async(req,res)=>{
  const match=String(req.body.image||'').match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if(!match)return res.status(400).json({error:'La imagen del menú no es válida.'});
  let ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
  try{ffmpeg=require('ffmpeg-static')||ffmpeg}catch{}
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cm-menu-')), input=path.join(dir,match[1]==='jpeg'?'menu.jpg':'menu.png'), output=path.join(dir,'menu.mp4');
  try{
    fs.writeFileSync(input,Buffer.from(match[2],'base64'));
    await new Promise((resolve,reject)=>{
      const proc=spawn(ffmpeg,['-y','-loop','1','-i',input,'-t','30','-r','30','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p','-movflags','+faststart','-vf','scale=1920:1080',output]);
      let details=''; proc.stderr.on('data',d=>details+=d); proc.on('error',reject); proc.on('close',code=>code===0?resolve():reject(Error(details||`FFmpeg terminó con código ${code}`)));
    });
    res.download(output,`menu-pantalla-${req.body.menu_date||'cm'}.mp4`,()=>fs.rmSync(dir,{recursive:true,force:true}));
  }catch(e){
    console.error(e); fs.rmSync(dir,{recursive:true,force:true}); res.status(500).json({error:'No se pudo generar el video. Verifica que FFmpeg esté disponible.'});
  }
});
app.get('/api/admin/dashboard',auth,async(req,res)=>{try{const [today,w,m,stock,quotes,docs,obs,media]=await Promise.all([pool.query(`SELECT * FROM daily_menus WHERE menu_date=CURRENT_DATE ORDER BY id DESC LIMIT 1`),pool.query(`SELECT COALESCE(SUM(amount),0)::int total FROM expenses WHERE expense_date>=CURRENT_DATE-INTERVAL '7 days'`),pool.query(`SELECT COALESCE(SUM(amount),0)::int total FROM expenses WHERE date_trunc('month',expense_date)=date_trunc('month',CURRENT_DATE)`),pool.query(`SELECT * FROM inventory_items WHERE active=TRUE AND current_stock<=min_stock ORDER BY name LIMIT 10`),pool.query(`SELECT COUNT(*)::int count FROM event_quotes WHERE status IN ('recibida','en_revision','cotizada')`),pool.query(`SELECT * FROM documents WHERE expiration_date IS NOT NULL AND expiration_date<=CURRENT_DATE+INTERVAL '30 days' ORDER BY expiration_date LIMIT 10`),pool.query(`SELECT COUNT(*)::int count FROM observations WHERE status <> 'cerrada'`),pool.query(`SELECT COUNT(*)::int count FROM screen_media WHERE active=TRUE`)]);res.json({todayMenu:today.rows[0]||null,weekExpenses:w.rows[0].total,monthExpenses:m.rows[0].total,criticalStock:stock.rows,pendingQuotes:quotes.rows[0].count,expiringDocuments:docs.rows,openObservations:obs.rows[0].count,activeMedia:media.rows[0].count})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar panel.'})}});
function crud(table,fields,required=[]){app.get(`/api/admin/${table}`,auth,async(req,res)=>{try{let order='id DESC'; if(table==='expenses')order='expense_date DESC,id DESC'; if(table==='daily_menus')order='menu_date DESC,id DESC'; if(table==='documents')order='expiration_date NULLS LAST,id DESC'; if(table==='restaurant_orders')order='order_date DESC,order_time NULLS LAST,id DESC'; if(table==='screen_messages')order='message_date DESC,id DESC'; const r=await pool.query(`SELECT * FROM ${table} ORDER BY ${order} LIMIT 300`);res.json({items:r.rows})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar.'})}});app.post(`/api/admin/${table}`,auth,async(req,res)=>{try{for(const f of required)if(!req.body[f])return res.status(400).json({error:`Falta ${f}.`});const fs=fields.filter(f=>req.body[f]!==undefined), vals=fs.map(f=>req.body[f]===''?null:req.body[f]), ph=fs.map((_,i)=>`$${i+1}`);const r=await pool.query(`INSERT INTO ${table}(${fs.join(',')}) VALUES(${ph.join(',')}) RETURNING *`,vals);res.status(201).json({item:r.rows[0]})}catch(e){console.error(e);res.status(500).json({error:'No se pudo guardar.'})}});app.patch(`/api/admin/${table}/:id`,auth,async(req,res)=>{try{const fs=fields.filter(f=>req.body[f]!==undefined); if(!fs.length)return res.status(400).json({error:'Sin campos para actualizar.'}); const vals=fs.map(f=>req.body[f]===''?null:req.body[f]); vals.push(req.params.id); const touch=['inventory_items','daily_menus','event_quotes','restaurant_orders'].includes(table)?', updated_at=NOW()':'';const r=await pool.query(`UPDATE ${table} SET ${fs.map((f,i)=>`${f}=$${i+1}`).join(',')} ${touch} WHERE id=$${vals.length} RETURNING *`,vals);res.json({item:r.rows[0]})}catch(e){console.error(e);res.status(500).json({error:'No se pudo actualizar.'})}});app.delete(`/api/admin/${table}/:id`,auth,async(req,res)=>{try{await pool.query(`DELETE FROM ${table} WHERE id=$1`,[req.params.id]);res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:'No se pudo eliminar.'})}})}
crud('observations',['obs_date','area','title','description','priority','status'],['area','title']); crud('screen_media',['title','media_type','url','active','sort_order','duration_seconds','notes'],['title','url']); crud('restaurant_orders',['order_date','order_time','service_type','customer_name','customer_phone','party_size','table_name','menu_summary','quantity','status','assigned_to','notes','dispatched_at'],['customer_name','service_type']); crud('screen_messages',['message_date','audience','title','body','priority','active','expires_at'],['title','body']); crud('expenses',['expense_date','category','supplier','description','amount','payment_method','document_url','notes'],['category','description','amount']); crud('inventory_items',['name','category','unit','current_stock','min_stock','unit_cost','supplier','notes','active'],['name']); crud('daily_menus',['menu_date','title','main_dish','side_dish','salad','dessert','price','planned_portions','available_portions','cost_per_portion','notes','public_visible','option_1','option_2','option_3','accompaniment_change_price'],['menu_date','title']); crud('event_quotes',['client_name','phone','email','event_date','event_type','guests','location','requested_service','estimated_budget','status','quoted_total','internal_notes'],['client_name','phone']); crud('staff',['full_name','rut','role','phone','start_date','contract_type','schedule','status','notes'],['full_name']); crud('documents',['title','document_type','owner_type','staff_id','document_date','expiration_date','file_url','notes'],['title','document_type']);
app.post('/api/admin/inventory_items/:id/movement',auth,async(req,res)=>{const c=await pool.connect();try{const {type,quantity,reason}=req.body, q=num(quantity); if(!['entrada','salida','ajuste'].includes(type))return res.status(400).json({error:'Tipo inválido.'}); await c.query('BEGIN'); const it=await c.query('SELECT * FROM inventory_items WHERE id=$1 FOR UPDATE',[req.params.id]); if(!it.rowCount)throw Error('Producto no encontrado.'); let ns=Number(it.rows[0].current_stock); if(type==='entrada')ns+=q; if(type==='salida')ns-=q; if(type==='ajuste')ns=q; await c.query('UPDATE inventory_items SET current_stock=$1,updated_at=NOW() WHERE id=$2',[ns,req.params.id]); await c.query('INSERT INTO inventory_movements(item_id,type,quantity,reason) VALUES($1,$2,$3,$4)',[req.params.id,type,q,reason||null]); await c.query('COMMIT'); res.json({ok:true,current_stock:ns})}catch(e){await c.query('ROLLBACK'); console.error(e);res.status(500).json({error:e.message||'No se pudo registrar movimiento.'})}finally{c.release()}});
app.get('/api/admin/inventory_movements',auth,async(req,res)=>{const r=await pool.query(`SELECT m.*,i.name item_name,i.unit FROM inventory_movements m JOIN inventory_items i ON i.id=m.item_id ORDER BY m.created_at DESC LIMIT 200`);res.json({items:r.rows})});
app.get('/api/admin/suppliers',auth,async(req,res)=>{try{const r=await pool.query(`SELECT s.*,COUNT(DISTINCT p.id)::int purchase_count,COALESCE(SUM(p.total) FILTER(WHERE p.status='confirmado' AND p.document_type<>'comprobante_pago'),0)::int purchase_total,MAX(p.purchase_date) last_purchase_date FROM suppliers s LEFT JOIN purchase_documents p ON p.supplier_id=s.id GROUP BY s.id ORDER BY s.name`);res.json({items:r.rows})}catch(e){console.error(e);res.status(500).json({error:'No se pudieron cargar los proveedores.'})}});
app.post('/api/admin/suppliers',auth,async(req,res)=>{try{const b=req.body,rut=String(b.rut||'').trim()||null,name=String(b.name||'').trim();if(!name)return res.status(400).json({error:'El nombre del proveedor es obligatorio.'});const r=await pool.query(`INSERT INTO suppliers(name,rut,rut_normalized,business_type,usual_products,phone,email,contact_name,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[name,rut,normalizeRut(rut),b.business_type||null,b.usual_products||null,b.phone||null,b.email||null,b.contact_name||null,b.notes||null]);res.status(201).json({item:r.rows[0]})}catch(e){console.error(e);res.status(e.code==='23505'?409:500).json({error:e.code==='23505'?'Ya existe un proveedor con ese RUT.':'No se pudo crear el proveedor.'})}});
app.get('/api/admin/suppliers/:id',auth,async(req,res)=>{try{const [supplier,documents,products]=await Promise.all([pool.query('SELECT * FROM suppliers WHERE id=$1',[req.params.id]),pool.query(`SELECT id,document_type,document_number,purchase_date,total,payment_method,payment_status,stock_status FROM purchase_documents WHERE supplier_id=$1 AND status='confirmado' ORDER BY purchase_date DESC,id DESC LIMIT 120`,[req.params.id]),pool.query(`SELECT i.description,i.inventory_item_id,inv.name inventory_name,inv.unit,COUNT(*)::int times,COALESCE(SUM(i.quantity),0)::numeric total_quantity,COALESCE(SUM(i.line_total),0)::int total_amount FROM purchase_document_items i JOIN purchase_documents d ON d.id=i.document_id LEFT JOIN inventory_items inv ON inv.id=i.inventory_item_id WHERE d.supplier_id=$1 AND d.status='confirmado' GROUP BY i.description,i.inventory_item_id,inv.name,inv.unit ORDER BY times DESC,i.description LIMIT 120`,[req.params.id])]);if(!supplier.rowCount)return res.status(404).json({error:'Proveedor no encontrado.'});res.json({item:supplier.rows[0],documents:documents.rows,products:products.rows})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar la ficha del proveedor.'})}});
app.patch('/api/admin/suppliers/:id',auth,async(req,res)=>{try{const b=req.body,rut=String(b.rut||'').trim()||null;const r=await pool.query(`UPDATE suppliers SET name=$1,rut=$2,rut_normalized=$3,business_type=$4,usual_products=$5,phone=$6,email=$7,contact_name=$8,notes=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,[String(b.name||'').trim(),rut,normalizeRut(rut),b.business_type||null,b.usual_products||null,b.phone||null,b.email||null,b.contact_name||null,b.notes||null,req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Proveedor no encontrado.'});res.json({item:r.rows[0]})}catch(e){console.error(e);res.status(e.code==='23505'?409:500).json({error:e.code==='23505'?'Ya existe un proveedor con ese RUT.':'No se pudo actualizar el proveedor.'})}});
app.get('/api/admin/purchase-documents',auth,async(req,res)=>{try{const r=await pool.query(`SELECT p.id,p.document_type,p.status,p.supplier_name,p.supplier_rut,p.document_number,p.purchase_date,p.total,p.payment_method,p.payment_status,p.category,p.stock_status,p.extraction_confidence,p.extraction_warnings,p.linked_document_id,p.created_at,COUNT(i.id)::int item_count FROM purchase_documents p LEFT JOIN purchase_document_items i ON i.document_id=p.id GROUP BY p.id ORDER BY COALESCE(p.purchase_date,p.created_at::date) DESC,p.id DESC LIMIT 200`);res.json({items:r.rows})}catch(e){console.error(e);res.status(500).json({error:'No se pudieron cargar los documentos de compra.'})}});
app.get('/api/admin/purchase-documents/:id',auth,async(req,res)=>{try{const [d,i]=await Promise.all([pool.query(`SELECT id,document_type,status,supplier_id,supplier_name,supplier_rut,document_number,purchase_date,subtotal,tax,total,payment_method,payment_status,category,stock_status,linked_document_id,extraction_confidence,extraction_warnings,notes,confirmed_by,confirmed_at,created_at FROM purchase_documents WHERE id=$1`,[req.params.id]),pool.query('SELECT * FROM purchase_document_items WHERE document_id=$1 ORDER BY id',[req.params.id])]);if(!d.rowCount)return res.status(404).json({error:'Documento no encontrado.'});res.json({item:{...d.rows[0],items:i.rows,image_url:`/api/admin/purchase-documents/${req.params.id}/image`}})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar el documento.'})}});
app.get('/api/admin/purchase-documents/:id/image',auth,async(req,res)=>{try{const r=await pool.query('SELECT image_mime,image_data FROM purchase_documents WHERE id=$1',[req.params.id]);if(!r.rowCount)return res.status(404).end();res.set({'Content-Type':r.rows[0].image_mime,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}).send(r.rows[0].image_data)}catch(e){console.error(e);res.status(500).end()}});
app.post('/api/admin/purchase-documents/analyze',auth,async(req,res)=>{let image;try{image=parseImageData(req.body.image);const duplicate=await pool.query('SELECT id,status FROM purchase_documents WHERE image_hash=$1',[image.hash]);if(duplicate.rowCount)return res.status(409).json({error:`Esta misma imagen ya fue cargada en el documento N° ${duplicate.rows[0].id}.`,duplicate_id:duplicate.rows[0].id});let extracted;try{extracted=await extractPurchaseDocument(image.dataUrl)}catch(analysisError){console.error('Análisis automático no disponible:',analysisError);extracted=applySupplierKnowledge({document_type:'otro',supplier_name:null,supplier_rut:null,document_number:null,purchase_date:null,subtotal:null,tax:null,total:0,payment_method:null,category:'Otros',confidence:0,warnings:['El análisis automático no estuvo disponible. Completa los datos manualmente.'],items:[]})};const c=await pool.connect();try{await c.query('BEGIN');const hints=await supplierHintsForExtraction(c,extracted);const warnings=[...(extracted.warnings||[])];if(hints.supplier)warnings.push(`Proveedor reconocido: ${hints.supplier.name}. Se sugieren productos según compras confirmadas anteriores.`);const d=await c.query(`INSERT INTO purchase_documents(document_type,supplier_name,supplier_rut,document_number,purchase_date,subtotal,tax,total,payment_method,category,image_mime,image_data,image_hash,extraction_confidence,extraction_warnings,raw_extraction) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,[extracted.document_type,extracted.supplier_name||hints.supplier?.name||null,extracted.supplier_rut||hints.supplier?.rut||null,extracted.document_number,validDate(extracted.purchase_date),nullableInt(extracted.subtotal),nullableInt(extracted.tax),int(extracted.total),extracted.payment_method,extracted.category||'Otros',image.mime,image.buffer,image.hash,Math.max(0,Math.min(1,Number(extracted.confidence||0))),JSON.stringify(warnings),JSON.stringify(extracted)]);for(const item of extracted.items||[]){const suggested=suggestedInventoryForItem(item,hints);await c.query(`INSERT INTO purchase_document_items(document_id,inventory_item_id,description,quantity,unit,unit_price,line_total,affects_stock,confidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[d.rows[0].id,suggested,String(item.description||'Producto sin identificar'),nullableNum(item.quantity),item.unit||null,nullableInt(item.unit_price),nullableInt(item.line_total),Boolean(item.affects_stock&&item.quantity),Math.max(0,Math.min(1,Number(item.confidence||0)))])}await c.query('COMMIT');res.status(201).json({id:d.rows[0].id})}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}catch(e){console.error(e);res.status(500).json({error:e.message||'No se pudo procesar la imagen.'})}});
app.post('/api/admin/purchase-documents/manual',auth,async(req,res)=>{try{const b=req.body||{},blank=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=','base64'),hash=crypto.createHash('sha256').update(`${Date.now()}-${Math.random()}-${req.session.admin.user}`).digest('hex');const r=await pool.query(`INSERT INTO purchase_documents(document_type,supplier_name,supplier_rut,document_number,purchase_date,subtotal,tax,total,payment_method,category,image_mime,image_data,image_hash,extraction_confidence,extraction_warnings,raw_extraction,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'image/png',$11,$12,0,$13,$14,$15) RETURNING id`,[b.document_type||'factura',b.supplier_name||null,b.supplier_rut||null,b.document_number||null,b.purchase_date||new Date().toISOString().slice(0,10),nullableInt(b.subtotal),nullableInt(b.tax),int(b.total),b.payment_method||null,b.category||'Otros',blank,hash,JSON.stringify(['Compra ingresada manualmente. Revisa productos y marca las líneas que actualizan stock.']),JSON.stringify({source:'manual'}),b.notes||null]);res.status(201).json({id:r.rows[0].id})}catch(e){console.error(e);res.status(500).json({error:'No se pudo crear la compra manual.'})}});
app.put('/api/admin/purchase-documents/:id',auth,async(req,res)=>{const b=req.body,types=['factura','boleta','comprobante_manual','comprobante_pago','conteo_stock','otro'];if(!types.includes(b.document_type))return res.status(400).json({error:'Tipo de documento inválido.'});const c=await pool.connect();try{await c.query('BEGIN');const current=await c.query('SELECT status FROM purchase_documents WHERE id=$1 FOR UPDATE',[req.params.id]);if(!current.rowCount)throw Error('Documento no encontrado.');if(current.rows[0].status==='confirmado')throw Error('Un documento confirmado ya no puede modificarse.');await c.query(`UPDATE purchase_documents SET document_type=$1,supplier_name=$2,supplier_rut=$3,document_number=$4,purchase_date=$5,subtotal=$6,tax=$7,total=$8,payment_method=$9,payment_status=$10,category=$11,linked_document_id=$12,notes=$13,status='requiere_revision',updated_at=NOW() WHERE id=$14`,[b.document_type,String(b.supplier_name||'').trim()||null,String(b.supplier_rut||'').trim()||null,String(b.document_number||'').trim()||null,b.purchase_date||null,nullableInt(b.subtotal),nullableInt(b.tax),int(b.total),b.payment_method||null,b.payment_status==='pendiente'?'pendiente':'pagado',b.category||'Otros',b.linked_document_id||null,b.notes||null,req.params.id]);await c.query('DELETE FROM purchase_document_items WHERE document_id=$1',[req.params.id]);for(const item of b.items||[]){if(!String(item.description||'').trim())continue;await c.query(`INSERT INTO purchase_document_items(document_id,inventory_item_id,description,quantity,unit,unit_price,line_total,affects_stock,confidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[req.params.id,item.inventory_item_id||null,String(item.description).trim(),nullableNum(item.quantity),item.unit||null,nullableInt(item.unit_price),nullableInt(item.line_total),Boolean(item.affects_stock),nullableNum(item.confidence)])}await c.query('COMMIT');res.json({ok:true})}catch(e){await c.query('ROLLBACK');console.error(e);res.status(400).json({error:e.message||'No se pudo guardar la revisión.'})}finally{c.release()}});
app.post('/api/admin/purchase-documents/:id/confirm',auth,async(req,res)=>{const c=await pool.connect();try{await c.query('BEGIN');const dRes=await c.query('SELECT * FROM purchase_documents WHERE id=$1 FOR UPDATE',[req.params.id]);if(!dRes.rowCount)throw Error('Documento no encontrado.');const d=dRes.rows[0];if(d.status==='confirmado')throw Error('El documento ya fue confirmado.');if(!d.purchase_date)throw Error('Confirma la fecha de compra.');if(d.document_type==='comprobante_pago'){if(!d.linked_document_id)throw Error('Selecciona la compra asociada a este comprobante de pago.');const linked=await c.query(`UPDATE purchase_documents SET payment_status='pagado',payment_method=COALESCE($1,payment_method),updated_at=NOW() WHERE id=$2 AND status='confirmado' RETURNING id`,[d.payment_method,d.linked_document_id]);if(!linked.rowCount)throw Error('La compra asociada no existe o aún no está confirmada.');await c.query(`UPDATE purchase_documents SET status='confirmado',stock_status='no_aplica',confirmed_by=$1,confirmed_at=NOW(),updated_at=NOW() WHERE id=$2`,[req.session.admin.user,d.id]);await c.query('COMMIT');return res.json({ok:true})}if(d.document_number&&d.supplier_rut){const dup=await c.query(`SELECT id FROM purchase_documents WHERE id<>$1 AND status='confirmado' AND document_type=$2 AND REGEXP_REPLACE(UPPER(COALESCE(supplier_rut,'')),'[^0-9K]','','g')=$3 AND document_number=$4 LIMIT 1`,[d.id,d.document_type,normalizeRut(d.supplier_rut),d.document_number]);if(dup.rowCount){const error=Error(`Posible duplicado del documento N° ${dup.rows[0].id}. Revisa RUT y folio.`);error.possibleDuplicate=true;throw error}}let supplierId=null;const normalized=normalizeRut(d.supplier_rut);if(normalized){const existing=await c.query('SELECT id FROM suppliers WHERE rut_normalized=$1 FOR UPDATE',[normalized]);if(existing.rowCount){supplierId=existing.rows[0].id;await c.query('UPDATE suppliers SET name=COALESCE($1,name),rut=COALESCE($2,rut),updated_at=NOW() WHERE id=$3',[d.supplier_name,d.supplier_rut,supplierId])}else{const created=await c.query('INSERT INTO suppliers(name,rut,rut_normalized) VALUES($1,$2,$3) RETURNING id',[d.supplier_name||`Proveedor ${d.supplier_rut}`,d.supplier_rut,normalized]);supplierId=created.rows[0].id}}else if(d.supplier_name){const existing=await c.query('SELECT id FROM suppliers WHERE LOWER(name)=LOWER($1) LIMIT 1',[d.supplier_name]);if(existing.rowCount)supplierId=existing.rows[0].id;else supplierId=(await c.query('INSERT INTO suppliers(name) VALUES($1) RETURNING id',[d.supplier_name])).rows[0].id}if(d.document_type!=='conteo_stock'&&d.total>0)await c.query(`INSERT INTO expenses(expense_date,category,supplier,description,amount,payment_method,document_url,notes,purchase_document_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[d.purchase_date,d.category,d.supplier_name,`Compra según ${d.document_type.replaceAll('_',' ')}${d.document_number?` N° ${d.document_number}`:''}`,d.total,d.payment_method,`/api/admin/purchase-documents/${d.id}/image`,d.notes,d.id]);const items=await c.query('SELECT * FROM purchase_document_items WHERE document_id=$1 ORDER BY id',[d.id]);let stockCount=0;for(const item of items.rows){if(!item.affects_stock)continue;if(!item.inventory_item_id||Number(item.quantity)<0||(d.document_type!=='conteo_stock'&&Number(item.quantity)<=0))throw Error(`Completa cantidad y producto de inventario para "${item.description}".`);const inv=await c.query('SELECT id FROM inventory_items WHERE id=$1 FOR UPDATE',[item.inventory_item_id]);if(!inv.rowCount)throw Error(`El producto de stock asociado a "${item.description}" ya no existe.`);if(d.document_type==='conteo_stock'){await c.query('UPDATE inventory_items SET current_stock=$1,updated_at=NOW() WHERE id=$2',[item.quantity,item.inventory_item_id]);await c.query(`INSERT INTO inventory_movements(item_id,movement_date,type,quantity,reason,purchase_document_id) VALUES($1,$2,'ajuste',$3,$4,$5)`,[item.inventory_item_id,d.purchase_date,item.quantity,`Conteo de stock documento N° ${d.id}`,d.id])}else{await c.query('UPDATE inventory_items SET current_stock=current_stock+$1,unit_cost=COALESCE($2,unit_cost),supplier=COALESCE($3,supplier),updated_at=NOW() WHERE id=$4',[item.quantity,item.unit_price,d.supplier_name,item.inventory_item_id]);await c.query(`INSERT INTO inventory_movements(item_id,movement_date,type,quantity,reason,purchase_document_id) VALUES($1,$2,'entrada',$3,$4,$5)`,[item.inventory_item_id,d.purchase_date,item.quantity,`Compra documento N° ${d.document_number||d.id}`,d.id])}stockCount++}if(d.document_type==='conteo_stock'&&!stockCount)throw Error('El conteo debe incluir al menos un producto asociado al stock.');const stockStatus=stockCount?'confirmado':items.rowCount?'no_aplica':'pendiente';await c.query(`UPDATE purchase_documents SET status='confirmado',supplier_id=$1,stock_status=$2,confirmed_by=$3,confirmed_at=NOW(),updated_at=NOW() WHERE id=$4`,[supplierId,stockStatus,req.session.admin.user,d.id]);await c.query('COMMIT');res.json({ok:true,stock_movements:stockCount})}catch(e){await c.query('ROLLBACK');if(e.possibleDuplicate)await pool.query(`UPDATE purchase_documents SET status='posible_duplicado',updated_at=NOW() WHERE id=$1`,[req.params.id]);console.error(e);res.status(400).json({error:e.message||'No se pudo confirmar el documento.'})}finally{c.release()}});
app.delete('/api/admin/purchase-documents/:id',auth,async(req,res)=>{try{const r=await pool.query(`DELETE FROM purchase_documents WHERE id=$1 AND status<>'confirmado' RETURNING id`,[req.params.id]);if(!r.rowCount)return res.status(400).json({error:'Solo se pueden eliminar documentos que aún no estén confirmados.'});res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:'No se pudo eliminar el documento.'})}});
async function fullKitchenMinuta(db,id){
  const m=await db.query('SELECT * FROM kitchen_minutas WHERE id=$1',[id]);
  if(!m.rowCount)return null;
  const p=await db.query('SELECT * FROM kitchen_minuta_preparations WHERE minuta_id=$1 ORDER BY sort_order,id',[id]);
  const prepIds=p.rows.map(x=>x.id);
  let ingredients=[];
  if(prepIds.length){
    ingredients=(await db.query(`SELECT i.*,inv.name inventory_name,inv.unit inventory_unit FROM kitchen_minuta_ingredients i LEFT JOIN inventory_items inv ON inv.id=i.inventory_item_id WHERE i.preparation_id=ANY($1::bigint[]) ORDER BY i.sort_order,i.id`,[prepIds])).rows;
  }
  return {...m.rows[0],preparations:p.rows.map(prep=>({...prep,ingredients:ingredients.filter(i=>Number(i.preparation_id)===Number(prep.id))}))};
}
async function saveKitchenMinuta(db,b,existingId=null,user=null){
  const title=String(b.title||'').trim();
  if(!title)throw Error('El nombre de la minuta es obligatorio.');
  const date=validDate(b.minuta_date)||new Date().toISOString().slice(0,10);
  let id=existingId;
  if(id){
    const current=await db.query('SELECT status FROM kitchen_minutas WHERE id=$1 FOR UPDATE',[id]);
    if(!current.rowCount)throw Error('Minuta no encontrada.');
    await db.query(`UPDATE kitchen_minutas SET minuta_date=$1,title=$2,planned_portions=$3,notes=$4,status=$5,confirmed_by=CASE WHEN $5='confirmada' THEN COALESCE(confirmed_by,$6) ELSE NULL END,confirmed_at=CASE WHEN $5='confirmada' THEN COALESCE(confirmed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$7`,[date,title,int(b.planned_portions),b.notes||null,b.status==='confirmada'?'confirmada':'borrador',user,id]);
    await db.query('DELETE FROM kitchen_minuta_preparations WHERE minuta_id=$1',[id]);
  }else{
    id=(await db.query(`INSERT INTO kitchen_minutas(minuta_date,title,planned_portions,notes,status,confirmed_by,confirmed_at) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $5='confirmada' THEN NOW() ELSE NULL END) RETURNING id`,[date,title,int(b.planned_portions),b.notes||null,b.status==='confirmada'?'confirmada':'borrador',b.status==='confirmada'?user:null])).rows[0].id;
  }
  let order=0;
  for(const prep of b.preparations||[]){
    const name=String(prep.name||'').trim();
    if(!name)continue;
    const p=await db.query('INSERT INTO kitchen_minuta_preparations(minuta_id,name,servings,notes,sort_order) VALUES($1,$2,$3,$4,$5) RETURNING id',[id,name,prep.servings?int(prep.servings):null,prep.notes||null,order++]);
    let itemOrder=0;
    for(const item of prep.ingredients||[]){
      const ingredient=String(item.ingredient_name||item.name||'').trim();
      if(!ingredient)continue;
      await db.query('INSERT INTO kitchen_minuta_ingredients(preparation_id,inventory_item_id,ingredient_name,quantity,unit,confirmed,notes,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[p.rows[0].id,item.inventory_item_id||null,ingredient,nullableNum(item.quantity),item.unit||null,Boolean(item.confirmed),item.notes||null,itemOrder++]);
    }
  }
  return id;
}
app.get('/api/admin/kitchen-minutas',auth,async(req,res)=>{try{const r=await pool.query(`SELECT m.*,COUNT(DISTINCT p.id)::int preparation_count,COUNT(i.id)::int ingredient_count,COUNT(i.id) FILTER(WHERE i.confirmed)::int confirmed_ingredient_count FROM kitchen_minutas m LEFT JOIN kitchen_minuta_preparations p ON p.minuta_id=m.id LEFT JOIN kitchen_minuta_ingredients i ON i.preparation_id=p.id GROUP BY m.id ORDER BY m.minuta_date DESC,m.id DESC LIMIT 120`);res.json({items:r.rows})}catch(e){console.error(e);res.status(500).json({error:'No se pudieron cargar las minutas.'})}});
app.get('/api/admin/kitchen-minutas/:id',auth,async(req,res)=>{try{const item=await fullKitchenMinuta(pool,req.params.id);if(!item)return res.status(404).json({error:'Minuta no encontrada.'});res.json({item})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar la minuta.'})}});
app.post('/api/admin/kitchen-minutas',auth,async(req,res)=>{const c=await pool.connect();try{await c.query('BEGIN');const id=await saveKitchenMinuta(c,req.body,null,req.session.admin.user);await c.query('COMMIT');res.status(201).json({item:await fullKitchenMinuta(pool,id)})}catch(e){await c.query('ROLLBACK');console.error(e);res.status(400).json({error:e.message||'No se pudo guardar la minuta.'})}finally{c.release()}});
app.put('/api/admin/kitchen-minutas/:id',auth,async(req,res)=>{const c=await pool.connect();try{await c.query('BEGIN');const id=await saveKitchenMinuta(c,req.body,req.params.id,req.session.admin.user);await c.query('COMMIT');res.json({item:await fullKitchenMinuta(pool,id)})}catch(e){await c.query('ROLLBACK');console.error(e);res.status(400).json({error:e.message||'No se pudo actualizar la minuta.'})}finally{c.release()}});
app.post('/api/admin/kitchen-minutas/:id/confirm',auth,async(req,res)=>{try{const r=await pool.query(`UPDATE kitchen_minutas SET status='confirmada',confirmed_by=$1,confirmed_at=NOW(),updated_at=NOW() WHERE id=$2 RETURNING id`,[req.session.admin.user,req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Minuta no encontrada.'});res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:'No se pudo confirmar la minuta.'})}});
app.delete('/api/admin/kitchen-minutas/:id',auth,async(req,res)=>{try{await pool.query('DELETE FROM kitchen_minutas WHERE id=$1',[req.params.id]);res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:'No se pudo eliminar la minuta.'})}});
app.get('/api/public/kitchen-minutas/today',async(req,res)=>{try{const r=await pool.query(`SELECT id FROM kitchen_minutas WHERE minuta_date=CURRENT_DATE AND status='confirmada' ORDER BY id DESC LIMIT 1`);if(!r.rowCount)return res.json({item:null});res.json({item:await fullKitchenMinuta(pool,r.rows[0].id)})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar la minuta de cocina.'})}});
async function refreshConsultationProgress(db=pool){
  await db.query(`WITH evidence AS (
    SELECT d.id,
      EXISTS(SELECT 1 FROM consultation_field_records r WHERE r.deliverable_id=d.id) AS has_record,
      EXISTS(SELECT 1 FROM consultation_documents x WHERE x.deliverable_id=d.id) AS has_document,
      (d.document_url IS NOT NULL AND btrim(d.document_url) <> '') AS has_direct_document
    FROM consultation_deliverables d
  )
  UPDATE consultation_deliverables d
  SET status=CASE
      WHEN d.status='bloqueado' THEN 'bloqueado'
      WHEN d.status='completado' THEN 'completado'
      WHEN e.has_record OR e.has_document OR e.has_direct_document THEN 'en_revision'
      ELSE 'pendiente'
    END,
    document_date=CASE
      WHEN d.document_date IS NOT NULL THEN d.document_date
      WHEN e.has_document THEN (SELECT MAX(x.report_date) FROM consultation_documents x WHERE x.deliverable_id=d.id)
      WHEN e.has_record THEN (SELECT MAX(r.record_date) FROM consultation_field_records r WHERE r.deliverable_id=d.id)
      ELSE d.document_date
    END,
    updated_at=NOW()
  FROM evidence e
  WHERE d.id=e.id`)

  await db.query(`WITH stats AS (
    SELECT m.id,
      COUNT(d.id)::int total,
      COUNT(d.id) FILTER(WHERE d.status IN ('en_revision','completado'))::int evidenced,
      COUNT(d.id) FILTER(WHERE d.status='completado')::int done
    FROM consultation_milestones m LEFT JOIN consultation_deliverables d ON d.milestone_id=m.id
    GROUP BY m.id
  )
  UPDATE consultation_milestones m
  SET status=CASE
    WHEN s.total>0 AND s.done=s.total THEN 'completado'
    WHEN s.evidenced>0 AND m.status NOT IN ('realizado','completado','bloqueado','pendiente_posterior') THEN 'en_curso'
    ELSE m.status END,
    completed_at=CASE WHEN s.total>0 AND s.done=s.total THEN COALESCE(m.completed_at,NOW()) ELSE m.completed_at END,
    updated_at=NOW()
  FROM stats s WHERE m.id=s.id`)
}
app.get('/api/admin/consultation',auth,async(req,res)=>{try{const [milestones,deliverables,documents,records]=await Promise.all([pool.query('SELECT * FROM consultation_milestones ORDER BY sort_order'),pool.query('SELECT * FROM consultation_deliverables ORDER BY milestone_id,sort_order,id'),pool.query(`SELECT d.*,m.title milestone_title,m.sort_order milestone_order,cd.title deliverable_title FROM consultation_documents d JOIN consultation_milestones m ON m.id=d.milestone_id LEFT JOIN consultation_deliverables cd ON cd.id=d.deliverable_id ORDER BY d.report_date DESC,d.id DESC`),pool.query(`SELECT r.*,m.title milestone_title,m.sort_order milestone_order,d.title deliverable_title FROM consultation_field_records r JOIN consultation_milestones m ON m.id=r.milestone_id LEFT JOIN consultation_deliverables d ON d.id=r.deliverable_id ORDER BY r.record_date DESC,r.id DESC`)]);res.json({milestones:milestones.rows,deliverables:deliverables.rows,documents:documents.rows,records:records.rows})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar el seguimiento de la consultoría.'})}});
app.get('/api/admin/consultation/summary',auth,async(req,res)=>{try{const [milestones,current,deliverables,docs,records]=await Promise.all([pool.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER (WHERE status='completado')::int completed FROM consultation_milestones`),pool.query(`SELECT * FROM consultation_milestones WHERE status='en_curso' ORDER BY sort_order LIMIT 1`),pool.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER (WHERE status='completado')::int completed,COUNT(*) FILTER (WHERE status IN ('en_revision','completado'))::int evidenced FROM consultation_deliverables`),pool.query('SELECT COUNT(*)::int count FROM consultation_documents'),pool.query('SELECT COUNT(*)::int count FROM consultation_field_records')]);const m=milestones.rows[0],d=deliverables.rows[0];res.json({total:m.total,completed:m.completed,current:current.rows[0]||null,documents:docs.rows[0].count,records:records.rows[0].count,deliverables:d.total,completedDeliverables:d.completed,evidencedDeliverables:d.evidenced,progress:d.total?Math.round(d.completed*100/d.total):0,evidenceProgress:d.total?Math.round(d.evidenced*100/d.total):0})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar el avance de la consultoría.'})}});
app.post('/api/admin/consultation/progress',auth,async(req,res)=>{const order=Number(req.body.current_order);if(!Number.isInteger(order)||order<0||order>10)return res.status(400).json({error:'Hito inválido.'});try{await pool.query(`UPDATE consultation_milestones SET status=CASE WHEN sort_order<$1 THEN 'realizado' WHEN sort_order=$1 THEN 'en_curso' WHEN sort_order<=5 THEN 'pendiente_inmediato' ELSE 'pendiente_posterior' END,completed_at=CASE WHEN sort_order<$1 THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW()`,[order]);res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:'No se pudo actualizar el avance.'})}});
app.post('/api/admin/consultation/documents',auth,async(req,res)=>{const b=req.body;if(!b.milestone_id||!b.title||!b.document_type||!b.file_url)return res.status(400).json({error:'Hito, título, tipo y enlace son obligatorios.'});if(!/^https?:\/\//i.test(b.file_url))return res.status(400).json({error:'El enlace debe comenzar con http:// o https://'});const c=await pool.connect();try{await c.query('BEGIN');const r=await c.query(`INSERT INTO consultation_documents(milestone_id,deliverable_id,title,document_type,file_url,report_date,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[b.milestone_id,b.deliverable_id||null,b.title,b.document_type,b.file_url,b.report_date||new Date().toISOString().slice(0,10),b.status||'entregado',b.notes||null]);await refreshConsultationProgress(c);await c.query('COMMIT');res.status(201).json({item:r.rows[0]})}catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'No se pudo registrar el informe.'})}finally{c.release()}});
app.delete('/api/admin/consultation/documents/:id',auth,async(req,res)=>{const c=await pool.connect();try{await c.query('BEGIN');await c.query('DELETE FROM consultation_documents WHERE id=$1',[req.params.id]);await refreshConsultationProgress(c);await c.query('COMMIT');res.json({ok:true})}catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'No se pudo eliminar el informe.'})}finally{c.release()}});
app.patch('/api/admin/consultation/deliverables/:id',auth,async(req,res)=>{const b=req.body,status=['pendiente','en_preparacion','en_revision','completado','bloqueado'].includes(b.status)?b.status:'pendiente';if(b.document_url&&!/^https?:\/\//i.test(b.document_url))return res.status(400).json({error:'El enlace debe comenzar con http:// o https://'});if(b.evidence_url&&!/^https?:\/\//i.test(b.evidence_url))return res.status(400).json({error:'El enlace de respaldo debe comenzar con http:// o https://'});const c=await pool.connect();try{await c.query('BEGIN');if(status==='completado'){const ev=await c.query(`SELECT EXISTS(SELECT 1 FROM consultation_field_records WHERE deliverable_id=$1) OR EXISTS(SELECT 1 FROM consultation_documents WHERE deliverable_id=$1) AS ok`,[req.params.id]);if(!ev.rows[0].ok&&!b.document_url&&!b.evidence_url&&!b.notes)throw Error('Para validar el entregable primero vincula un acta, informe, respaldo o una observación suficiente.')}const r=await c.query(`UPDATE consultation_deliverables SET status=$1,document_url=$2,document_date=$3,notes=$4,responsible=$5,due_date=$6,evidence_url=$7,visibility=$8,document_type=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,[status,b.document_url||null,b.document_date||null,b.notes||null,b.responsible||null,b.due_date||null,b.evidence_url||null,b.visibility||'Compartido con Claudia',b.document_type||'Entregable',req.params.id]);if(!r.rowCount)throw Error('Entregable no encontrado.');await refreshConsultationProgress(c);await c.query('COMMIT');res.json({item:r.rows[0]})}catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:e.message||'No se pudo actualizar el entregable.'})}finally{c.release()}});
app.post('/api/admin/consultation/records',auth,async(req,res)=>{const b=req.body;if(!b.milestone_id||!b.record_date||!b.action_type||!b.objective||!b.facts)return res.status(400).json({error:'Hito, fecha, tipo, objetivo y hechos son obligatorios.'});if(b.evidence_url&&!/^https?:\/\//i.test(b.evidence_url))return res.status(400).json({error:'El enlace de respaldo debe comenzar con http:// o https://'});const c=await pool.connect();try{await c.query('BEGIN');const r=await c.query(`INSERT INTO consultation_field_records(milestone_id,deliverable_id,record_date,action_type,institution_location,participants,objective,facts,observations,agreements,responsible,due_date,next_steps,evidence_url,menus_sold,daily_sales,average_wait_minutes,waste_notes,staff_hours) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,[b.milestone_id,b.deliverable_id||null,b.record_date,b.action_type,b.institution_location||null,b.participants||null,b.objective,b.facts,b.observations||null,b.agreements||null,b.responsible||null,b.due_date||null,b.next_steps||null,b.evidence_url||null,b.menus_sold?int(b.menus_sold):null,b.daily_sales?int(b.daily_sales):null,b.average_wait_minutes?int(b.average_wait_minutes):null,b.waste_notes||null,b.staff_hours?num(b.staff_hours):null]);await refreshConsultationProgress(c);await c.query('COMMIT');res.status(201).json({item:r.rows[0]})}catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'No se pudo generar el acta.'})}finally{c.release()}});
app.get('/api/admin/consultation/records/:id',auth,async(req,res)=>{try{const r=await pool.query(`SELECT a.*,m.title milestone_title,m.week_number,m.sort_order milestone_order,d.title deliverable_title FROM consultation_field_records a JOIN consultation_milestones m ON m.id=a.milestone_id LEFT JOIN consultation_deliverables d ON d.id=a.deliverable_id WHERE a.id=$1`,[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Acta no encontrada.'});res.json({item:r.rows[0]})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar el acta.'})}});
app.delete('/api/admin/consultation/records/:id',auth,async(req,res)=>{const c=await pool.connect();try{await c.query('BEGIN');await c.query('DELETE FROM consultation_field_records WHERE id=$1',[req.params.id]);await refreshConsultationProgress(c);await c.query('COMMIT');res.json({ok:true})}catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'No se pudo eliminar el acta.'})}finally{c.release()}});
app.post('/api/admin/weekly_menus',auth,async(req,res)=>{const c=await pool.connect();try{const {week_start,week_end,notes,days}=req.body;if(!week_start||!week_end)return res.status(400).json({error:'Faltan fechas.'}); await c.query('BEGIN'); const w=await c.query('INSERT INTO weekly_menus(week_start,week_end,notes) VALUES($1,$2,$3) RETURNING *',[week_start,week_end,notes||null]); for(const d of days||[]) await c.query('INSERT INTO weekly_menu_days(weekly_menu_id,day_name,menu_date,title,planned_portions,notes) VALUES($1,$2,$3,$4,$5,$6)',[w.rows[0].id,d.day_name,d.menu_date||null,d.title||null,Number(d.planned_portions||0),d.notes||null]); await c.query('COMMIT'); res.status(201).json({item:w.rows[0]})}catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'No se pudo guardar minuta.'})}finally{c.release()}});
app.get('/api/admin/weekly_menus',auth,async(req,res)=>{const w=await pool.query('SELECT * FROM weekly_menus ORDER BY week_start DESC LIMIT 50');const full=[];for(const x of w.rows){const d=await pool.query('SELECT * FROM weekly_menu_days WHERE weekly_menu_id=$1 ORDER BY id',[x.id]);full.push({...x,days:d.rows})}res.json({items:full})}); app.delete('/api/admin/weekly_menus/:id',auth,async(req,res)=>{await pool.query('DELETE FROM weekly_menus WHERE id=$1',[req.params.id]);res.json({ok:true})});
app.post('/api/admin/rations',auth,async(req,res)=>{const b=req.body, portions=Number(b.planned_portions||0), total=int(b.estimated_total_cost), price=int(b.sale_price), cpp=portions>0?Math.round(total/portions):0;const r=await pool.query('INSERT INTO rations(ration_date,title,planned_portions,estimated_total_cost,estimated_cost_per_portion,sale_price,estimated_margin,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[b.ration_date||new Date().toISOString().slice(0,10),b.title,portions,total,cpp,price,price-cpp,b.notes||null]);res.status(201).json({item:r.rows[0]})}); app.get('/api/admin/rations',auth,async(req,res)=>{const r=await pool.query('SELECT * FROM rations ORDER BY ration_date DESC,id DESC LIMIT 100');res.json({items:r.rows})}); app.delete('/api/admin/rations/:id',auth,async(req,res)=>{await pool.query('DELETE FROM rations WHERE id=$1',[req.params.id]);res.json({ok:true})});
pool.query(schema).then(()=>seedKnownSuppliers()).then(()=>seedInitialStaff()).then(()=>refreshConsultationProgress()).then(()=>app.listen(PORT,()=>console.log(`CM Banquetería Admin corriendo en ${SITE_URL}`))).catch(e=>{console.error('No se pudo inicializar Neon/Postgres:',e);process.exit(1)});
