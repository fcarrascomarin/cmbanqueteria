/* CM Banquetería · Costos diarios y traspaso administrador · v40 */
let cmCostsMonth=new Date().toISOString().slice(0,7);
let cmDailyCostCache=[];
let cmMonthlyCostCache=[];

cfg.dailyCosts=['Costos y resultados','Costos diarios'];
cfg.documents=['Documentación','Carpeta sanitaria y documental'];
viewGroupMap.dailyCosts='compras-stock';
try{CM_ADMIN_VIEW_ICONS.dailyCosts='monitoring';CM_ADMIN_VIEW_ICONS.documents='folder_open'}catch(_e){}

function cmCostEsc(value){return String(value??'').replace(/[&<>\"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]))}
function cmCostNum(value){const n=Number(value||0);return Number.isFinite(n)?n:0}
function cmCostDate(value){return String(value||'').slice(0,10)}
function cmCostMonthName(value){
  if(!/^\d{4}-\d{2}$/.test(String(value||'')))return value||'';
  const [y,m]=value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CL',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1)));
}
function cmCostPct(value){return `${new Intl.NumberFormat('es-CL',{maximumFractionDigits:1}).format(cmCostNum(value))}%`}
function cmCostAction(icon,label,onclick,kind='secondary'){
  return `<button class="btn btn-${kind} cm-cost-action" type="button" data-cm-decorated-v23="1" onclick="${onclick}"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span><span>${cmCostEsc(label)}</span></button>`;
}
function cmCostStat(icon,label,value,help=''){
  return `<article class="cm-cost-stat"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span><small>${cmCostEsc(label)}</small><strong>${value}</strong>${help?`<em>${cmCostEsc(help)}</em>`:''}</article>`;
}
function cmCostLineChart(rows){
  const W=920,H=360,p={l:76,r:34,t:38,b:58};
  if(!rows.length)return `<div class="cm-chart-empty">Aún no hay datos diarios para este mes.</div>`;
  const series=[
    {key:'income',label:'Ingreso',color:'#c92d52'},
    {key:'food_cost',label:'Costo alimentos',color:'#620907'},
    {key:'net',label:'Neto',color:'#8a827e'}
  ];
  const values=rows.flatMap(r=>series.map(s=>cmCostNum(r[s.key])));
  let min=Math.min(0,...values),max=Math.max(1,...values);
  const pad=(max-min)*.08||1;min-=pad;max+=pad;
  const x=i=>p.l+(rows.length===1?(W-p.l-p.r)/2:i*(W-p.l-p.r)/(rows.length-1));
  const y=v=>p.t+(max-v)*(H-p.t-p.b)/(max-min);
  const ticks=5;
  const grid=Array.from({length:ticks+1},(_,i)=>{
    const val=max-(max-min)*i/ticks,yy=y(val);
    return `<line x1="${p.l}" x2="${W-p.r}" y1="${yy}" y2="${yy}" class="cm-chart-grid"/><text x="${p.l-12}" y="${yy+4}" text-anchor="end" class="cm-chart-axis">${Math.round(val/1000)}k</text>`;
  }).join('');
  const paths=series.map(s=>{
    const points=rows.map((r,i)=>`${x(i)},${y(cmCostNum(r[s.key]))}`).join(' ');
    const dots=rows.map((r,i)=>`<circle cx="${x(i)}" cy="${y(cmCostNum(r[s.key]))}" r="3.2" fill="${s.color}"><title>${s.label}: ${money(r[s.key])}</title></circle>`).join('');
    return `<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join('');
  const labels=rows.map((r,i)=>`<text x="${x(i)}" y="${H-p.b+24}" text-anchor="middle" class="cm-chart-axis cm-chart-date">${cmCostDate(r.financial_date).slice(8,10)}</text>`).join('');
  const legend=series.map((s,i)=>`<g transform="translate(${p.l+i*190},18)"><line x1="0" x2="28" y1="0" y2="0" stroke="${s.color}" stroke-width="4"/><text x="38" y="5" class="cm-chart-legend">${s.label}</text></g>`).join('');
  return `<svg id="cmDailyChart" class="cm-cost-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos, costos y neto diario de ${cmCostMonthName(cmCostsMonth)}"><rect width="${W}" height="${H}" rx="22" fill="#fffaf6"/>${legend}${grid}<line x1="${p.l}" x2="${W-p.r}" y1="${y(0)}" y2="${y(0)}" class="cm-chart-zero"/>${paths}${labels}<text x="${(p.l+W-p.r)/2}" y="${H-10}" text-anchor="middle" class="cm-chart-title">Día del mes</text></svg>`;
}
function cmCostMonthlyChart(rows){
  const W=920,H=360,p={l:64,r:64,t:44,b:66};
  if(!rows.length)return `<div class="cm-chart-empty">El gráfico mensual se construirá automáticamente con los registros diarios.</div>`;
  const maxClients=Math.max(10,...rows.map(r=>cmCostNum(r.customers_average)))*1.12;
  const maxPct=Math.max(50,...rows.map(r=>cmCostNum(r.cost_percentage)))*1.12;
  const band=(W-p.l-p.r)/rows.length,barW=Math.min(64,band*.52);
  const yClients=v=>p.t+(maxClients-v)*(H-p.t-p.b)/maxClients;
  const yPct=v=>p.t+(maxPct-v)*(H-p.t-p.b)/maxPct;
  const grid=Array.from({length:6},(_,i)=>{
    const v=maxClients*(5-i)/5,yy=yClients(v);
    return `<line x1="${p.l}" x2="${W-p.r}" y1="${yy}" y2="${yy}" class="cm-chart-grid"/><text x="${p.l-10}" y="${yy+4}" text-anchor="end" class="cm-chart-axis">${Math.round(v)}</text>`;
  }).join('');
  const bars=rows.map((r,i)=>{
    const cx=p.l+band*(i+.5),v=cmCostNum(r.customers_average),yy=yClients(v),h=H-p.b-yy;
    return `<rect x="${cx-barW/2}" y="${yy}" width="${barW}" height="${Math.max(0,h)}" rx="8" fill="#620907"><title>Clientes promedio: ${v}</title></rect><text x="${cx}" y="${H-p.b+24}" text-anchor="middle" class="cm-chart-axis">${cmCostEsc(cmCostMonthName(r.month).split(' ')[0].slice(0,3))}</text>`;
  }).join('');
  const linePts=rows.map((r,i)=>`${p.l+band*(i+.5)},${yPct(cmCostNum(r.cost_percentage))}`).join(' ');
  const dots=rows.map((r,i)=>{const cx=p.l+band*(i+.5),cy=yPct(cmCostNum(r.cost_percentage));return `<circle cx="${cx}" cy="${cy}" r="5" fill="#c92d52"><title>Costo promedio: ${cmCostPct(r.cost_percentage)}</title></circle>`}).join('');
  const rightLabels=Array.from({length:6},(_,i)=>{const v=maxPct*(5-i)/5,yy=yPct(v);return `<text x="${W-p.r+10}" y="${yy+4}" text-anchor="start" class="cm-chart-axis">${Math.round(v)}%</text>`}).join('');
  return `<svg id="cmMonthlyChart" class="cm-cost-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Clientes promedio y porcentaje de costo por mes"><rect width="${W}" height="${H}" rx="22" fill="#fffaf6"/><g transform="translate(${p.l},20)"><rect width="18" height="12" rx="3" fill="#620907"/><text x="28" y="11" class="cm-chart-legend">Clientes promedio</text><line x1="190" x2="220" y1="6" y2="6" stroke="#c92d52" stroke-width="4"/><text x="230" y="11" class="cm-chart-legend">Costo promedio</text></g>${grid}${rightLabels}${bars}<polyline points="${linePts}" fill="none" stroke="#c92d52" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}<text x="${(p.l+W-p.r)/2}" y="${H-12}" text-anchor="middle" class="cm-chart-title">Mes</text></svg>`;
}
function cmCostAggregate(rows){
  const totals=rows.reduce((a,r)=>{
    a.income+=cmCostNum(r.income);a.food+=cmCostNum(r.food_cost);a.personnel+=cmCostNum(r.personnel_cost);a.basic+=cmCostNum(r.basic_expenses);a.net+=cmCostNum(r.net);a.clients+=cmCostNum(r.customers_count);return a;
  },{income:0,food:0,personnel:0,basic:0,net:0,clients:0});
  totals.avgClients=rows.length?totals.clients/rows.length:0;
  totals.costPct=totals.income?totals.food*100/totals.income:0;
  totals.avgNet=rows.length?totals.net/rows.length:0;
  return totals;
}
async function dailyCosts(){
  const [daily,monthly]=await Promise.all([api(`/api/admin/daily-financials?month=${encodeURIComponent(cmCostsMonth)}`),api('/api/admin/daily-financials/summary?months=12')]);
  cmDailyCostCache=daily.items||[];cmMonthlyCostCache=monthly.items||[];
  const a=cmCostAggregate(cmDailyCostCache);
  viewActions.innerHTML=cmCostAction('add_circle','Registrar día','openDailyCostForm()','primary');
  content.innerHTML=`
    <section class="cm-cost-intro">
      <div><div class="kicker">CONTROL ECONÓMICO DIARIO</div><h3>Ventas, costos y resultado en un solo lugar</h3><p>Registra la venta diaria, clientes, personal y cada insumo utilizado. La tabla y los gráficos se actualizan automáticamente.</p></div>
      <label class="cm-month-control"><span>Mes a revisar</span><input id="cmCostsMonth" type="month" value="${cmCostsMonth}" onchange="changeCostsMonth(this.value)"></label>
    </section>
    <div class="cm-cost-actions-row">
      ${cmCostAction('download','Descargar datos CSV','downloadCostsCsv()')}
      ${cmCostAction('image','Descargar gráfico diario','downloadCostChart(\'cmDailyChart\',\'costos-diarios\')')}
      ${cmCostAction('image','Descargar gráfico mensual','downloadCostChart(\'cmMonthlyChart\',\'resumen-mensual\')')}
      ${cmCostAction('print','Imprimir / guardar PDF','window.print()')}
    </div>
    <div class="cm-cost-stats">
      ${cmCostStat('payments','Ingresos del mes',money(a.income))}
      ${cmCostStat('shopping_cart','Costo alimentos',money(a.food),cmCostPct(a.costPct)+' de las ventas')}
      ${cmCostStat('groups','Personal',money(a.personnel))}
      ${cmCostStat('account_balance_wallet','Neto del mes',money(a.net),`Promedio diario ${money(a.avgNet)}`)}
      ${cmCostStat('restaurant','Clientes promedio',new Intl.NumberFormat('es-CL',{maximumFractionDigits:1}).format(a.avgClients))}
    </div>
    <div class="cm-cost-chart-grid">
      <article class="cm-cost-chart-card"><div><h3>Ingreso, costo y neto diario</h3><p>${cmCostMonthName(cmCostsMonth)} · cada punto corresponde a una jornada registrada.</p></div>${cmCostLineChart(cmDailyCostCache)}</article>
      <article class="cm-cost-chart-card"><div><h3>Evolución mensual</h3><p>Clientes promedio y proporción del costo de alimentos.</p></div>${cmCostMonthlyChart(cmMonthlyCostCache)}</article>
    </div>
    <section class="cm-cost-table-card">
      <div class="toolbar"><div><h3>Tabla diaria · ${cmCostMonthName(cmCostsMonth)}</h3><p class="admin-help">El gasto se construye desde los insumos ingresados en cada jornada.</p></div>${cmCostAction('add','Registrar jornada','openDailyCostForm()','primary')}</div>
      <div class="table-wrap embedded-table-wrap"><table><thead><tr><th>Fecha</th><th>Clientes</th><th>Gasto alimentos</th><th>Ingreso</th><th>Costo</th><th>Personal</th><th>Gastos básicos</th><th>Neto</th><th>Acciones</th></tr></thead><tbody>
        ${cmDailyCostCache.length?cmDailyCostCache.map(r=>`<tr><td>${fmtDate(r.financial_date)}</td><td>${r.customers_count}</td><td>${money(r.food_cost)}</td><td>${money(r.income)}</td><td><span class="badge ${cmCostNum(r.cost_percentage)>50?'red':'blue'}">${cmCostPct(r.cost_percentage)}</span></td><td>${money(r.personnel_cost)}</td><td>${money(r.basic_expenses)}</td><td><strong class="${cmCostNum(r.net)<0?'cm-negative':'cm-positive'}">${money(r.net)}</strong></td><td class="cm-row-buttons"><button type="button" class="btn btn-secondary btn-small" data-cm-decorated-v23="1" onclick="openDailyCostForm(${r.id})">Editar</button><button type="button" class="btn btn-danger btn-small" data-cm-decorated-v23="1" onclick="deleteDailyCost(${r.id})">Eliminar</button></td></tr>`).join(''):`<tr><td colspan="9" class="muted">No hay jornadas registradas para este mes.</td></tr>`}
      </tbody></table></div>
    </section>`;
  requestAnimationFrame(cmAdminAfterRender);
}
window.dailyCosts=dailyCosts;
window.changeCostsMonth=value=>{if(/^\d{4}-\d{2}$/.test(value)){cmCostsMonth=value;dailyCosts()}};

function cmCostItemRow(item={}){
  return `<tr class="cm-cost-item-row">
    <td><select class="cm-item-category"><option ${item.category==='Ingredientes'?'selected':''}>Ingredientes</option><option ${item.category==='Envases'?'selected':''}>Envases</option><option ${item.category==='Aseo'?'selected':''}>Aseo</option><option ${item.category==='Otros'?'selected':''}>Otros</option></select></td>
    <td><input class="cm-item-name" value="${cmCostEsc(item.item_name||'')}" placeholder="Ej.: pollo asado"></td>
    <td><input class="cm-item-quantity" type="number" min="0" step="0.001" value="${item.quantity??''}" placeholder="0"></td>
    <td><input class="cm-item-unit" value="${cmCostEsc(item.unit||'')}" placeholder="kg / un."></td>
    <td><input class="cm-item-unit-cost" type="number" min="0" step="1" value="${item.unit_cost??''}" placeholder="$"></td>
    <td><input class="cm-item-total" type="number" min="0" step="1" value="${item.total_cost??''}" placeholder="$"></td>
    <td><button class="cm-remove-cost-row" type="button" aria-label="Quitar insumo" title="Quitar insumo"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button></td>
  </tr>`;
}
function cmBindCostRows(){
  const body=modalForm.querySelector('#cmCostItemsBody');if(!body)return;
  const update=()=>{
    let total=0;
    body.querySelectorAll('.cm-cost-item-row').forEach(row=>{
      const q=cmCostNum(row.querySelector('.cm-item-quantity').value),u=cmCostNum(row.querySelector('.cm-item-unit-cost').value),t=row.querySelector('.cm-item-total');
      if(q>0&&u>0)t.value=Math.round(q*u);
      total+=cmCostNum(t.value);
    });
    const food=modalForm.querySelector('#cmFoodCostPreview'),net=modalForm.querySelector('#cmNetPreview');
    if(food)food.textContent=money(total);
    if(net){const income=cmCostNum(modalForm.elements.income?.value),personal=cmCostNum(modalForm.elements.personnel_cost?.value),basic=cmCostNum(modalForm.elements.basic_expenses?.value);net.textContent=money(income-total-personal-basic)}
  };
  body.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',update));
  body.querySelectorAll('.cm-remove-cost-row').forEach(btn=>btn.onclick=()=>{btn.closest('tr').remove();update()});
  ['income','personnel_cost','basic_expenses'].forEach(name=>modalForm.elements[name]?.addEventListener('input',update));
  modalForm.querySelector('#cmAddCostItem').onclick=()=>{body.insertAdjacentHTML('beforeend',cmCostItemRow());cmBindCostRows()};
  update();
}
window.openDailyCostForm=id=>{
  const record=id?cmDailyCostCache.find(r=>Number(r.id)===Number(id)):null;
  const date=record?cmCostDate(record.financial_date):(cmCostsMonth===today().slice(0,7)?today():`${cmCostsMonth}-01`);
  openForm(record?'Editar jornada':'Registrar jornada',`
    <div class="notice"><strong>Una jornada, un registro.</strong> Los insumos suman el gasto de alimentos; la web calcula el porcentaje de costo y el neto.</div>
    <div class="three-cols">${field('financial_date','Fecha','date',date,'required')}${field('customers_count','Clientes aproximados','number',record?.customers_count||0,'min="0"')}${field('income','Ingreso / venta total','number',record?.income||0,'min="0"')}</div>
    <div class="two-cols">${field('personnel_cost','Costo de personal','number',record?.personnel_cost||0,'min="0"')}${field('basic_expenses','Gastos básicos','number',record?.basic_expenses??15000,'min="0"')}</div>
    <section class="cm-cost-items-editor"><div class="toolbar"><div><h3>Costos del día</h3><p class="admin-help">Cantidad × valor unitario calcula el total. También puedes escribir directamente un total.</p></div><button id="cmAddCostItem" class="btn btn-secondary" type="button" data-cm-decorated-v23="1"><span class="material-symbols-rounded">add</span><span>Agregar insumo</span></button></div><div class="table-wrap"><table><thead><tr><th>Categoría</th><th>Insumo</th><th>Cantidad</th><th>Unidad</th><th>Valor unitario</th><th>Total</th><th></th></tr></thead><tbody id="cmCostItemsBody">${(record?.items?.length?record.items:[{}]).map(cmCostItemRow).join('')}</tbody></table></div></section>
    <div class="cm-cost-form-summary"><span>Gasto alimentos <strong id="cmFoodCostPreview">$0</strong></span><span>Neto estimado <strong id="cmNetPreview">$0</strong></span></div>
    ${textArea('notes','Observaciones',cmCostEsc(record?.notes||''))}`,
    async e=>{
      e.preventDefault();
      const form=e.currentTarget;
      const payload=Object.fromEntries(new FormData(form).entries());
      payload.items=[...form.querySelectorAll('.cm-cost-item-row')].map(row=>({
        category:row.querySelector('.cm-item-category').value,
        item_name:row.querySelector('.cm-item-name').value.trim(),
        quantity:row.querySelector('.cm-item-quantity').value,
        unit:row.querySelector('.cm-item-unit').value.trim(),
        unit_cost:row.querySelector('.cm-item-unit-cost').value,
        total_cost:row.querySelector('.cm-item-total').value
      })).filter(x=>x.item_name);
      await api('/api/admin/daily-financials',{method:'POST',body:JSON.stringify(payload)});
      modal.close();cmCostsMonth=payload.financial_date.slice(0,7);await dailyCosts();
    });
  requestAnimationFrame(cmBindCostRows);
};
window.deleteDailyCost=async id=>{if(!confirm('¿Eliminar esta jornada y todos sus insumos?'))return;await api(`/api/admin/daily-financials/${id}`,{method:'DELETE'});dailyCosts()};
window.downloadCostsCsv=()=>{
  const cols=['Fecha','Clientes','Gasto alimentos','Ingreso','Costo %','Personal','Gastos básicos','Neto'];
  const lines=[cols,...cmDailyCostCache.map(r=>[cmCostDate(r.financial_date),r.customers_count,r.food_cost,r.income,r.cost_percentage,r.personnel_cost,r.basic_expenses,r.net])];
  const csv='\ufeff'+lines.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`CM_costos_${cmCostsMonth}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.downloadCostChart=(id,name)=>{
  const svg=document.getElementById(id);if(!svg)return alert('No hay gráfico disponible todavía.');
  const xml=new XMLSerializer().serializeToString(svg),blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();
  img.onload=()=>{const c=document.createElement('canvas');c.width=1840;c.height=720;const ctx=c.getContext('2d');ctx.fillStyle='#fffaf6';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);c.toBlob(png=>{const a=document.createElement('a');a.href=URL.createObjectURL(png);a.download=`CM_${name}_${cmCostsMonth}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},'image/png')};img.src=url;
};

// Carpeta documental sencilla, sin módulo temporal de consultoría.
async function cmDocumentsView(){
  const d=await api('/api/admin/documents');
  cache.documents=d.items||[];
  addAction('Agregar documento',()=>openCmDocumentForm());
  const categories=['Todos','Sanitario','Municipal','Tributario','Laboral','Operación','Proveedores','Web y tecnología','Empresa / general'];
  content.innerHTML=`<section class="cm-doc-intro"><div><div class="kicker">RESPALDOS CM</div><h3>Carpeta sanitaria y documental</h3><p>Reúne enlaces a resoluciones, registros, certificados, contratos, respaldos operativos y documentos de la empresa. El archivo original puede permanecer en Drive; aquí queda su ubicación y vencimiento.</p></div><label><span>Filtrar carpeta</span><select id="cmDocFilter" onchange="filterCmDocuments(this.value)">${categories.map(x=>`<option>${x}</option>`).join('')}</select></label></section><div class="notice"><strong>No se almacenan contraseñas aquí.</strong> Las credenciales se gestionan en el anexo confidencial de traspaso y en las cuentas de cada servicio.</div><div id="cmDocumentsTable">${cmDocumentsTable(cache.documents)}</div>`;
}
function cmDocumentsTable(items){
  return table(['Documento','Carpeta','Tipo','Fecha','Vencimiento','Archivo','Notas','Acciones'],items.map(x=>`<tr data-doc-folder="${cmCostEsc(x.owner_type)}"><td><strong>${cmCostEsc(x.title)}</strong></td><td>${cmCostEsc(x.owner_type||'Empresa / general')}</td><td>${cmCostEsc(x.document_type)}</td><td>${fmtDate(x.document_date)}</td><td>${x.expiration_date?`<span class="badge red">${fmtDate(x.expiration_date)}</span>`:''}</td><td>${x.file_url?`<a class="btn btn-secondary btn-small" data-cm-decorated-v23="1" href="${cmCostEsc(x.file_url)}" target="_blank" rel="noopener">Abrir</a>`:'-'}</td><td>${cmCostEsc(x.notes||'')}</td><td><button class="btn btn-danger btn-small" data-cm-decorated-v23="1" type="button" onclick="removeRow('documents',${x.id})">Eliminar</button></td></tr>`));
}
window.filterCmDocuments=value=>{
  const items=value==='Todos'?(cache.documents||[]):(cache.documents||[]).filter(x=>(x.owner_type||'Empresa / general')===value);
  const box=document.querySelector('#cmDocumentsTable');if(box)box.innerHTML=cmDocumentsTable(items);
};
window.openCmDocumentForm=()=>openForm('Agregar documento',`
  <div class="two-cols">${field('title','Nombre del documento','text','','required')}${field('document_type','Tipo de documento','text','','required')}</div>
  <div class="two-cols"><div class="form-line"><label>Carpeta</label><select name="owner_type"><option>Sanitario</option><option>Municipal</option><option>Tributario</option><option>Laboral</option><option>Operación</option><option>Proveedores</option><option>Web y tecnología</option><option selected>Empresa / general</option></select></div>${field('document_date','Fecha del documento','date')}</div>
  <div class="two-cols">${field('expiration_date','Fecha de vencimiento','date')}${field('file_url','Enlace a Drive o archivo','url','','placeholder="https://..."')}</div>${textArea('notes','Notas / ubicación física')}
  <div class="notice">El panel guarda el enlace y los datos de control. Mantén el archivo original en la carpeta oficial de CM.</div>`,async e=>{e.preventDefault();await api('/api/admin/documents',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget).entries()))});modal.close();cmDocumentsView()});

documents=cmDocumentsView;

// Panel principal simplificado para Claudia, sin espacios de consultoría.
dashboard=async function(){
  const [d,months]=await Promise.all([api('/api/admin/dashboard'),api('/api/admin/daily-financials/summary?months=2')]);
  const current=(months.items||[]).at(-1)||null;
  const stat=(icon,label,value)=>`<div class="stat stat-with-icon"><span class="stat-icon material-symbols-rounded" aria-hidden="true">${icon}</span><span>${cmCostEsc(label)}</span><strong>${value}</strong></div>`;
  content.innerHTML=`<section class="daily-hero-card"><div><div class="kicker">ADMINISTRACIÓN CM</div><h3>Panel de control diario</h3><p>Accesos directos para registrar la operación, revisar costos, actualizar el menú y mantener la carpeta documental.</p></div><a class="mail-info-link" href="mailto:claudiamendezbanqueteria@gmail.com"><span>claudiamendezbanqueteria@gmail.com</span></a></section>
  <div class="quick-actions daily-actions"><button class="btn btn-primary" type="button" onclick="renderView('dailyCosts')">${cmIconHTML('Costos')}</button><button class="btn btn-primary" type="button" onclick="renderView('quotes')">${cmIconHTML('Nueva cotización')}</button><button class="btn btn-secondary" type="button" onclick="renderView('menus')">${cmIconHTML('Menú del día')}</button><button class="btn btn-secondary" type="button" onclick="renderView('purchases')">${cmIconHTML('Compras')}</button><button class="btn btn-secondary" type="button" onclick="renderView('documents')">${cmIconHTML('Documentos CM')}</button></div>
  <div class="stat-grid stat-grid-icons">${stat('payments','Ingresos mes registrado',money(current?.income||0))}${stat('account_balance_wallet','Neto mes registrado',money(current?.net||0))}${stat('request_quote','Cotizaciones pendientes',d.pendingQuotes)}${stat('warning','Stock crítico',d.criticalStock.length)}${stat('edit_note','Observaciones abiertas',d.openObservations||0)}${stat('folder_open','Documentos por vencer',d.expiringDocuments.length)}</div>
  <div class="grid-2"><div class="card"><h3>Menú de hoy</h3>${d.todayMenu?`<p><strong>${cmCostEsc(d.todayMenu.title)}</strong></p><p class="muted">${cmCostEsc(d.todayMenu.main_dish||'')} · Raciones: ${d.todayMenu.available_portions||0}</p>`:'<p class="muted">No hay menú cargado para hoy.</p>'}<button class="btn btn-secondary btn-small" type="button" onclick="renderView('menus')">Abrir menú</button></div><div class="card"><h3>Control económico</h3><p class="muted">${current?`${cmCostMonthName(current.month)}: ${current.recorded_days} jornadas · ${money(current.net)} neto registrado.`:'Comienza registrando una jornada para construir las gráficas mensuales.'}</p><button class="btn btn-primary btn-small" type="button" onclick="renderView('dailyCosts')">Abrir costos diarios</button></div></div>`;
};

// Envuelve la navegación final para incorporar el nuevo módulo.
const cmRenderViewBeforeCosts=window.renderView;
renderView=async function(v){
  if(v==='dailyCosts'){setHeader(v);await dailyCosts();requestAnimationFrame(cmAdminAfterRender);return}
  const result=await cmRenderViewBeforeCosts(v);
  requestAnimationFrame(cmAdminAfterRender);
  return result;
};
window.renderView=renderView;
requestAnimationFrame(()=>{cmDecorateSidebar();cmAdminAfterRender()});
