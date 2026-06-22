(function(){
  const colors={wine:'#780b16',deep:'#41030a',cream:'#fbf7f2',white:'#fffdf9'};
  let templatePromise;

  function loadTemplate(){
    if(!templatePromise)templatePromise=new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='/assets/menu-template.png?v=20260622'});
    return templatePromise;
  }

  function fit(ctx,text,maxWidth,startSize,minSize=24,weight=700,family='"Roboto Condensed", Arial, sans-serif'){
    let size=startSize;
    do{ctx.font=`${weight} ${size}px ${family}`;if(ctx.measureText(text).width<=maxWidth||size<=minSize)return size;size-=2}while(size>minSize);
    return minSize;
  }

  function centered(ctx,text,x,y,maxWidth,startSize,minSize=24,weight=700,family='"Roboto Condensed", Arial, sans-serif',color=colors.white){
    fit(ctx,text,maxWidth,startSize,minSize,weight,family);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);
  }

  function dateLabel(value){
    if(!value)return 'Menú de hoy';
    const date=new Date(`${String(value).slice(0,10)}T12:00:00`),parts=new Intl.DateTimeFormat('es-CL',{weekday:'long',day:'numeric',month:'long'}).formatToParts(date);
    const part=type=>parts.find(item=>item.type===type)?.value||'';
    const cap=text=>text.charAt(0).toUpperCase()+text.slice(1);
    return `${cap(part('weekday'))} ${part('day')} de ${cap(part('month'))}`;
  }

  function menuOptions(menu){return [menu.option_1||menu.main_dish||'Opción 1',menu.option_2||menu.side_dish||'Opción 2',menu.option_3||menu.salad||'Opción 3']}

 
  function drawLandscape(ctx,menu,template){
    const w=1920,h=1080;if(template)ctx.drawImage(template,0,0,w,h);else{ctx.fillStyle=colors.deep;ctx.fillRect(0,0,w,h)}
    centered(ctx,dateLabel(menu.menu_date),960,449,1060,92,62,400,'Allura, "Brush Script MT", cursive');
    menuOptions(menu).forEach((text,index)=>centered(ctx,text,960,625+index*50,720,43,29,700));
    drawFriesIcon(ctx);
    const price=Math.max(0,Math.round(Number(menu.accompaniment_change_price||0))),label=`Cambio de acompañamiento por papas fritas +$${price}`;
    centered(ctx,label,1020,815,1040,42,27,700,'"Roboto Condensed", Arial, sans-serif',colors.wine);
  }

  function drawPortrait(ctx,menu,template){
    const w=1080,h=1920,landscape=document.createElement('canvas');landscape.width=1920;landscape.height=1080;drawLandscape(landscape.getContext('2d'),menu,template);
    ctx.save();ctx.filter='blur(16px) brightness(.42)';ctx.drawImage(landscape,-1180,0,3413,1920);ctx.restore();ctx.fillStyle='rgba(84,3,15,.52)';ctx.fillRect(0,0,w,h);
    const imageHeight=608,y=(h-imageHeight)/2;ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=32;ctx.drawImage(landscape,0,y,w,imageHeight);ctx.shadowColor='transparent';ctx.strokeStyle=colors.white;ctx.lineWidth=3;ctx.strokeRect(18,y+18,w-36,imageHeight-36);
  }

  async function render(menu,format='landscape'){
    await Promise.all([document.fonts?.load('400 92px Allura'),document.fonts?.load('700 43px "Roboto Condensed"'),document.fonts?.ready]);
    const template=await loadTemplate(),canvas=document.createElement('canvas');canvas.width=format==='portrait'?1080:1920;canvas.height=format==='portrait'?1920:1080;
    const ctx=canvas.getContext('2d');if(format==='portrait')drawPortrait(ctx,menu,template);else drawLandscape(ctx,menu,template);return canvas;
  }

  function download(canvas,name){const a=document.createElement('a');a.download=name;a.href=canvas.toDataURL('image/png');a.click()}

  function recordWebM(source,seconds=30){
    return new Promise((resolve,reject)=>{
      if(!source.captureStream||!window.MediaRecorder)return reject(Error('Este navegador no permite crear videos localmente.'));
      const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(2);
      const types=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'],mimeType=types.find(type=>MediaRecorder.isTypeSupported(type));if(!mimeType)return reject(Error('Este navegador no admite exportación de video WebM.'));
      const parts=[],recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:5000000});recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};recorder.onerror=e=>reject(e.error||Error('No se pudo grabar el video.'));recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());resolve(new Blob(parts,{type:mimeType}))};
      let frame=0;const paint=()=>{ctx.drawImage(source,0,0);ctx.fillStyle=frame++%2?'rgba(255,255,255,.002)':'rgba(255,255,255,.001)';ctx.fillRect(0,0,2,2)};paint();recorder.start(1000);const timer=setInterval(paint,500);setTimeout(()=>{clearInterval(timer);paint();recorder.stop()},seconds*1000);
    });
  }

  window.CMMenuGraphic={render,download,recordWebM,dateLabel};
})();
