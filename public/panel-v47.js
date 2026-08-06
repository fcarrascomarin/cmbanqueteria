/* CM Banquetería · experiencia administrativa diaria, contraste y documentos v47 */

const CM_V47_DOCUMENTS={
  sanitary:[
    {title:'Manual sanitario base',description:'Guía para preparar la actualización sanitaria, la carpeta de respaldo y una eventual visita inspectiva.',url:'/docs/cm/CM-SAN-001-Manual-sanitario-base.pdf',meta:'15 páginas · Carpeta sanitaria'},
    {title:'Checklist sanitario operativo por zonas',description:'Autoevaluación de ocho bloques para recorrer el local, registrar brechas y definir acciones.',url:'/docs/cm/CM-SAN-002-Checklist-sanitario-operativo.pdf',meta:'8 páginas · Uso periódico'}
  ],
  operational:[
    {title:'Programa de limpieza: cocina y bodega',description:'Métodos, productos, frecuencia, EPP y responsables para horno, cocina, campana y utensilios.',url:'/docs/cm/CM-OPS-001-Limpieza-cocina-bodega.pdf',meta:'Documento operacional'},
    {title:'Programa de limpieza: comedores',description:'Rutinas para mesas, alcuzas, pisos, terraza y refrigeradores del comedor.',url:'/docs/cm/CM-OPS-003-Limpieza-comedores.pdf',meta:'Documento operacional'},
    {title:'Entrega de uniformes',description:'Registro interno de entrega, talla, cantidad y conformidad de cada colaboradora.',url:'/docs/cm/CM-OPS-002-Entrega-uniformes.pdf',meta:'Documento de personal'},
    {title:'Formatos internos de control',description:'Charla de cinco minutos, control de temperaturas de frío y control de cocción de productos cárnicos.',url:'/docs/cm/CM-OPS-004-Formatos-internos.pdf',meta:'3 formularios operacionales'}
  ]
};

function cmV47Date(value){return String(value||'').slice(0,10)}
function cmV47Today(){return new Date().toISOString().slice(0,10)}
function cmV47IsToday(value){return cmV47Date(value)===cmV47Today()}
function cmV47Status(label,tone='neutral',detail=''){
  return `<article class="cm-v47-status ${tone}"><span class="cm-v47-status-dot" aria-hidden="true"></span><div><strong>${safe(label)}</strong>${detail?`<small>${safe(detail)}</small>`:''}</div></article>`;
}
function cmV47DocCard(doc){
  return `<article class="cm-v47-doc-card"><div class="cm-v47-doc-icon"><span class="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span></div><div><span>${safe(doc.meta)}</span><h4>${safe(doc.title)}</h4><p>${safe(doc.description)}</p><div class="row-actions"><a class="btn btn-secondary btn-small" href="${safe(doc.url)}" target="_blank" rel="noopener"><span class="material-symbols-rounded" aria-hidden="true">visibility</span> Abrir</a><a class="btn btn-secondary btn-small" href="${safe(doc.url)}" download><span class="material-symbols-rounded" aria-hidden="true">download</span> Descargar</a></div></div></article>`;
}
function cmV47EmptyAction(title,text,buttonLabel,onclick){
  return `<div class="cm-v47-empty-action"><span class="material-symbols-rounded" aria-hidden="true">task_alt</span><div><strong>${safe(title)}</strong><p>${safe(text)}</p></div><button class="btn btn-secondary btn-small" type="button" onclick="${onclick}">${safe(buttonLabel)}</button></div>`;
}

// Inicio orientado a la jornada: sin montos ni contadores históricos.
dashboard=async function(){
  const month=new Date().toISOString().slice(0,7);
  const [d,ordersData,messagesData,dailyData]=await Promise.all([
    api('/api/admin/dashboard'),
    api('/api/admin/restaurant_orders'),
    api('/api/admin/screen_messages'),
    api(`/api/admin/daily-financials?month=${month}`)
  ]);
  const today=cmV47Today();
  const orders=(ordersData.items||[]).filter(x=>cmV47Date(x.order_date)===today&&!['entregado','cancelado'].includes(x.status));
  const upcoming=(ordersData.items||[]).filter(x=>cmV47Date(x.order_date)>=today&&!['entregado','cancelado'].includes(x.status)).slice(0,4);
  const messages=(messagesData.items||[]).filter(x=>x.active&&(!x.expires_at||new Date(x.expires_at)>new Date())).slice(0,3);
  const financial=(dailyData.items||[]).find(x=>cmV47Date(x.financial_date)===today);
  const menuReady=Boolean(d.todayMenu);
  const costReady=Boolean(financial);
  const operationReady=orders.length>0;
  const messageReady=messages.length>0;
  const menuText=menuReady?`${d.todayMenu.option_1||d.todayMenu.main_dish||d.todayMenu.title||'Menú publicado'}`:'Publicar las opciones antes del horario de almuerzo';
  const ordersText=operationReady?`${orders.length} reserva${orders.length===1?'':'s'} o retiro${orders.length===1?'':'s'} en curso`:'Canal listo para registrar reservas, retiros o entregas';
  const costText=costReady?'Jornada guardada y disponible para revisión':'Registrar la jornada al cierre o cuando estén consolidados los datos';
  content.innerHTML=`
    <section class="cm-v47-home-hero">
      <div><div class="kicker">CENTRO DE OPERACIÓN DIARIA</div><h3>Lo importante para hoy</h3><p>Registra la jornada, comunica instrucciones a cocina y mantén a mano los documentos que sostienen el funcionamiento del restaurant.</p></div>
      <div class="cm-v47-home-date"><span>${new Intl.DateTimeFormat('es-CL',{weekday:'long'}).format(new Date())}</span><strong>${new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'long'}).format(new Date())}</strong></div>
    </section>
    <section class="cm-v47-primary-actions" aria-label="Acciones principales">
      <button class="cm-v47-action primary" type="button" onclick="renderView('dailyCosts')"><span class="material-symbols-rounded">monitoring</span><div><strong>${costReady?'Revisar costos de hoy':'Registrar costos de hoy'}</strong><small>Ingreso, clientes, alimentos, personal y resultado</small></div></button>
      <button class="cm-v47-action primary" type="button" onclick="renderView('menus')"><span class="material-symbols-rounded">restaurant_menu</span><div><strong>${menuReady?'Revisar menú publicado':'Publicar menú del día'}</strong><small>Opciones visibles en la web y pantalla interna</small></div></button>
      <button class="cm-v47-action secondary" type="button" onclick="openRestaurantOrderForm()"><span class="material-symbols-rounded">event_available</span><div><strong>Nueva reserva o retiro</strong><small>Información clara para cocina y atención</small></div></button>
      <button class="cm-v47-action secondary" type="button" onclick="openScreenMessageForm()"><span class="material-symbols-rounded">campaign</span><div><strong>Mensaje a cocina</strong><small>Indicación visible en la pantalla interna</small></div></button>
    </section>
    <div class="cm-v47-home-grid">
      <section class="cm-v47-panel cm-v47-panel-priority">
        <header><div><span>SEGUIMIENTO DE LA JORNADA</span><h3>Estado operativo</h3></div><button class="btn btn-secondary btn-small" type="button" onclick="renderView('operations')">Abrir Restaurant</button></header>
        <div class="cm-v47-status-list">
          ${cmV47Status(menuReady?'Menú disponible':'Preparar menú del día',menuReady?'good':'attention',menuText)}
          ${cmV47Status(costReady?'Costos registrados':'Registro de costos pendiente de cierre',costReady?'good':'attention',costText)}
          ${cmV47Status(operationReady?'Servicio con movimientos':'Reservas y retiros disponibles','neutral',ordersText)}
        </div>
      </section>
      <section class="cm-v47-panel cm-v47-communication-panel">
        <header><div><span>COMUNICACIÓN INTERNA</span><h3>Pantalla de cocina</h3></div><a class="btn btn-secondary btn-small" href="/pantalla.html" target="_blank" rel="noopener">Abrir pantalla</a></header>
        <p class="cm-v47-panel-intro">Envía instrucciones breves para cocina, atención o todo el equipo. La pantalla se actualiza automáticamente.</p>
        <div class="cm-v47-message-preview">${messages.length?messages.map(m=>`<article class="${safe(m.priority)}"><span>${safe(m.audience)}</span><strong>${safe(m.title)}</strong><p>${safe(m.body)}</p></article>`).join(''):cmV47EmptyAction('Canal disponible','La pantalla está preparada para recibir una instrucción de la jornada.','Crear mensaje','openScreenMessageForm()')}</div>
      </section>
      <section class="cm-v47-panel">
        <header><div><span>PRÓXIMOS MOVIMIENTOS</span><h3>Reservas y retiros</h3></div><button class="btn btn-secondary btn-small" type="button" onclick="renderView('operations')">Ver agenda</button></header>
        <div class="cm-v47-upcoming">${upcoming.length?upcoming.map(o=>`<article><time>${fmtDate(o.order_date)} · ${String(o.order_time||'').slice(0,5)}</time><strong>${safe(o.customer_name)}</strong><span>${safe(o.service_type==='mesa'?'Mesa / reserva':o.service_type==='retiro'?'Retiro':'Entrega')} · ${safe(o.menu_summary||'Detalle en ficha')}</span></article>`).join(''):cmV47EmptyAction('Agenda preparada','Registra una reserva o retiro para que el equipo la vea en el módulo Restaurant.','Registrar','openRestaurantOrderForm()')}</div>
      </section>
      <section class="cm-v47-panel cm-v47-doc-shortcuts">
        <header><div><span>DOCUMENTOS ESENCIALES</span><h3>Carpeta de uso diario</h3></div><button class="btn btn-secondary btn-small" type="button" onclick="renderView('documents')">Abrir carpeta</button></header>
        <a href="/docs/cm/CM-SAN-002-Checklist-sanitario-operativo.pdf" target="_blank"><span class="material-symbols-rounded">checklist</span><div><strong>Checklist sanitario</strong><small>Recorrido por zonas y registro de brechas</small></div></a>
        <a href="/docs/cm/CM-OPS-004-Formatos-internos.pdf" target="_blank"><span class="material-symbols-rounded">fact_check</span><div><strong>Registros operacionales</strong><small>Charlas y controles de temperatura</small></div></a>
        <a href="/docs/cm/CM-SAN-001-Manual-sanitario-base.pdf" target="_blank"><span class="material-symbols-rounded">menu_book</span><div><strong>Manual sanitario</strong><small>Preparación documental y sanitaria</small></div></a>
      </section>
    </div>`;
};

// Reservas y mensajes: todo el contenido se presenta sobre superficies opacas y jerarquizadas.
operations=async function(){
  addAction('Nueva reserva / retiro',()=>openRestaurantOrderForm());
  addAction('Mensaje a pantalla',()=>openScreenMessageForm());
  const [ordersData,messagesData]=await Promise.all([api('/api/admin/restaurant_orders'),api('/api/admin/screen_messages')]);
  cache.restaurantOrders=ordersData.items||[];
  const today=cmV47Today();
  const todayOrders=(ordersData.items||[]).filter(o=>cmV47Date(o.order_date)===today);
  const activeMessages=(messagesData.items||[]).filter(m=>m.active);
  const orderCards=todayOrders.map(o=>{
    const tone=o.status==='listo'?'ready':o.status==='entregado'?'done':o.status==='cancelado'?'cancelled':o.status==='en_preparacion'?'prep':'confirmed';
    const serviceLabel=o.service_type==='mesa'?'Mesa / reserva':o.service_type==='retiro'?'Retiro':'Entrega';
    return `<article class="cm-v47-order-card ${tone}"><div class="cm-v47-order-time"><strong>${String(o.order_time||'--:--').slice(0,5)}</strong><span>${safe(serviceLabel)}</span></div><div class="cm-v47-order-body"><div><h4>${safe(o.customer_name)}</h4><span class="badge ${o.status==='listo'?'green':o.status==='cancelado'?'red':'blue'}">${safe(o.status.replaceAll('_',' '))}</span></div><p>${safe(o.menu_summary||'Pedido sin detalle')} · ${Number(o.quantity||1)} menú(s)${o.party_size?` · ${o.party_size} personas`:''}</p>${o.table_name?`<small>Mesa / referencia: ${safe(o.table_name)}</small>`:''}${o.assigned_to?`<small>Responsable: ${safe(o.assigned_to)}</small>`:''}${o.notes?`<em>${safe(o.notes)}</em>`:''}</div><div class="cm-v47-order-actions"><button class="btn btn-secondary btn-small" onclick="openRestaurantOrderForm(${o.id})">Editar</button><button class="btn btn-secondary btn-small" onclick="updateRestaurantOrder(${o.id},'en_preparacion')">Preparación</button><button class="btn btn-secondary btn-small" onclick="updateRestaurantOrder(${o.id},'listo')">Listo</button><button class="btn btn-primary btn-small" onclick="updateRestaurantOrder(${o.id},'entregado')">Entregado</button></div></article>`;
  }).join('');
  const messageRows=activeMessages.map(m=>`<tr><td>${fmtDate(m.message_date)}</td><td><span class="cm-v47-audience">${safe(m.audience)}</span></td><td><strong>${safe(m.title)}</strong><br><small>${safe(m.body)}</small></td><td><span class="badge ${m.priority==='urgente'?'red':m.priority==='importante'?'blue':'green'}">${safe(m.priority)}</span></td><td class="row-actions"><button class="btn btn-secondary btn-small" onclick="toggleScreenMessage(${m.id},false)">Ocultar</button><button class="btn btn-danger btn-small" onclick="removeRow('screen_messages',${m.id})">Eliminar</button></td></tr>`);
  content.innerHTML=`<section class="cm-v47-page-intro"><div><div class="kicker">RESTAURANT</div><h3>Reservas, retiros y comunicación con cocina</h3><p>Ordena la información de la jornada y compártela con el equipo mediante la pantalla interna. Cada acción tiene un lugar claro y un estado visible.</p></div><a class="cm-v47-screen-link" href="/pantalla.html" target="_blank" rel="noopener"><span class="material-symbols-rounded">desktop_windows</span><div><strong>Abrir pantalla de cocina</strong><small>Vista para compartir en tablet o TV</small></div></a></section>
  <div class="cm-v47-operations-layout"><section class="cm-v47-content-panel cm-v47-orders-panel"><header><div><span>HOY</span><h3>Reservas, retiros y despacho</h3></div><button class="btn btn-primary btn-small" type="button" onclick="openRestaurantOrderForm()">Registrar movimiento</button></header><div class="cm-v47-order-list">${orderCards||cmV47EmptyAction('Jornada lista para organizar','Registra reservas, retiros o entregas y asígnalas al equipo.','Nueva reserva / retiro','openRestaurantOrderForm()')}</div></section>
  <section class="cm-v47-content-panel cm-v47-messages-panel"><header><div><span>INDICACIONES ACTIVAS</span><h3>Mensajes para el equipo</h3></div><button class="btn btn-primary btn-small" type="button" onclick="openScreenMessageForm()">Crear mensaje</button></header><p class="cm-v47-panel-intro">Los mensajes activos aparecen automáticamente en la pantalla de cocina.</p>${messageRows.length?table(['Fecha','Audiencia','Mensaje','Prioridad','Acciones'],messageRows):cmV47EmptyAction('Canal listo para usar','Crea una indicación breve para cocina, atención o todo el equipo.','Nuevo mensaje','openScreenMessageForm()')}</section></div>`;
};

// Personal: funciones visibles, editables y exportables.
openStaffForm=function(id=null){
  const p=id?(cache.staff||[]).find(x=>Number(x.id)===Number(id)):null;
  openForm(p?'Editar ficha de personal':'Agregar personal',`<div class="two-cols">${field('full_name','Nombre completo','text',safe(p?.full_name||''),'required')}${field('rut','RUT','text',safe(p?.rut||''))}</div><div class="two-cols">${field('role','Cargo','text',safe(p?.role||''))}${field('phone','Teléfono','text',safe(p?.phone||''))}</div><div class="two-cols">${field('start_date','Fecha ingreso','date',String(p?.start_date||'').slice(0,10))}${field('contract_type','Tipo contrato','text',safe(p?.contract_type||''))}</div><div class="two-cols">${field('schedule','Jornada / horario','text',safe(p?.schedule||''))}${selectField('status','Estado',['activo','pendiente','inactivo'],p?.status||'activo')}</div>${textArea('assigned_tasks','Funciones y tareas asignadas',safe(p?.assigned_tasks||''))}${textArea('notes','Observaciones / documentos pendientes',safe(p?.notes||''))}<div class="notice"><strong>Ficha editable.</strong> Actualiza las tareas cuando cambie la distribución del trabajo. Las responsabilidades iniciales provienen de los programas internos de limpieza y sanitización.</div>`,async e=>{e.preventDefault();await api(p?`/api/admin/staff/${p.id}`:'/api/admin/staff',{method:p?'PATCH':'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget).entries()))});modal.close();staff()});
};
window.openStaffForm=openStaffForm;
staff=async function(){
  addAction('Agregar persona',()=>openStaffForm());
  addAction('Descargar Excel',()=>{location.href='/api/admin/staff.xlsx'});
  const d=await api('/api/admin/staff');cache.staff=d.items||[];
  const cards=d.items.map(x=>`<article class="cm-v47-staff-card"><div class="cm-v47-staff-head"><span class="material-symbols-rounded" aria-hidden="true">person</span><div><strong>${safe(x.full_name)}</strong><small>${safe(x.role||'Función por definir')}</small></div><span class="badge ${x.status==='activo'?'green':x.status==='pendiente'?'blue':'red'}">${safe(x.status)}</span></div><p>${safe(x.assigned_tasks||'Las funciones pueden completarse y actualizarse desde la ficha.')}</p><div class="row-actions"><button class="btn btn-secondary btn-small" onclick="openStaffForm(${x.id})">Editar ficha</button></div></article>`).join('');
  content.innerHTML=`<section class="cm-v47-page-intro"><div><div class="kicker">GESTIÓN INTERNA</div><h3>Personal y distribución de tareas</h3><p>Consulta quién realiza cada función, actualiza responsabilidades y conserva la información necesaria para la operación y los registros laborales.</p></div><a class="cm-v47-excel-link" href="/api/admin/staff.xlsx"><span class="material-symbols-rounded">table_view</span><div><strong>Descargar tabla Excel</strong><small>Ficha completa del personal</small></div></a></section><section class="cm-v47-staff-grid">${cards}</section><section class="cm-v47-content-panel"><header><div><span>FICHAS EDITABLES</span><h3>Información del equipo</h3></div></header>${table(['Nombre','Cargo','RUT','Teléfono','Ingreso','Contrato','Jornada','Funciones y tareas','Estado','Acciones'],d.items.map(x=>`<tr><td><strong>${safe(x.full_name)}</strong></td><td>${safe(x.role||'')}</td><td>${safe(x.rut||'')}</td><td>${safe(x.phone||'')}</td><td>${x.start_date?fmtDate(x.start_date):''}</td><td>${safe(x.contract_type||'')}</td><td>${safe(x.schedule||'')}</td><td class="cm-v47-task-cell">${safe(x.assigned_tasks||'')}</td><td><span class="badge ${x.status==='activo'?'green':x.status==='pendiente'?'blue':'red'}">${safe(x.status)}</span></td><td class="row-actions"><button class="btn btn-secondary btn-small" onclick="openStaffForm(${x.id})">Editar</button><button class="btn btn-danger btn-small" onclick="removeRow('staff',${x.id})">Eliminar</button></td></tr>`))}</section>`;
};

// Proveedores: estructura visual equivalente al resto del panel y exportación Excel.
suppliers=async function(){
  addAction('Agregar proveedor',()=>openSupplierForm());
  addAction('Descargar Excel',()=>{location.href='/api/admin/suppliers.xlsx'});
  const data=await api('/api/admin/suppliers');cache.suppliers=data.items||[];
  const cards=data.items.map(s=>`<article class="cm-v47-supplier-card" data-cm-supplier-search="${safe([s.name,s.rut,s.business_type,s.usual_products,s.contact_name].filter(Boolean).join(' ').toLowerCase())}"><div class="cm-v47-supplier-icon"><span class="material-symbols-rounded">local_shipping</span></div><div><span>${safe(s.business_type||'Proveedor habitual')}</span><h4>${safe(s.name)}</h4><p>${safe(s.usual_products||'Productos habituales por completar')}</p><small>${safe([s.contact_name,s.phone,s.email].filter(Boolean).join(' · ')||'Contacto por completar')}</small><div class="row-actions"><button class="btn btn-secondary btn-small" type="button" onclick="openSupplierDetail(${s.id})">Ver ficha</button><button class="btn btn-secondary btn-small" type="button" onclick="editSupplier(${s.id})">Editar</button></div></div></article>`).join('');
  content.innerHTML=`<section class="cm-v47-page-intro"><div><div class="kicker">GESTIÓN INTERNA</div><h3>Proveedores habituales</h3><p>Mantén contacto, rubro, productos frecuentes e historial de cada proveedor en una ficha fácil de revisar y descargar.</p></div><a class="cm-v47-excel-link" href="/api/admin/suppliers.xlsx"><span class="material-symbols-rounded">table_view</span><div><strong>Descargar tabla Excel</strong><small>Proveedores y antecedentes</small></div></a></section><section class="cm-v47-supplier-tools"><label><span class="material-symbols-rounded">search</span><input id="cmSupplierSearch" type="search" placeholder="Buscar por proveedor, RUT, rubro o producto" oninput="filterCmV47Suppliers(this.value)"></label><button class="btn btn-primary" type="button" onclick="openSupplierForm()">Agregar proveedor</button></section><section id="cmV47SupplierGrid" class="cm-v47-supplier-grid">${cards}</section><section class="cm-v47-content-panel"><header><div><span>VISTA TABULAR</span><h3>Control de proveedores</h3></div></header>${table(['Proveedor','RUT','Rubro','Productos habituales','Contacto','Última compra','Acciones'],data.items.map(s=>`<tr data-cm-supplier-row="${safe([s.name,s.rut,s.business_type,s.usual_products,s.contact_name].filter(Boolean).join(' ').toLowerCase())}"><td><strong>${safe(s.name)}</strong></td><td>${safe(s.rut||'')}</td><td>${safe(s.business_type||'')}</td><td>${safe(s.usual_products||'')}</td><td>${supplierContactSummary(s)}</td><td>${fmtDate(s.last_purchase_date)}</td><td class="row-actions"><button class="btn btn-secondary btn-small" type="button" onclick="openSupplierDetail(${s.id})">Ficha</button><button class="btn btn-secondary btn-small" type="button" onclick="editSupplier(${s.id})">Editar</button></td></tr>`))}</section>`;
};
window.filterCmV47Suppliers=value=>{const q=String(value||'').trim().toLowerCase();document.querySelectorAll('[data-cm-supplier-search]').forEach(el=>el.hidden=q&&!el.dataset.cmSupplierSearch.includes(q));document.querySelectorAll('[data-cm-supplier-row]').forEach(el=>el.hidden=q&&!el.dataset.cmSupplierRow.includes(q));};

// Carpeta documental con dos niveles claros: sanitario y operacional.
openCmDocumentForm=function(){
  openForm('Agregar documento',`<div class="two-cols">${field('title','Nombre del documento','text','','required')}${field('document_type','Tipo de documento','text','','required')}</div><div class="two-cols"><div class="form-line"><label>Carpeta</label><select name="owner_type"><option>Carpeta sanitaria</option><option>Documentos operacionales</option><option>Municipal</option><option>Tributario</option><option>Laboral</option><option>Proveedores</option><option>Web y tecnología</option><option selected>Empresa / general</option></select></div>${field('document_date','Fecha del documento','date')}</div><div class="two-cols">${field('expiration_date','Fecha de vencimiento','date')}${field('file_url','Enlace a Drive o archivo','url','','placeholder="https://..."')}</div>${textArea('notes','Notas / ubicación física')}<div class="notice">Los documentos base ya incluidos se descargan directamente desde el panel. Para nuevos archivos, registra el enlace de la carpeta oficial de CM.</div>`,async e=>{e.preventDefault();await api('/api/admin/documents',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget).entries()))});modal.close();documents()});
};
window.openCmDocumentForm=openCmDocumentForm;
documents=async function(){
  addAction('Agregar documento',()=>openCmDocumentForm());
  const d=await api('/api/admin/documents');cache.documents=d.items||[];
  content.innerHTML=`<section class="cm-v47-page-intro"><div><div class="kicker">GESTIÓN INTERNA</div><h3>Carpeta sanitaria y documentos operacionales</h3><p>Este es el punto de acceso a los manuales, checklists y registros que CM necesita para trabajar, respaldar su operación y preparar revisiones.</p></div><div class="cm-v47-folder-mark"><span class="material-symbols-rounded">folder_open</span><strong>Documentación CM</strong></div></section><section class="cm-v47-doc-section"><header><div><span>CARPETA SANITARIA</span><h3>Preparación, control y revisión</h3></div></header><div class="cm-v47-doc-grid">${CM_V47_DOCUMENTS.sanitary.map(cmV47DocCard).join('')}</div></section><section class="cm-v47-doc-section"><header><div><span>DOCUMENTOS OPERACIONALES</span><h3>Registros para el funcionamiento diario</h3></div></header><div class="cm-v47-doc-grid">${CM_V47_DOCUMENTS.operational.map(cmV47DocCard).join('')}</div></section><section class="cm-v47-content-panel"><header><div><span>DOCUMENTOS AGREGADOS POR CM</span><h3>Enlaces, certificados y vencimientos</h3></div><button class="btn btn-primary btn-small" type="button" onclick="openCmDocumentForm()">Agregar documento</button></header>${table(['Documento','Carpeta','Tipo','Fecha','Vencimiento','Archivo','Notas','Acciones'],d.items.map(x=>`<tr><td><strong>${safe(x.title)}</strong></td><td>${safe(x.owner_type||'Empresa / general')}</td><td>${safe(x.document_type)}</td><td>${fmtDate(x.document_date)}</td><td>${x.expiration_date?`<span class="badge red">${fmtDate(x.expiration_date)}</span>`:''}</td><td>${x.file_url?`<a class="btn btn-secondary btn-small" href="${safe(x.file_url)}" target="_blank" rel="noopener">Abrir</a>`:'-'}</td><td>${safe(x.notes||'')}</td><td><button class="btn btn-danger btn-small" type="button" onclick="removeRow('documents',${x.id})">Eliminar</button></td></tr>`))}</section>`;
};

// Ajusta títulos y cache busting visual después de cargar el módulo.
cfg.dashboard=['INICIO','Inicio'];
cfg.operations=['RESTAURANT','Reservas / Cocina'];
cfg.staff=['GESTIÓN INTERNA','Personal'];
cfg.suppliers=['GESTIÓN INTERNA','Proveedores'];
cfg.documents=['GESTIÓN INTERNA','Carpeta documental'];
requestAnimationFrame(()=>window.cmAdminAfterRender?.());
