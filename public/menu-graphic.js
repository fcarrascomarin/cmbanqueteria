(function(){
  const colors={wine:'#7c0b19',deep:'#4a0610',cream:'#fffaf4',gold:'#d6a64f',white:'#fffdf9'};
  let logoPromise;

  function loadLogo(){
    if(!logoPromise)logoPromise=new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='/assets/logo-cm.png'});
    return logoPromise;
  }

  function rounded(ctx,x,y,w,h,r,fill,stroke,line=2){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke()}
  }

  function cloth(ctx,w,h){
    ctx.fillStyle=colors.deep;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.translate(w/2,h/2);ctx.rotate(-Math.PI/7);ctx.translate(-w/2,-h/2);
    const size=Math.max(64,Math.round(w/15));
    for(let y=-h;y<h*2;y+=size){for(let x=-w;x<w*2;x+=size){ctx.fillStyle=((x/size+y/size)&1)?'#8e1824':'#66101a';ctx.fillRect(x,y,size,size)}}
    ctx.globalAlpha=.18;ctx.strokeStyle='#f5d8d5';ctx.lineWidth=2;
    for(let x=-w;x<w*2;x+=size/4){ctx.beginPath();ctx.moveTo(x,-h);ctx.lineTo(x,h*2);ctx.stroke()}
    ctx.restore();
    const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(35,0,7,.22)');g.addColorStop(.5,'rgba(124,11,25,.16)');g.addColorStop(1,'rgba(25,0,5,.42)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  }

  function fit(ctx,text,maxWidth,startSize,minSize=24,weight=700,family='Montserrat, Arial, sans-serif'){
    let size=startSize;do{ctx.font=`${weight} ${size}px ${family}`;if(ctx.measureText(text).width<=maxWidth||size<=minSize)return size;size-=2}while(size>minSize);return minSize
  }

  function centerText(ctx,text,x,y,maxWidth,startSize,minSize=24,weight=700,color=colors.white){
    fit(ctx,text,maxWidth,startSize,minSize,weight);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y)
  }

  function dateLabel(value){
    if(!value)return 'Menú de hoy';
    const date=new Date(`${value}T12:00:00`),raw=new Intl.DateTimeFormat('es-CL',{weekday:'long',day:'numeric',month:'long'}).format(date);
    return raw.charAt(0).toUpperCase()+raw.slice(1);
  }

  function priceLabel(value){return new Intl.NumberFormat('es-CL',{maximumFractionDigits:0}).format(Number(value||0))}

  function drawLogo(ctx,logo,x,y,size){
    ctx.save();ctx.beginPath();ctx.arc(x+size/2,y+size/2,size/2,0,Math.PI*2);ctx.clip();ctx.fillStyle=colors.white;ctx.fillRect(x,y,size,size);if(logo)ctx.drawImage(logo,x,y,size,size);ctx.restore();ctx.strokeStyle=colors.gold;ctx.lineWidth=Math.max(3,size*.025);ctx.beginPath();ctx.arc(x+size/2,y+size/2,size/2,0,Math.PI*2);ctx.stroke()
  }

  function drawLandscape(ctx,m,logo){
    const w=1920,h=1080;cloth(ctx,w,h);ctx.strokeStyle=colors.white;ctx.lineWidth=7;ctx.strokeRect(45,45,w-90,h-90);ctx.lineWidth=2;ctx.strokeRect(60,60,w-120,h-120);
    drawLogo(ctx,logo,185,85,190);
    ctx.fillStyle=colors.white;ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='900 132px Montserrat, Arial, sans-serif';ctx.fillText('MENÚ',445,188);ctx.font='700 70px Montserrat, Arial, sans-serif';ctx.fillText('DEL DÍA',1050,200);ctx.fillRect(1048,245,520,3);
    rounded(ctx,300,285,1320,64,24,'rgba(72,3,13,.72)',colors.white,2);centerText(ctx,'13:00–16:00     •     +56 9 8774 1182     •     COSTANERA NORTE 1012, LAJA',960,317,1240,31,23,600);
    centerText(ctx,dateLabel(m.menu_date),960,410,1250,64,38,700);
    const pills=[['SOPA/ENS.',315],['PROTEÍNA',610],['ACOMPAÑAMIENTO',955],['POSTRE',1395]];
    pills.forEach(([label,x],i)=>{const width=i===2?390:250;rounded(ctx,x,475,width,60,30,'rgba(101,5,17,.88)',colors.white,3);centerText(ctx,label,x+width/2,506,width-25,28,20,800)});
    const options=[m.option_1||m.main_dish,m.option_2||m.side_dish,m.option_3||m.salad];
    options.forEach((text,i)=>{const y=570+i*105;rounded(ctx,410,y,1100,78,18,'rgba(67,2,11,.62)','rgba(255,255,255,.34)',2);rounded(ctx,430,y+14,50,50,25,colors.white);ctx.fillStyle=colors.wine;ctx.font='900 26px Montserrat, Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),455,y+39);centerText(ctx,text||`Opción ${i+1}`,990,y+39,970,42,26,700)});
    rounded(ctx,360,900,1200,92,22,colors.cream,colors.white,4);ctx.fillStyle=colors.wine;ctx.textAlign='center';ctx.textBaseline='middle';fit(ctx,`Cambio de acompañamiento por papas fritas +$${priceLabel(m.accompaniment_change_price)}`,1080,40,25,800);ctx.fillText(`Cambio de acompañamiento por papas fritas +$${priceLabel(m.accompaniment_change_price)}`,960,947);
  }

  function drawPortrait(ctx,m,logo){
    const w=1080,h=1920;cloth(ctx,w,h);ctx.strokeStyle=colors.white;ctx.lineWidth=6;ctx.strokeRect(35,35,w-70,h-70);ctx.lineWidth=2;ctx.strokeRect(50,50,w-100,h-100);
    drawLogo(ctx,logo,405,95,270);centerText(ctx,'MENÚ DEL DÍA',540,445,930,86,50,900);ctx.fillStyle=colors.gold;ctx.fillRect(235,510,610,4);
    rounded(ctx,115,555,850,120,30,'rgba(72,3,13,.72)',colors.white,2);centerText(ctx,'13:00–16:00  •  +56 9 8774 1182',540,590,780,31,23,700);centerText(ctx,'COSTANERA NORTE 1012, LAJA',540,635,780,27,20,600);
    centerText(ctx,dateLabel(m.menu_date),540,760,900,58,36,700);
    centerText(ctx,'SOPA O ENSALADA  +  PLATO  +  POSTRE',540,855,930,31,21,800);
    const options=[m.option_1||m.main_dish,m.option_2||m.side_dish,m.option_3||m.salad];
    options.forEach((text,i)=>{const y=925+i*210;rounded(ctx,100,y,880,158,24,'rgba(67,2,11,.68)','rgba(255,255,255,.38)',2);rounded(ctx,140,y+49,60,60,30,colors.white);ctx.fillStyle=colors.wine;ctx.font='900 31px Montserrat, Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),170,y+79);centerText(ctx,text||`Opción ${i+1}`,595,y+79,720,45,27,700)});
    rounded(ctx,90,1605,900,150,28,colors.cream,colors.white,4);centerText(ctx,'CAMBIA TU ACOMPAÑAMIENTO',540,1655,820,34,24,800,colors.wine);centerText(ctx,`Papas fritas +$${priceLabel(m.accompaniment_change_price)}`,540,1710,780,43,28,900,colors.wine);centerText(ctx,'CM BANQUETERÍA • LAJA, CHILE',540,1820,850,25,20,700);
  }

  async function render(menu,format='landscape'){
    await document.fonts?.ready;const logo=await loadLogo(),canvas=document.createElement('canvas');
    canvas.width=format==='portrait'?1080:1920;canvas.height=format==='portrait'?1920:1080;
    const ctx=canvas.getContext('2d');if(format==='portrait')drawPortrait(ctx,menu,logo);else drawLandscape(ctx,menu,logo);return canvas
  }

  function download(canvas,name){const a=document.createElement('a');a.download=name;a.href=canvas.toDataURL('image/png');a.click()}

  window.CMMenuGraphic={render,download,dateLabel};
})();
