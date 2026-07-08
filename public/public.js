const CM_WHATSAPP = '56987741182';

function cmWhatsappUrl(message){
  return `https://wa.me/${CM_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

async function loadTodayMenu(){
  const box=document.querySelector('#todayMenu, #menu-del-dia');
  if(!box)return;
  try{
    const res=await fetch('/api/public/menu/today'),data=await res.json();
    if(!data.menu){
      box.innerHTML=`
        <div class="menu-empty">
          <span class="badge">CM Restaurant</span>
          <h3>Consulta el menú disponible de hoy</h3>
          <p class="muted">El menú del día pertenece a CM Restaurant. Cuando no esté publicado en la web, puedes consultar directamente por WhatsApp.</p>
          <a class="btn btn-primary" href="${cmWhatsappUrl('Hola CM, quiero consultar por el menú del día del Restaurant.')}" target="_blank" rel="noopener">Consultar menú por WhatsApp</a>
        </div>`;
      return;
    }
    const menu=data.menu;
    const [landscape,portrait]=await Promise.all([CMMenuGraphic.render(menu,'landscape'),CMMenuGraphic.render(menu,'portrait')]);
    const picture=document.createElement('picture'),source=document.createElement('source'),image=document.createElement('img');
    source.media='(max-width: 620px)';source.srcset=portrait.toDataURL('image/png');
    image.src=landscape.toDataURL('image/png');image.alt=`Menú de CM Restaurant para ${CMMenuGraphic.dateLabel(menu.menu_date)}`;image.className='public-menu-image';
    picture.append(source,image);box.innerHTML='<span class="badge green">Menú publicado para hoy</span>';box.appendChild(picture);
  }catch(e){
    box.innerHTML=`
      <div class="menu-empty">
        <h3>Menú no disponible en este momento</h3>
        <p class="muted">No se pudo cargar el menú del día. Puedes consultar disponibilidad por WhatsApp.</p>
        <a class="btn btn-primary" href="${cmWhatsappUrl('Hola CM, quiero consultar por el menú del día del Restaurant.')}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
      </div>`;
  }
}

function quoteMessage(payload){
  const lines=[
    'Hola CM Banquetería, quiero realizar una consulta/cotización desde la web.',
    '',
    `Nombre: ${payload.clientName||''}`,
    `Teléfono: ${payload.phone||''}`,
    `Correo: ${payload.email||''}`,
    `Servicio requerido: ${payload.requestedService||''}`,
    `Fecha estimada: ${payload.eventDate||''}`,
    `Tipo de evento: ${payload.eventType||''}`,
    `Número de personas: ${payload.guests||''}`,
    `Lugar/comuna: ${payload.location||''}`,
    `Presupuesto estimado: ${payload.estimatedBudget||''}`,
    `Comentarios: ${payload.internalNotes||''}`
  ];
  return lines.join('\n');
}

document.querySelector('#quoteForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const form=e.currentTarget;
  const payload=Object.fromEntries(new FormData(form).entries());
  const btn=form.querySelector('button[type="submit"]');

  if(!payload.clientName || !payload.phone){
    alert('Nombre y teléfono son obligatorios.');
    return;
  }

  const whatsappWindow=window.open(cmWhatsappUrl(quoteMessage(payload)),'_blank','noopener');
  try{
    if(btn){btn.disabled=true;btn.textContent='Registrando solicitud...'}
    const res=await fetch('/api/public/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(res.ok){
      form.reset();
      alert('Solicitud preparada en WhatsApp y registrada correctamente. CM Banquetería se contactará contigo.');
    }else{
      if(!whatsappWindow) alert('No se pudo abrir WhatsApp automáticamente. Usa el botón WhatsApp directo.');
    }
  }
  catch(err){
    if(!whatsappWindow) alert('No se pudo abrir WhatsApp automáticamente. Usa el botón WhatsApp directo.');
  }
  finally{
    if(btn){btn.disabled=false;btn.textContent='Enviar por WhatsApp'}
  }
});

loadTodayMenu();
