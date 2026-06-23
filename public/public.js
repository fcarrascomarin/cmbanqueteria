async function loadTodayMenu(){
  const box=document.querySelector('#todayMenu');
  try{
    const res=await fetch('/api/public/menu/today'),data=await res.json();
    if(!data.menu){
      box.innerHTML='<div class="menu-empty"><h3>Consulta el menú disponible</h3><p class="muted">Hoy aún no se ha publicado un menú. Puedes consultar directamente con CM Banquetería.</p></div>';
      return;
    }
    const menu=data.menu;
    const [landscape,portrait]=await Promise.all([CMMenuGraphic.render(menu,'landscape'),CMMenuGraphic.render(menu,'portrait')]);
    const picture=document.createElement('picture'),source=document.createElement('source'),image=document.createElement('img');
    source.media='(max-width: 620px)';source.srcset=portrait.toDataURL('image/png');
    image.src=landscape.toDataURL('image/png');image.alt=`Menú de CM Banquetería para ${CMMenuGraphic.dateLabel(menu.menu_date)}`;image.className='public-menu-image';
    picture.append(source,image);box.innerHTML='<span class="badge green">Publicado para hoy</span>';box.appendChild(picture);
  }catch(e){box.innerHTML='<p class="muted">No se pudo cargar el menú del día.</p>'}
}

document.querySelector('#quoteForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,payload=Object.fromEntries(new FormData(form).entries()),btn=form.querySelector('button');
  try{btn.disabled=true;btn.textContent='Enviando...';const res=await fetch('/api/public/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await res.json();if(!res.ok)throw Error(data.error||'No se pudo enviar la cotización.');alert('Solicitud enviada correctamente. CM Banquetería se contactará contigo.');form.reset()}
  catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent='Enviar solicitud'}
});

loadTodayMenu();

function loadPromoVideo(){
  const video=document.querySelector('#promoVideo');
  if(!video)return;
  video.setAttribute('aria-label','Video promocional de CM Banquetería');
  video.addEventListener('error',()=>video.closest('.promo-video-card')?.classList.add('video-unavailable'),{once:true});
  video.play().catch(()=>{});
}
loadPromoVideo();
