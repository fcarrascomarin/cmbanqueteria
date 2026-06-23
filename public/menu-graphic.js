(function(){
  const colors={wine:'#780b16',deep:'#41030a',cream:'#fbf7f2',white:'#fffdf9'};
  let landscapeTemplatePromise,portraitTemplatePromise;

  function loadTemplate(format){
    const portrait=format==='portrait';
    if(portrait&&!portraitTemplatePromise)portraitTemplatePromise=new Promise(resolve=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='/assets/menu-instagram-template.png?v=20260622-final'});
    if(!portrait&&!landscapeTemplatePromise)landscapeTemplatePromise=new Promise(resolve=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='/assets/menu-template.png?v=20260623-consultoria'});
    return portrait?portraitTemplatePromise:landscapeTemplatePromise;
  }

  let sweetTemplatePromise;
  function loadSweetTemplate(){
    if(!sweetTemplatePromise)sweetTemplatePromise=new Promise(resolve=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='/assets/sweet-promo-template.png?v=20260623'});
    return sweetTemplatePromise;
  }

  function fit(ctx,text,maxWidth,startSize,minSize=24,weight=700,family='"Roboto Condensed", Arial, sans-serif'){
    let size=startSize;
    do{ctx.font=`${weight} ${size}px ${family}`;if(ctx.measureText(text).width<=maxWidth||size<=minSize)return size;size-=2}while(size>minSize);
    return minSize;
  }

  function centered(ctx,text,x,y,maxWidth,startSize,minSize=24,weight=700,family='"Roboto Condensed", Arial, sans-serif',color=colors.white){
    fit(ctx,text,maxWidth,startSize,minSize,weight,family);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);
  }

  function wrappedCentered(ctx,text,x,y,maxWidth,lineHeight,startSize,minSize=26){
    fit(ctx,text,maxWidth,startSize,minSize,800,'"Montserrat", Arial, sans-serif');
    const words=String(text).split(/\s+/),lines=[];
    let line='';
    words.forEach(word=>{const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width<=maxWidth)line=test;else{if(line)lines.push(line);line=word}});
    if(line)lines.push(line);
    const useLines=lines.slice(0,2),startY=y-((useLines.length-1)*lineHeight/2);
    ctx.fillStyle=colors.white;ctx.textAlign='center';ctx.textBaseline='middle';
    useLines.forEach((value,index)=>ctx.fillText(value,x,startY+index*lineHeight));
  }

  function dateLabel(value){
    if(!value)return 'Menú de hoy';
    const date=new Date(`${String(value).slice(0,10)}T12:00:00`),parts=new Intl.DateTimeFormat('es-CL',{weekday:'long',day:'numeric',month:'long'}).formatToParts(date);
    const part=type=>parts.find(item=>item.type===type)?.value||'';
    const cap=text=>text.charAt(0).toUpperCase()+text.slice(1);
    return `${cap(part('weekday'))} ${part('day')} de ${cap(part('month'))}`;
  }

  function menuOptions(menu){return [menu.option_1||menu.main_dish||'Opción 1',menu.option_2||menu.side_dish||'Opción 2',menu.option_3||menu.salad||'Opción 3']}

  function drawFriesIcon(ctx){
    const x=472,y=815,r=50;ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=colors.wine;ctx.fill();ctx.strokeStyle=colors.white;ctx.lineWidth=4;ctx.stroke();ctx.beginPath();ctx.arc(x,y,r-7,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle=colors.white;ctx.lineWidth=4;ctx.lineCap='round';[[450,785,456,823],[462,779,465,821],[475,783,474,823],[487,777,482,823],[498,785,490,824]].forEach(v=>{ctx.beginPath();ctx.moveTo(v[0],v[1]);ctx.lineTo(v[2],v[3]);ctx.stroke()});ctx.beginPath();ctx.moveTo(447,813);ctx.lineTo(455,845);ctx.lineTo(490,845);ctx.lineTo(499,813);ctx.closePath();ctx.stroke();ctx.restore();
  }

  function drawLandscape(ctx,menu,template){
    const w=1920,h=1080;if(template)ctx.drawImage(template,0,0,w,h);else{ctx.fillStyle=colors.deep;ctx.fillRect(0,0,w,h)}
    centered(ctx,dateLabel(menu.menu_date),960,449,1060,92,62,400,'Allura, "Brush Script MT", cursive');
    menuOptions(menu).forEach((text,index)=>centered(ctx,text,960,625+index*50,720,43,29,700));
    drawFriesIcon(ctx);
    const price=Math.max(0,Math.round(Number(menu.accompaniment_change_price||0))),label=`Cambio de acompañamiento por papas fritas +$${price}`;
    centered(ctx,label,1020,815,1040,42,27,700,'"Roboto Condensed", Arial, sans-serif',colors.wine);
  }

  function drawPortrait(ctx,menu,template){
    const w=1080,h=1920;if(template)ctx.drawImage(template,0,0,w,h);else{ctx.fillStyle=colors.deep;ctx.fillRect(0,0,w,h)}
    menuOptions(menu).forEach((text,index)=>wrappedCentered(ctx,text,558,779+137*index,570,34,34,23));
  }

  async function render(menu,format='landscape'){
    const fonts=document.fonts?Promise.allSettled([document.fonts.load('400 92px Allura'),document.fonts.load('700 43px "Roboto Condensed"')]):Promise.resolve();
    const fontTimeout=new Promise(resolve=>setTimeout(resolve,650));
    const templateTimeout=new Promise(resolve=>setTimeout(()=>resolve(null),1800));
    const [template]=await Promise.all([Promise.race([loadTemplate(format),templateTimeout]),Promise.race([fonts,fontTimeout])]),canvas=document.createElement('canvas');canvas.width=format==='portrait'?1080:1920;canvas.height=format==='portrait'?1920:1080;
    const ctx=canvas.getContext('2d');if(format==='portrait')drawPortrait(ctx,menu,template);else drawLandscape(ctx,menu,template);return canvas;
  }

  function download(canvas,name){const a=document.createElement('a');a.download=name;a.href=canvas.toDataURL('image/png');a.click()}

  function drawCover(ctx,img,x,y,w,h){
    const scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale,sx=(img.width-sw)/2,sy=(img.height-sh)/2;
    ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
  }

  function clipEllipse(ctx,x,y,w,h){
    ctx.beginPath();
    ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);
    ctx.clip();
  }

  function sweetLine(ctx,text,x,y,maxWidth,size,minSize=46){
    fit(ctx,text,maxWidth,size,minSize,400,'"Playfair Display", Georgia, serif');
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=colors.white;ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=7;ctx.shadowOffsetY=3;ctx.fillText(text,x,y);ctx.shadowColor='transparent';
  }

  function sweetWrapped(ctx,text,x,y,maxWidth,lineHeight,startSize,minSize=54){
    fit(ctx,text,maxWidth,startSize,minSize,400,'"Playfair Display", Georgia, serif');
    const words=String(text||'').split(/\s+/).filter(Boolean),lines=[];let line='';
    words.forEach(word=>{const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width<=maxWidth)line=test;else{if(line)lines.push(line);line=word}});
    if(line)lines.push(line);
    const useLines=lines.slice(0,3),startY=y-((useLines.length-1)*lineHeight/2);
    ctx.fillStyle=colors.white;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
    useLines.forEach((value,index)=>ctx.fillText(value,x,startY+index*lineHeight));
    ctx.shadowColor='transparent';
  }

  async function renderSweetPromo(data={},photo=null){
    const fonts=document.fonts?Promise.allSettled([document.fonts.load('400 110px "Playfair Display"'),document.fonts.load('400 92px "Playfair Display"')]):Promise.resolve();
    const templateTimeout=new Promise(resolve=>setTimeout(()=>resolve(null),1800));
    const [template]=await Promise.all([Promise.race([loadSweetTemplate(),templateTimeout]),Promise.race([fonts,new Promise(resolve=>setTimeout(resolve,650))])]);
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1472;const ctx=canvas.getContext('2d');
    if(template)ctx.drawImage(template,0,0,canvas.width,canvas.height);else{const grd=ctx.createLinearGradient(0,0,0,1472);grd.addColorStop(0,'#780b16');grd.addColorStop(1,'#b10014');ctx.fillStyle=grd;ctx.fillRect(0,0,1080,1472)}
    if(photo){
      ctx.save();clipEllipse(ctx,88,318,635,365);drawCover(ctx,photo,88,318,635,365);ctx.restore();
      ctx.save();clipEllipse(ctx,492,690,420,255);drawCover(ctx,photo,492,690,420,255);ctx.restore();
      ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(405,500,318,182,0,0,Math.PI*2);ctx.stroke();
    }
    sweetWrapped(ctx,data.headline||'¿Quieres endulzar tu día?',660,185,720,94,112,62);
    sweetLine(ctx,data.lead||'Lleva un café con un',540,1160,820,62,42);
    sweetLine(ctx,data.product||'trozo de kuchen por',540,1230,850,74,46);
    const price=String(data.price||'2500').replace(/[^\d]/g,'')||'2500';
    sweetLine(ctx,`$${new Intl.NumberFormat('es-CL').format(Number(price))}`,540,1335,560,112,70);
    ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(220,1335);ctx.lineTo(360,1335);ctx.moveTo(720,1335);ctx.lineTo(860,1335);ctx.stroke();
    return canvas;
  }

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
  window.CMSweetGraphic={render:renderSweetPromo,download};
})();
