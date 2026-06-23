const fmtTime=value=>value?String(value).slice(0,5):'--:--';
const safe=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const money=value=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value||0);
const service={mesa:'Mesa',retiro:'Retiro',delivery:'Delivery'};
const statusLabel={confirmado:'Confirmado',en_preparacion:'En preparación',listo:'Listo',entregado:'Entregado'};

function tick(){
  clockBox.textContent=new Intl.DateTimeFormat('es-CL',{hour:'2-digit',minute:'2-digit'}).format(new Date());
}

async function load(){
  try{
    const res=await fetch('/api/public/screen',{cache:'no-store'}),data=await res.json();
    const orders=data.orders||[],messages=data.messages||[],menu=data.menu;
    const active=orders.filter(x=>!['entregado','cancelado'].includes(x.status));
    const prep=active.filter(x=>['confirmado','en_preparacion'].includes(x.status));
    const ready=orders.filter(x=>['listo','entregado'].includes(x.status)).slice(0,16);
    summaryBox.innerHTML=[
      ['Pendientes',prep.length],
      ['Listos',orders.filter(x=>x.status==='listo').length],
      ['Entregados',orders.filter(x=>x.status==='entregado').length],
      ['Mesas',orders.filter(x=>x.service_type==='mesa'&&x.status!=='entregado').length]
    ].map(([label,value])=>`<article><span>${label}</span><strong>${value}</strong></article>`).join('');
    prepBox.innerHTML=prep.map(orderCard).join('')||'<p class="kds-empty">Sin pedidos pendientes.</p>';
    readyBox.innerHTML=ready.map(orderCard).join('')||'<p class="kds-empty">Sin pedidos listos.</p>';
    messageBox.innerHTML=messages.map(messageCard).join('')||'<p class="kds-empty">Sin mensajes activos.</p>';
    menuBox.innerHTML=menu?`<h3>${safe(menu.title||'Menú del día')}</h3><p>${[menu.option_1||menu.main_dish,menu.option_2||menu.side_dish,menu.option_3||menu.salad,menu.dessert].filter(Boolean).map(safe).join('<br>')}</p><div class="screen-price">${menu.price?money(menu.price):''}</div><strong>Raciones disponibles: ${menu.available_portions||0}</strong>`:'<p class="kds-empty">No hay menú publicado para hoy.</p>';
  }catch(error){
    prepBox.innerHTML='<p class="kds-empty">No se pudo actualizar la pantalla.</p>';
  }
}

function orderCard(order){
  const badge=order.status==='entregado'?'done':order.status==='listo'?'ready':order.status==='en_preparacion'?'prep':'new';
  return `<article class="kds-order ${badge}">
    <div class="kds-order-head"><strong>${fmtTime(order.order_time)} · ${safe(service[order.service_type]||order.service_type)}</strong><span>${safe(statusLabel[order.status]||order.status)}</span></div>
    <h3>${safe(order.customer_name)}</h3>
    <p>${order.service_type==='mesa'?`Mesa/ref.: ${safe(order.table_name||'sin asignar')}${order.party_size?` · ${order.party_size} personas`:''}`:`${order.quantity||1} menú(s) · ${safe(order.menu_summary||'sin detalle')}`}</p>
    ${order.notes?`<small>${safe(order.notes)}</small>`:''}
    ${order.assigned_to?`<em>${safe(order.assigned_to)}</em>`:''}
  </article>`;
}

function messageCard(message){
  return `<article class="kds-message ${safe(message.priority)}"><span>${safe(message.audience)}</span><strong>${safe(message.title)}</strong><p>${safe(message.body)}</p></article>`;
}

tick();
load();
setInterval(tick,1000);
setInterval(load,5000);
