const id=new URLSearchParams(location.search).get('id');
const set=(target,value,fallback='No informado')=>document.querySelector(target).textContent=value||fallback;
const date=value=>value?new Date(value).toLocaleDateString('es-CL',{timeZone:'UTC'}):'No informado';

async function loadActa(){
  if(!id)return document.body.textContent='Acta no especificada.';
  const res=await fetch(`/api/admin/consultation/records/${id}`),data=await res.json();
  if(!res.ok)throw Error(data.error||'No se pudo cargar el acta.');
  const a=data.item;document.title=`Acta ${a.id} · CM Banquetería`;
  set('#actaNumber',`Acta N° ${String(a.id).padStart(4,'0')}`);set('#recordDate',date(a.record_date));set('#actionType',a.action_type);set('#milestone',`Hito ${a.milestone_order??a.week_number} · ${a.milestone_title}`);set('#deliverable',a.deliverable_title,'Acta general del hito');set('#location',a.institution_location);set('#participants',a.participants);set('#objective',a.objective);set('#facts',a.facts);set('#observations',a.observations);set('#agreements',a.agreements);set('#responsible',a.responsible);set('#dueDate',date(a.due_date));set('#nextSteps',a.next_steps);
  const indicatorData=[['Menús vendidos',a.menus_sold],['Venta diaria',a.daily_sales?new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(a.daily_sales):null],['Espera promedio',a.average_wait_minutes?`${a.average_wait_minutes} minutos`:null],['Horas registradas',a.staff_hours],['Mermas observadas',a.waste_notes]].filter(x=>x[1]);
  if(indicatorData.length){const box=document.querySelector('#indicators');indicatorData.forEach(([label,value])=>{const item=document.createElement('div'),caption=document.createElement('span'),detail=document.createElement('strong');caption.textContent=label;detail.textContent=value;item.append(caption,detail);box.appendChild(item)})}else document.querySelector('#indicatorSection').remove();
  if(a.evidence_url){const link=document.querySelector('#evidence');link.href=a.evidence_url}else document.querySelector('#evidenceSection').remove();
  if(new URLSearchParams(location.search).get('print')==='1')setTimeout(()=>window.print(),350);
}

loadActa().catch(error=>{const page=document.querySelector('#actaPage');page.textContent='';const title=document.createElement('h1'),text=document.createElement('p');title.textContent=error.message;text.textContent='Inicia sesión nuevamente en el panel administrativo.';page.append(title,text)});
