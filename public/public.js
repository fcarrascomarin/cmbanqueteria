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
    if(btn){btn.disabled=true;btn.innerHTML='<span class="btn-icon" aria-hidden="true">⌛</span> Registrando...'}
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
    if(btn){btn.disabled=false;btn.innerHTML='<span class="btn-icon" aria-hidden="true">✓</span> Enviar por WhatsApp'}
  }
});


function setupQuoteStepper(){
  const form=document.querySelector('#quoteForm.quote-step-form');
  if(!form)return;
  const steps=[...form.querySelectorAll('.quote-step')];
  const dots=[...form.querySelectorAll('[data-step-dot]')];
  let current=0;
  const show=index=>{
    current=Math.max(0,Math.min(index,steps.length-1));
    steps.forEach((step,i)=>step.classList.toggle('active',i===current));
    dots.forEach((dot,i)=>dot.classList.toggle('active',i<=current));
  };
  const validateCurrent=()=>{
    const required=[...steps[current].querySelectorAll('[required]')];
    for(const field of required){
      if(!field.checkValidity()){
        field.reportValidity();
        return false;
      }
    }
    return true;
  };
  form.querySelectorAll('.quote-step-next').forEach(button=>button.addEventListener('click',()=>{if(validateCurrent())show(current+1)}));
  form.querySelectorAll('.quote-step-prev').forEach(button=>button.addEventListener('click',()=>show(current-1)));
  show(0);
}

setupQuoteStepper();

loadTodayMenu();


/* ===== UX v19: Material Symbols y acciones icon-only selectivas ===== */
function cmPublicMaterialIcon(name){
  return `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
}
function cmActionIconForElement(el){
  const label=(el.dataset.originalLabel||el.getAttribute('aria-label')||el.textContent||'').trim().toLowerCase();
  const href=(el.getAttribute('href')||'').toLowerCase();
  if(label.includes('whatsapp') || href.includes('wa.me')) return 'chat';
  if(label.includes('instagram') || href.includes('instagram.com')) return 'photo_camera';
  if(label.includes('correo') || label.includes('email') || href.startsWith('mailto:') || label.includes('@')) return 'mail';
  if(label.includes('descargar') || label === 'pdf' || label.includes('download')) return 'download';
  if(label.includes('editar')) return 'edit';
  if(/^ver\b/.test(label) || label.includes(' ver ') || label.includes('vista')) return 'visibility';
  return '';
}
function cmDecoratePublicActions(root=document){
  root.querySelectorAll('a.btn,button.btn,.floating-whatsapp').forEach(el=>{
    if(el.dataset.cmDecorated==='1')return;
    const label=(el.textContent||el.getAttribute('aria-label')||'').trim();
    const icon=cmActionIconForElement(el);
    if(!icon)return;
    el.dataset.cmDecorated='1';
    el.dataset.originalLabel=label || el.getAttribute('aria-label') || 'Acción';
    el.classList.add('action-icon-only');
    el.setAttribute('aria-label',el.dataset.originalLabel);
    el.setAttribute('title',el.dataset.originalLabel);
    el.innerHTML=`${cmPublicMaterialIcon(icon)}<span class="sr-only">${el.dataset.originalLabel}</span>`;
  });
  root.querySelectorAll('.footer-contact a,.footer-credit a').forEach(el=>{
    if(el.dataset.cmInlineIcon==='1')return;
    const icon=cmActionIconForElement(el);
    if(!icon)return;
    el.dataset.cmInlineIcon='1';
    el.insertAdjacentHTML('afterbegin',`${cmPublicMaterialIcon(icon)} `);
  });
}
cmDecoratePublicActions();
if(document.body && !window.__cmPublicIconObserver){
  window.__cmPublicIconObserver=true;
  new MutationObserver(()=>cmDecoratePublicActions()).observe(document.body,{childList:true,subtree:true});
}


/* ===== UX v20: icono real de WhatsApp en acciones públicas ===== */
(function(){
  const WA_ICON_SRC='/assets/icons/whatsapp.png';
  window.cmPublicMaterialIcon=function(name){
    if(name==='whatsapp') return `<img class="brand-icon-img whatsapp-brand" src="${WA_ICON_SRC}" alt="" aria-hidden="true">`;
    return `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
  };
  window.cmActionIconForElement=function(el){
    const label=(el.dataset.originalLabel||el.getAttribute('aria-label')||el.textContent||'').trim().toLowerCase();
    const href=(el.getAttribute('href')||'').toLowerCase();
    if(label.includes('whatsapp') || href.includes('wa.me')) return 'whatsapp';
    if(label.includes('instagram') || href.includes('instagram.com')) return 'photo_camera';
    if(label.includes('correo') || label.includes('email') || href.startsWith('mailto:') || label.includes('@')) return 'mail';
    if(label.includes('descargar') || label === 'pdf' || label.includes('download')) return 'download';
    if(label.includes('editar')) return 'edit';
    if(/^ver\b/.test(label) || label.includes(' ver ') || label.includes('vista')) return 'visibility';
    return '';
  };
  window.cmDecoratePublicActions=function(root=document){
    root.querySelectorAll('a.btn,button.btn,.floating-whatsapp').forEach(el=>{
      const label=(el.dataset.originalLabel||el.textContent||el.getAttribute('aria-label')||'').trim();
      const icon=cmActionIconForElement(el);
      if(!icon)return;
      el.dataset.cmDecorated='1';
      el.dataset.originalLabel=label || el.getAttribute('aria-label') || 'Acción';
      el.classList.add('action-icon-only');
      el.setAttribute('aria-label',el.dataset.originalLabel);
      el.setAttribute('title',el.dataset.originalLabel);
      el.innerHTML=`${cmPublicMaterialIcon(icon)}<span class="sr-only">${el.dataset.originalLabel}</span>`;
    });
    root.querySelectorAll('.footer-contact a,.footer-credit a').forEach(el=>{
      const icon=cmActionIconForElement(el);
      if(!icon || el.dataset.cmInlineIcon==='1')return;
      el.dataset.cmInlineIcon='1';
      el.insertAdjacentHTML('afterbegin',`${cmPublicMaterialIcon(icon)} `);
    });
  };
  cmPublicMaterialIcon=window.cmPublicMaterialIcon;
  cmActionIconForElement=window.cmActionIconForElement;
  cmDecoratePublicActions=window.cmDecoratePublicActions;
  requestAnimationFrame(()=>cmDecoratePublicActions());
})();
