const CM_WHATSAPP = '56987741182';
const CM_API_BASE = (window.CM_API_BASE || '').replace(/\/$/, '');
const CM_ADMIN_URL = window.CM_ADMIN_URL || (CM_API_BASE ? `${CM_API_BASE}/admin.html` : '/admin.html');

function cmApiUrl(path){
  const cleanPath = String(path || '').startsWith('/') ? path : `/${path}`;
  return CM_API_BASE ? `${CM_API_BASE}${cleanPath}` : cleanPath;
}

function setupAdminLinks(){
  document.querySelectorAll('[data-admin-link]').forEach(link=>{
    link.href = CM_ADMIN_URL;
    if(CM_API_BASE) link.target = '_blank';
    if(CM_API_BASE) link.rel = 'noopener';
  });
}

function cmWhatsappUrl(message){
  return `https://wa.me/${CM_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

async function loadTodayMenu(){
  const box=document.querySelector('#todayMenu, #menu-del-dia');
  if(!box)return;
  try{
    const res=await fetch(cmApiUrl('/api/public/menu/today'), {credentials: CM_API_BASE ? 'omit' : 'same-origin'}),data=await res.json();
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
    if(btn){btn.disabled=true;btn.innerHTML='<span class="material-symbols-rounded" aria-hidden="true">hourglass_top</span><span>Registrando...</span>'}
    const res=await fetch(cmApiUrl('/api/public/quotes'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
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
    if(btn){btn.disabled=false;btn.innerHTML='<img class="brand-icon-img whatsapp-brand" src="/assets/icons/whatsapp.png" alt="" aria-hidden="true"><span>Enviar por WhatsApp</span>'}
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




/* ===== Performance v23: carga diferida de menú, videos e iconografía limpia ===== */
const CM_WA_ICON_SRC='/assets/icons/whatsapp.png';
const CM_IG_ICON_SRC='/assets/icons/instagram.svg';

function cmSymbol(name){
  return `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
}
function cmSafeLabel(value){
  return String(value||'').replace(/[&<>\"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}
function cmButtonLabel(el){
  return (el.dataset.originalLabel||el.getAttribute('aria-label')||el.textContent||'').replace(/\s+/g,' ').trim();
}
function cmStrategicAction(el){
  const label=cmButtonLabel(el).toLowerCase();
  const href=(el.getAttribute('href')||'').toLowerCase();
  if(label.includes('whatsapp') || href.includes('wa.me')) return {type:'whatsapp'};
  if(label.includes('instagram') || href.includes('instagram.com')) return {type:'instagram'};
  if(label.includes('correo') || label.includes('email') || href.startsWith('mailto:') || label.includes('@')) return {type:'mail',symbol:'mail'};
  if(label.includes('llamar') || label.includes('teléfono') || href.startsWith('tel:')) return {type:'call',symbol:'call'};
  if(/^ver\b/.test(label) || label.includes('abrir') || label.includes('vista')) return {type:'view',symbol:'visibility'};
  if(label.includes('descargar') || label.includes('download') || label==='pdf') return {type:'download',symbol:'download'};
  if(label.includes('editar')) return {type:'edit',symbol:'edit'};
  if(label.includes('eliminar') || label.includes('borrar')) return {type:'delete',symbol:'delete'};
  return null;
}
function cmActionIconMarkup(action,label){
  const safe=cmSafeLabel(label);
  if(action.type==='whatsapp') return `<img class="brand-icon-img whatsapp-brand" src="${CM_WA_ICON_SRC}" alt="" aria-hidden="true"><span class="sr-only">${safe}</span>`;
  if(action.type==='instagram') return `<img class="brand-icon-img local-action-icon" src="${CM_IG_ICON_SRC}" alt="" aria-hidden="true"><span class="sr-only">${safe}</span>`;
  return `${cmSymbol(action.symbol)}<span class="sr-only">${safe}</span>`;
}
function cmDecoratePublicActions(root=document){
  root.querySelectorAll('a.btn,button.btn,.floating-whatsapp,.footer-contact a').forEach(el=>{
    const action=cmStrategicAction(el);
    if(!action) return;
    const label=cmButtonLabel(el)||'Acción';
    el.dataset.originalLabel=label;
    el.removeAttribute('data-icon');
    el.setAttribute('aria-label',label);
    el.setAttribute('title',label);
    el.classList.add('uses-strategic-icon',`action-${action.type}`);
    const keepText=el.closest('.hero-actions') && !['whatsapp','mail','call','instagram'].includes(action.type);
    if(keepText){
      if(!el.querySelector('.material-symbols-rounded,.brand-icon-img')){
        if(action.type==='whatsapp') el.insertAdjacentHTML('afterbegin',`<img class="brand-icon-img whatsapp-brand" src="${CM_WA_ICON_SRC}" alt="" aria-hidden="true">`);
        else if(action.type==='instagram') el.insertAdjacentHTML('afterbegin',`<img class="brand-icon-img local-action-icon" src="${CM_IG_ICON_SRC}" alt="" aria-hidden="true">`);
        else el.insertAdjacentHTML('afterbegin',cmSymbol(action.symbol));
      }
      return;
    }
    el.classList.add('action-icon-only');
    el.innerHTML=cmActionIconMarkup(action,label);
  });
}

function setupLazyVideos(){
  const pauseOtherVideos=(activeVideo=null)=>{
    document.querySelectorAll('.lazy-video-player').forEach(video=>{
      if(video!==activeVideo && !video.paused){
        video.pause();
      }
    });
    document.querySelectorAll('.lazy-video-card.is-playing').forEach(card=>{
      const video=card.querySelector('.lazy-video-player');
      card.classList.toggle('is-active-video',!!video && video===activeVideo && !video.paused);
    });
  };

  document.querySelectorAll('.lazy-video-card[data-video-src]').forEach(card=>{
    const trigger=card.querySelector('.lazy-video-trigger');
    if(!trigger || trigger.dataset.ready==='1') return;
    trigger.dataset.ready='1';

    const play=()=>{
      const existing=card.querySelector('.lazy-video-player');
      if(existing){
        pauseOtherVideos(existing);
        existing.play().catch(()=>{});
        return;
      }

      pauseOtherVideos(null);
      const src=card.dataset.videoSrc;
      const poster=card.dataset.videoPoster||'';
      const label=card.dataset.videoLabel||'Video promocional CM';
      const video=document.createElement('video');
      video.src=src;
      video.poster=poster;
      video.controls=true;
      video.playsInline=true;
      video.preload='none';
      video.setAttribute('aria-label',label);
      video.className='lazy-video-player';
      video.addEventListener('play',()=>pauseOtherVideos(video));
      video.addEventListener('pause',()=>card.classList.remove('is-active-video'));
      video.addEventListener('ended',()=>card.classList.remove('is-active-video'));
      card.classList.add('is-playing');
      trigger.replaceWith(video);
      const attempt=video.play();
      if(attempt && typeof attempt.catch==='function') attempt.catch(()=>{});
    };

    trigger.addEventListener('click',play,{once:true});
    trigger.addEventListener('keydown',event=>{
      if(event.key==='Enter' || event.key===' '){
        event.preventDefault();
        play();
      }
    });
  });
}

function setupDeferredMenu(){
  const box=document.querySelector('#todayMenu, #menu-del-dia');
  if(!box) return;
  let loaded=false;
  const run=()=>{
    if(loaded) return;
    loaded=true;
    loadTodayMenu().then(()=>cmDecoratePublicActions(document)).catch(()=>{});
  };
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        observer.disconnect();
        run();
      }
    },{rootMargin:'260px 0px'});
    observer.observe(box);
  }else{
    window.addEventListener('load',()=>setTimeout(run,900),{once:true});
  }
}

setupAdminLinks();
setupQuoteStepper();
setupLazyVideos();
setupDeferredMenu();
requestAnimationFrame(()=>cmDecoratePublicActions(document));
