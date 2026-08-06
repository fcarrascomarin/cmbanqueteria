
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

-- Equipo inicial CM registrado para el módulo Personal.
INSERT INTO staff(full_name,role,status,notes)
SELECT 'Claudia Mendez','Administradora','activo','Registro inicial de equipo CM cargado desde levantamiento Metamorfosis. Completar RUT, teléfono, jornada, contrato y documentación asociada.'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE LOWER(full_name)=LOWER('Claudia Mendez') AND LOWER(COALESCE(role,''))=LOWER('Administradora'));
INSERT INTO staff(full_name,role,status,notes)
SELECT 'Silvia','Maestra de cocina','activo','Registro inicial de equipo CM cargado desde levantamiento Metamorfosis. Completar RUT, teléfono, jornada, contrato y documentación asociada.'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE LOWER(full_name)=LOWER('Silvia') AND LOWER(COALESCE(role,''))=LOWER('Maestra de cocina'));
INSERT INTO staff(full_name,role,status,notes)
SELECT 'Jenny','Ayudante de cocina','activo','Registro inicial de equipo CM cargado desde levantamiento Metamorfosis. Completar RUT, teléfono, jornada, contrato y documentación asociada.'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE LOWER(full_name)=LOWER('Jenny') AND LOWER(COALESCE(role,''))=LOWER('Ayudante de cocina'));
INSERT INTO staff(full_name,role,status,notes)
SELECT 'Marlen','Aseo comedor y apoyo en cocina','activo','Registro inicial de equipo CM cargado desde levantamiento Metamorfosis. Completar RUT, teléfono, jornada, contrato y documentación asociada.'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE LOWER(full_name)=LOWER('Marlen') AND LOWER(COALESCE(role,''))=LOWER('Aseo comedor y apoyo en cocina'));
INSERT INTO staff(full_name,role,status,notes)
SELECT 'Sofia','Mesera part-time','activo','Registro inicial de equipo CM cargado desde levantamiento Metamorfosis. Completar RUT, teléfono, jornada, contrato y documentación asociada.'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE LOWER(full_name)=LOWER('Sofia') AND LOWER(COALESCE(role,''))=LOWER('Mesera part-time'));

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
DELETE FROM consultation_deliverables d USING consultation_milestones m WHERE d.milestone_id=m.id AND d.status='pendiente' AND d.document_url IS NULL AND d.notes IS NULL AND NOT EXISTS (SELECT 1 FROM unnest(string_to_array(m.deliverables,'|')) AS x(title) WHERE TRIM(x.title)=d.title);


-- Registro diario de costos, ventas y resultado del restaurant.
CREATE TABLE IF NOT EXISTS daily_financials (
  id BIGSERIAL PRIMARY KEY,
  financial_date DATE NOT NULL UNIQUE,
  customers_count INTEGER NOT NULL DEFAULT 0 CHECK(customers_count>=0),
  income INTEGER NOT NULL DEFAULT 0 CHECK(income>=0),
  personnel_cost INTEGER NOT NULL DEFAULT 0 CHECK(personnel_cost>=0),
  basic_expenses INTEGER NOT NULL DEFAULT 15000 CHECK(basic_expenses>=0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS daily_cost_items (
  id BIGSERIAL PRIMARY KEY,
  financial_id BIGINT NOT NULL REFERENCES daily_financials(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Ingredientes',
  item_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK(quantity>=0),
  unit TEXT,
  unit_cost INTEGER NOT NULL DEFAULT 0 CHECK(unit_cost>=0),
  total_cost INTEGER NOT NULL DEFAULT 0 CHECK(total_cost>=0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_daily_financials_date ON daily_financials(financial_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_cost_items_financial ON daily_cost_items(financial_id);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date); CREATE INDEX IF NOT EXISTS idx_daily_menus_date ON daily_menus(menu_date); CREATE INDEX IF NOT EXISTS idx_quotes_status ON event_quotes(status); CREATE INDEX IF NOT EXISTS idx_documents_expiration ON documents(expiration_date);


-- Datos históricos iniciales CM Restaurant · abril a julio de 2026.
-- Se insertan únicamente si la fecha todavía no existe, para no reemplazar correcciones posteriores de la administradora.
WITH seed(financial_date,customers_count,income,personnel_cost,basic_expenses,food_cost) AS (VALUES
  ('2026-04-24'::date,62,403100,77000,15000,161400),
  ('2026-04-27'::date,49,317000,77000,15000,132930),
  ('2026-04-28'::date,35,225000,77000,15000,111307),
  ('2026-04-29'::date,38,247500,77000,15000,100672),
  ('2026-04-30'::date,54,352941,77000,15000,151881),
  ('2026-05-04'::date,56,362326,77000,15000,177684),
  ('2026-05-05'::date,66,430000,77000,15000,198378),
  ('2026-05-06'::date,85,555700,77000,15000,240625),
  ('2026-05-07'::date,86,556800,77000,15000,235604),
  ('2026-05-08'::date,70,452100,77000,15000,148415),
  ('2026-05-11'::date,30,193000,77000,15000,78005),
  ('2026-05-12'::date,16,105900,77000,15000,49581),
  ('2026-05-13'::date,58,379600,136000,15000,143478),
  ('2026-05-14'::date,81,529600,131600,15000,227930),
  ('2026-05-15'::date,51,333900,131600,15000,145084),
  ('2026-05-18'::date,78,506600,131600,15000,258014),
  ('2026-05-19'::date,87,562800,131600,15000,195878),
  ('2026-05-20'::date,23,148900,75000,15000,73889),
  ('2026-05-21'::date,23,148900,75000,15000,56249),
  ('2026-05-22'::date,60,388100,131600,15000,126706),
  ('2026-05-25'::date,98,639000,131600,15000,262865),
  ('2026-05-26'::date,39,252000,108500,15000,82638),
  ('2026-05-27'::date,27,176000,121500,15000,65163),
  ('2026-05-29'::date,38,246000,75000,15000,66152),
  ('2026-06-01'::date,28,179500,103500,15000,77355),
  ('2026-06-02'::date,41,264000,131600,15000,89267),
  ('2026-06-03'::date,25,162000,131600,15000,81814),
  ('2026-06-09'::date,30,198000,121500,15000,88007),
  ('2026-06-10'::date,30,198000,121500,15000,93712),
  ('2026-06-11'::date,85,550900,131600,15000,226680),
  ('2026-06-12'::date,113,737000,196500,15000,258292),
  ('2026-06-15'::date,70,452100,131600,15000,144905),
  ('2026-06-16'::date,40,258000,121500,15000,96795),
  ('2026-06-17'::date,38,247500,136000,15000,93460),
  ('2026-06-19'::date,41,264000,131600,15000,119041),
  ('2026-06-22'::date,18,120000,131600,15000,58946),
  ('2026-06-23'::date,22,141600,130000,15000,64606),
  ('2026-06-24'::date,26,167000,121500,15000,49025),
  ('2026-06-25'::date,23,150000,121500,15000,78504),
  ('2026-07-01'::date,50,350000,129500,15000,97282),
  ('2026-07-03'::date,50,350000,146500,15000,107739),
  ('2026-07-04'::date,34,240000,121600,15000,95427),
  ('2026-07-06'::date,27,189000,121500,15000,71451),
  ('2026-07-07'::date,32,225000,146500,15000,83497),
  ('2026-07-08'::date,22,154000,121500,15000,71278),
  ('2026-07-13'::date,13,91000,95000,15000,55015),
  ('2026-07-14'::date,35,245000,100000,15000,95759),
  ('2026-07-15'::date,31,217000,110000,15000,78294),
  ('2026-07-17'::date,24,168000,95000,15000,67664),
  ('2026-07-20'::date,29,203000,95000,15000,73214),
  ('2026-07-21'::date,29,203000,95000,15000,83777),
  ('2026-07-22'::date,29,203000,95000,15000,70819),
  ('2026-07-23'::date,14,98000,95000,15000,67276)
), inserted AS (
  INSERT INTO daily_financials(financial_date,customers_count,income,personnel_cost,basic_expenses,notes)
  SELECT financial_date,customers_count,income,personnel_cost,basic_expenses,
    'Registro histórico abril-julio 2026 importado desde la planilla inicial de CM. El costo de alimentos está consolidado y puede reemplazarse por su desglose real mediante Editar.'
  FROM seed
  ON CONFLICT(financial_date) DO NOTHING
  RETURNING id,financial_date
)
INSERT INTO daily_cost_items(financial_id,category,item_name,quantity,unit,unit_cost,total_cost,notes)
SELECT i.id,'Ingredientes','Costo de alimentos consolidado',1,'jornada',s.food_cost,s.food_cost,
  'Carga inicial histórica. Editar para corregir el monto o sustituirlo por insumos detallados.'
FROM inserted i JOIN seed s USING(financial_date);


-- Desglose real compartido para la jornada del 9 de junio de 2026.
-- Reemplaza únicamente la fila consolidada inicial; no toca registros que ya hayan sido editados.
DO $$
DECLARE fid BIGINT;
BEGIN
  SELECT f.id INTO fid FROM daily_financials f
  WHERE f.financial_date='2026-06-09'::date
    AND (SELECT COUNT(*) FROM daily_cost_items i WHERE i.financial_id=f.id)=1
    AND EXISTS (SELECT 1 FROM daily_cost_items i WHERE i.financial_id=f.id AND i.item_name='Costo de alimentos consolidado' AND i.total_cost=88007);
  IF fid IS NOT NULL THEN
    DELETE FROM daily_cost_items WHERE financial_id=fid;
    INSERT INTO daily_cost_items(financial_id,category,item_name,quantity,unit,unit_cost,total_cost,notes) VALUES
      (fid,'Ingredientes','crema',0.5,NULL,4990,2495,'Planilla 09-06-2026'),(fid,'Ingredientes','huevo',3,NULL,250,750,'Planilla 09-06-2026'),
      (fid,'Ingredientes','cilantro',0.5,NULL,1000,500,'Planilla 09-06-2026'),(fid,'Ingredientes','ensalada surtida',0,NULL,0,0,'Planilla 09-06-2026'),
      (fid,'Ingredientes','tomate',4,NULL,1000,4000,'Planilla 09-06-2026'),(fid,'Ingredientes','cebolla',2,NULL,450,900,'Planilla 09-06-2026'),
      (fid,'Ingredientes','cilantro',0.2,NULL,1000,200,'Planilla 09-06-2026'),(fid,'Ingredientes','pollo asado',25,NULL,1180,29500,'Planilla 09-06-2026'),
      (fid,'Ingredientes','aceite',1,NULL,1690,1690,'Planilla 09-06-2026'),(fid,'Ingredientes','sal',1,NULL,590,590,'Planilla 09-06-2026'),
      (fid,'Ingredientes','arroz',2,NULL,1800,3600,'Planilla 09-06-2026'),(fid,'Ingredientes','papa rellena',1.5,NULL,750,1125,'Planilla 09-06-2026'),
      (fid,'Ingredientes','papas',6,NULL,500,3000,'Planilla 09-06-2026'),(fid,'Ingredientes','huevo',8,NULL,250,2000,'Planilla 09-06-2026'),
      (fid,'Ingredientes','harina',1,NULL,1000,1000,'Planilla 09-06-2026'),(fid,'Ingredientes','molida',2,NULL,5000,10000,'Planilla 09-06-2026'),
      (fid,'Ingredientes','cebolla',4,NULL,200,800,'Planilla 09-06-2026'),(fid,'Ingredientes','aceite',1,NULL,1690,1690,'Planilla 09-06-2026'),
      (fid,'Ingredientes','lentejas',5,NULL,700,3500,'Planilla 09-06-2026'),(fid,'Ingredientes','longaniza',0.2,NULL,6990,1398,'Planilla 09-06-2026'),
      (fid,'Ingredientes','media pechuga',0,NULL,0,0,'Planilla 09-06-2026'),(fid,'Ingredientes','flan',1,NULL,2764,6910,'Total directo de la planilla 09-06-2026'),
      (fid,'Ingredientes','pan',30,NULL,170,5100,'Planilla 09-06-2026'),(fid,'Aseo','cloro',1,NULL,600,600,'Planilla 09-06-2026'),
      (fid,'Aseo','guantes',4,NULL,77,308,'Planilla 09-06-2026'),(fid,'Ingredientes','aceite alcuzas',0,NULL,1590,0,'Planilla 09-06-2026'),
      (fid,'Envases','servilletas',0.5,NULL,1302,651,'Planilla 09-06-2026'),(fid,'Ingredientes','jugo pulpa',0.5,NULL,1998,999,'Planilla 09-06-2026'),
      (fid,'Ingredientes','jugo de limón',0.5,NULL,1442,721,'Planilla 09-06-2026'),(fid,'Ingredientes','ají',0.5,NULL,2000,1000,'Planilla 09-06-2026'),
      (fid,'Aseo','toalla de papel',0.5,NULL,1924,962,'Planilla 09-06-2026'),(fid,'Aseo','alcohol',0.2,NULL,3700,740,'Planilla 09-06-2026'),
      (fid,'Aseo','lavaloza Virginia',0.3,NULL,1925,578,'Redondeo del total 577,5 de la planilla'),(fid,'Envases','saco de papel',70,NULL,10,700,'Planilla 09-06-2026'),
      (fid,'Envases','desechable CMPC',0,NULL,450,0,'Planilla 09-06-2026'),(fid,'Ingredientes','limoneta',0,NULL,26,0,'Planilla 09-06-2026');
    UPDATE daily_financials SET notes='Registro histórico del 9 de junio de 2026 importado con el desglose completo de insumos de la planilla compartida.',updated_at=NOW() WHERE id=fid;
  END IF;
END $$;
