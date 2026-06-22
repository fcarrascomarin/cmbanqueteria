require('dotenv').config();
const express=require('express'), cors=require('cors'), session=require('express-session'), nodemailer=require('nodemailer');
const {spawn}=require('child_process'), fs=require('fs'), os=require('os'), path=require('path');
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
CREATE INDEX IF NOT EXISTS idx_observations_date ON observations(obs_date);
CREATE TABLE IF NOT EXISTS expenses (id BIGSERIAL PRIMARY KEY, expense_date DATE NOT NULL DEFAULT CURRENT_DATE, category TEXT NOT NULL, supplier TEXT, description TEXT NOT NULL, amount INTEGER NOT NULL CHECK (amount>=0), payment_method TEXT, document_url TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS inventory_items (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT, unit TEXT NOT NULL DEFAULT 'unidad', current_stock NUMERIC(12,2) NOT NULL DEFAULT 0, min_stock NUMERIC(12,2) NOT NULL DEFAULT 0, unit_cost INTEGER NOT NULL DEFAULT 0, supplier TEXT, notes TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS inventory_movements (id BIGSERIAL PRIMARY KEY, item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE, movement_date DATE NOT NULL DEFAULT CURRENT_DATE, type TEXT NOT NULL CHECK (type IN ('entrada','salida','ajuste')), quantity NUMERIC(12,2) NOT NULL, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
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
CREATE TABLE IF NOT EXISTS consultation_milestones (id BIGSERIAL PRIMARY KEY, stage_key TEXT NOT NULL UNIQUE, week_number INTEGER NOT NULL, title TEXT NOT NULL, objective TEXT NOT NULL, deliverables TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','en_curso','completado')), sort_order INTEGER NOT NULL UNIQUE, notes TEXT, completed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS consultation_documents (id BIGSERIAL PRIMARY KEY, milestone_id BIGINT NOT NULL REFERENCES consultation_milestones(id) ON DELETE CASCADE, title TEXT NOT NULL, document_type TEXT NOT NULL, file_url TEXT NOT NULL, report_date DATE NOT NULL DEFAULT CURRENT_DATE, status TEXT NOT NULL DEFAULT 'entregado' CHECK(status IN ('proyectado','en_revision','entregado','aprobado')), notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO consultation_milestones(stage_key,week_number,title,objective,deliverables,status,sort_order) VALUES
('activacion',1,'Activación institucional y documental','Confirmar la ruta municipal y reunir la base documental del negocio.','Acta de reunión con Patentes|Autorización de uso del inmueble|Mandato de representación|Carpeta documental base|Primera observación operativa','en_curso',1),
('sanitaria',2,'Preparación sanitaria','Alinear la operación real con la resolución sanitaria y preparar una eventual inspección.','Checklist sanitario|Croquis operativo|Registro fotográfico|Descripción de la actividad real|Solicitud sanitaria preparada o ingresada','pendiente',2),
('economica',3,'Medición económica inicial','Reemplazar estimaciones por datos reales de ventas, costos y rentabilidad.','Registro de ventas|Registro de compras y costos|Ficha de costo por menú|Control de servicios básicos y mermas|Punto de equilibrio preliminar','pendiente',3),
('laboral',4,'Organización laboral y funcional','Levantar funciones, jornadas y brechas para ordenar progresivamente al equipo.','Fichas laborales individuales|Matriz de roles|Brechas laborales priorizadas|Alternativas de formalización|Distribución de funciones','pendiente',4),
('operativa',5,'Orden operativo y experiencia del cliente','Verificar flujos y proponer mejoras simples respaldadas por observación.','Diagnóstico operativo|Mejoras de flujo y señalética|Revisión de punto de pago y menú visible|Hipótesis confirmadas o descartadas|Propuesta de experiencia del cliente','pendiente',5),
('consolidacion',6,'Consolidación y plan de acción','Ordenar la evidencia y definir prioridades de regularización, inversión y crecimiento.','Documento maestro de diagnóstico|Carpeta de anexos|Matriz de brechas|Indicadores iniciales|Plan de acción 30, 60 y 90 días','pendiente',6)
ON CONFLICT(stage_key) DO UPDATE SET week_number=EXCLUDED.week_number,title=EXCLUDED.title,objective=EXCLUDED.objective,deliverables=EXCLUDED.deliverables,sort_order=EXCLUDED.sort_order;`;
function auth(req,res,next){ if(req.session?.admin) return next(); res.status(401).json({error:'No autorizado.'}); }
function int(v){v=Number(v||0); return Number.isFinite(v)?Math.max(0,Math.round(v)):0} function num(v){v=Number(v||0); return Number.isFinite(v)?v:0}
function mailer(){ if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS) return null; return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||465),secure:String(process.env.SMTP_SECURE||'true')==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}); }
function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
app.get('/health',(req,res)=>res.json({ok:true}));
app.get('/api/public/menu/today',async(req,res)=>{try{const r=await pool.query(`SELECT * FROM daily_menus WHERE menu_date=CURRENT_DATE AND public_visible=TRUE ORDER BY id DESC LIMIT 1`);res.json({menu:r.rows[0]||null})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar el menú.'})}});

app.get('/api/public/screen',async(req,res)=>{try{const [menu,media]=await Promise.all([pool.query(`SELECT * FROM daily_menus WHERE menu_date=CURRENT_DATE AND public_visible=TRUE ORDER BY id DESC LIMIT 1`),pool.query(`SELECT * FROM screen_media WHERE active=TRUE ORDER BY sort_order ASC,id DESC`)]);res.json({menu:menu.rows[0]||null,media:media.rows})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar pantalla.'})}});

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
        to:process.env.MAIL_TO||'cotizaciones@cmbanqueteria.cl',
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
function crud(table,fields,required=[]){app.get(`/api/admin/${table}`,auth,async(req,res)=>{try{let order='id DESC'; if(table==='expenses')order='expense_date DESC,id DESC'; if(table==='daily_menus')order='menu_date DESC,id DESC'; if(table==='documents')order='expiration_date NULLS LAST,id DESC'; const r=await pool.query(`SELECT * FROM ${table} ORDER BY ${order} LIMIT 300`);res.json({items:r.rows})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar.'})}});app.post(`/api/admin/${table}`,auth,async(req,res)=>{try{for(const f of required)if(!req.body[f])return res.status(400).json({error:`Falta ${f}.`});const fs=fields.filter(f=>req.body[f]!==undefined), vals=fs.map(f=>req.body[f]===''?null:req.body[f]), ph=fs.map((_,i)=>`$${i+1}`);const r=await pool.query(`INSERT INTO ${table}(${fs.join(',')}) VALUES(${ph.join(',')}) RETURNING *`,vals);res.status(201).json({item:r.rows[0]})}catch(e){console.error(e);res.status(500).json({error:'No se pudo guardar.'})}});app.patch(`/api/admin/${table}/:id`,auth,async(req,res)=>{try{const fs=fields.filter(f=>req.body[f]!==undefined); const vals=fs.map(f=>req.body[f]===''?null:req.body[f]); vals.push(req.params.id); const touch=['inventory_items','daily_menus','event_quotes'].includes(table)?', updated_at=NOW()':'';const r=await pool.query(`UPDATE ${table} SET ${fs.map((f,i)=>`${f}=$${i+1}`).join(',')} ${touch} WHERE id=$${vals.length} RETURNING *`,vals);res.json({item:r.rows[0]})}catch(e){console.error(e);res.status(500).json({error:'No se pudo actualizar.'})}});app.delete(`/api/admin/${table}/:id`,auth,async(req,res)=>{try{await pool.query(`DELETE FROM ${table} WHERE id=$1`,[req.params.id]);res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:'No se pudo eliminar.'})}})}
crud('observations',['obs_date','area','title','description','priority','status'],['area','title']); crud('screen_media',['title','media_type','url','active','sort_order','duration_seconds','notes'],['title','url']); crud('expenses',['expense_date','category','supplier','description','amount','payment_method','document_url','notes'],['category','description','amount']); crud('inventory_items',['name','category','unit','current_stock','min_stock','unit_cost','supplier','notes','active'],['name']); crud('daily_menus',['menu_date','title','main_dish','side_dish','salad','dessert','price','planned_portions','available_portions','cost_per_portion','notes','public_visible','option_1','option_2','option_3','accompaniment_change_price'],['menu_date','title']); crud('event_quotes',['client_name','phone','email','event_date','event_type','guests','location','requested_service','estimated_budget','status','quoted_total','internal_notes'],['client_name','phone']); crud('staff',['full_name','rut','role','phone','start_date','contract_type','schedule','status','notes'],['full_name']); crud('documents',['title','document_type','owner_type','staff_id','document_date','expiration_date','file_url','notes'],['title','document_type']);
app.post('/api/admin/inventory_items/:id/movement',auth,async(req,res)=>{const c=await pool.connect();try{const {type,quantity,reason}=req.body, q=num(quantity); if(!['entrada','salida','ajuste'].includes(type))return res.status(400).json({error:'Tipo inválido.'}); await c.query('BEGIN'); const it=await c.query('SELECT * FROM inventory_items WHERE id=$1 FOR UPDATE',[req.params.id]); if(!it.rowCount)throw Error('Producto no encontrado.'); let ns=Number(it.rows[0].current_stock); if(type==='entrada')ns+=q; if(type==='salida')ns-=q; if(type==='ajuste')ns=q; await c.query('UPDATE inventory_items SET current_stock=$1,updated_at=NOW() WHERE id=$2',[ns,req.params.id]); await c.query('INSERT INTO inventory_movements(item_id,type,quantity,reason) VALUES($1,$2,$3,$4)',[req.params.id,type,q,reason||null]); await c.query('COMMIT'); res.json({ok:true,current_stock:ns})}catch(e){await c.query('ROLLBACK'); console.error(e);res.status(500).json({error:e.message||'No se pudo registrar movimiento.'})}finally{c.release()}});
app.get('/api/admin/inventory_movements',auth,async(req,res)=>{const r=await pool.query(`SELECT m.*,i.name item_name,i.unit FROM inventory_movements m JOIN inventory_items i ON i.id=m.item_id ORDER BY m.created_at DESC LIMIT 200`);res.json({items:r.rows})});
app.get('/api/admin/consultation',auth,async(req,res)=>{try{const [milestones,documents]=await Promise.all([pool.query('SELECT * FROM consultation_milestones ORDER BY sort_order'),pool.query(`SELECT d.*,m.title milestone_title,m.sort_order milestone_order FROM consultation_documents d JOIN consultation_milestones m ON m.id=d.milestone_id ORDER BY d.report_date DESC,d.id DESC`)]);res.json({milestones:milestones.rows,documents:documents.rows})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar el seguimiento de la consultoría.'})}});
app.get('/api/admin/consultation/summary',auth,async(req,res)=>{try{const [counts,current,docs]=await Promise.all([pool.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER (WHERE status='completado')::int completed FROM consultation_milestones`),pool.query(`SELECT * FROM consultation_milestones WHERE status='en_curso' ORDER BY sort_order LIMIT 1`),pool.query('SELECT COUNT(*)::int count FROM consultation_documents')]);const c=counts.rows[0];res.json({total:c.total,completed:c.completed,current:current.rows[0]||null,documents:docs.rows[0].count,progress:c.total?Math.round(c.completed*100/c.total):0})}catch(e){console.error(e);res.status(500).json({error:'No se pudo cargar el avance de la consultoría.'})}});
app.post('/api/admin/consultation/progress',auth,async(req,res)=>{const order=Number(req.body.current_order);if(!Number.isInteger(order)||order<1||order>7)return res.status(400).json({error:'Etapa inválida.'});try{await pool.query(`UPDATE consultation_milestones SET status=CASE WHEN sort_order<$1 OR $1=7 THEN 'completado' WHEN sort_order=$1 THEN 'en_curso' ELSE 'pendiente' END,completed_at=CASE WHEN sort_order<$1 OR $1=7 THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW()`,[order]);res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:'No se pudo actualizar el avance.'})}});
app.post('/api/admin/consultation/documents',auth,async(req,res)=>{const b=req.body;if(!b.milestone_id||!b.title||!b.document_type||!b.file_url)return res.status(400).json({error:'Hito, título, tipo y enlace son obligatorios.'});if(!/^https?:\/\//i.test(b.file_url))return res.status(400).json({error:'El enlace debe comenzar con http:// o https://'});try{const r=await pool.query(`INSERT INTO consultation_documents(milestone_id,title,document_type,file_url,report_date,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[b.milestone_id,b.title,b.document_type,b.file_url,b.report_date||new Date().toISOString().slice(0,10),b.status||'entregado',b.notes||null]);res.status(201).json({item:r.rows[0]})}catch(e){console.error(e);res.status(500).json({error:'No se pudo registrar el informe.'})}});
app.delete('/api/admin/consultation/documents/:id',auth,async(req,res)=>{try{await pool.query('DELETE FROM consultation_documents WHERE id=$1',[req.params.id]);res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:'No se pudo eliminar el informe.'})}});
app.post('/api/admin/weekly_menus',auth,async(req,res)=>{const c=await pool.connect();try{const {week_start,week_end,notes,days}=req.body;if(!week_start||!week_end)return res.status(400).json({error:'Faltan fechas.'}); await c.query('BEGIN'); const w=await c.query('INSERT INTO weekly_menus(week_start,week_end,notes) VALUES($1,$2,$3) RETURNING *',[week_start,week_end,notes||null]); for(const d of days||[]) await c.query('INSERT INTO weekly_menu_days(weekly_menu_id,day_name,menu_date,title,planned_portions,notes) VALUES($1,$2,$3,$4,$5,$6)',[w.rows[0].id,d.day_name,d.menu_date||null,d.title||null,Number(d.planned_portions||0),d.notes||null]); await c.query('COMMIT'); res.status(201).json({item:w.rows[0]})}catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'No se pudo guardar minuta.'})}finally{c.release()}});
app.get('/api/admin/weekly_menus',auth,async(req,res)=>{const w=await pool.query('SELECT * FROM weekly_menus ORDER BY week_start DESC LIMIT 50');const full=[];for(const x of w.rows){const d=await pool.query('SELECT * FROM weekly_menu_days WHERE weekly_menu_id=$1 ORDER BY id',[x.id]);full.push({...x,days:d.rows})}res.json({items:full})}); app.delete('/api/admin/weekly_menus/:id',auth,async(req,res)=>{await pool.query('DELETE FROM weekly_menus WHERE id=$1',[req.params.id]);res.json({ok:true})});
app.post('/api/admin/rations',auth,async(req,res)=>{const b=req.body, portions=Number(b.planned_portions||0), total=int(b.estimated_total_cost), price=int(b.sale_price), cpp=portions>0?Math.round(total/portions):0;const r=await pool.query('INSERT INTO rations(ration_date,title,planned_portions,estimated_total_cost,estimated_cost_per_portion,sale_price,estimated_margin,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[b.ration_date||new Date().toISOString().slice(0,10),b.title,portions,total,cpp,price,price-cpp,b.notes||null]);res.status(201).json({item:r.rows[0]})}); app.get('/api/admin/rations',auth,async(req,res)=>{const r=await pool.query('SELECT * FROM rations ORDER BY ration_date DESC,id DESC LIMIT 100');res.json({items:r.rows})}); app.delete('/api/admin/rations/:id',auth,async(req,res)=>{await pool.query('DELETE FROM rations WHERE id=$1',[req.params.id]);res.json({ok:true})});
pool.query(schema).then(()=>app.listen(PORT,()=>console.log(`CM Banquetería Admin corriendo en ${SITE_URL}`))).catch(e=>{console.error('No se pudo inicializar Neon/Postgres:',e);process.exit(1)});
