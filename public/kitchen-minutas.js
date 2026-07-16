cfg.kitchenMinutas=['Cocina','Minutas de preparación'];
const kitchenBaseRenderView=renderView;
renderView=async function(view){
  let result;
  if(view==='kitchenMinutas'){setHeader(view);result=await kitchenMinutas();requestAnimationFrame(()=>window.cmAdminAfterRender?.());return result}
  result=await kitchenBaseRenderView(view);
  requestAnimationFrame(()=>window.cmAdminAfterRender?.());
  return result;
};

function minutaStatusBadge(status){
  return `<span class="badge ${status==='confirmada'?'green':'blue'}">${status==='confirmada'?'Confirmada':'Borrador'}</span>`;
}

async function kitchenMinutas(){
  addAction('Crear minuta',()=>openKitchenMinutaForm());
  const data=await api('/api/admin/kitchen-minutas');
  content.innerHTML=`<div class="notice"><strong>Minutas de preparación para cocina.</strong> Registra las preparaciones, confirma cantidades e ingredientes, y publica la minuta confirmada en la pantalla interna del restaurant.</div>${table(['Fecha','Minuta','Raciones','Preparaciones','Ingredientes','Estado','Acciones'],data.items.map(m=>`<tr><td>${fmtDate(m.minuta_date)}</td><td><strong>${safe(m.title)}</strong><br><small>${safe(m.notes||'')}</small></td><td>${m.planned_portions||0}</td><td>${m.preparation_count||0}</td><td>${m.confirmed_ingredient_count||0}/${m.ingredient_count||0}</td><td>${minutaStatusBadge(m.status)}</td><td class="row-actions"><button class="btn btn-secondary btn-small" type="button" onclick="openKitchenMinutaForm(${m.id})">Ver / editar</button>${m.status!=='confirmada'?`<button class="btn btn-primary btn-small" type="button" onclick="confirmKitchenMinuta(${m.id})">Confirmar</button>`:''}<button class="btn btn-danger btn-small" type="button" onclick="removeKitchenMinuta(${m.id})">Eliminar</button></td></tr>`))}`;
}

function ingredientOptions(inventory=[],selected=''){
  return ['<option value="">Sin producto de stock</option>'].concat(inventory.map(x=>`<option value="${x.id}" ${Number(selected)===Number(x.id)?'selected':''}>${safe(x.name)} (${safe(x.unit)})</option>`)).join('');
}

function kitchenIngredientRow(item={},inventory=[]){
  return `<div class="minuta-ingredient-row" data-ingredient-row><div class="form-line"><label>Ingrediente</label><input data-ing="ingredient_name" value="${safe(item.ingredient_name||item.name||'')}" placeholder="Ej.: papas, posta, zanahoria"></div><div class="form-line"><label>Stock asociado</label><select data-ing="inventory_item_id">${ingredientOptions(inventory,item.inventory_item_id)}</select></div><div class="form-line"><label>Cantidad</label><input data-ing="quantity" type="number" min="0" step="0.001" value="${item.quantity??''}"></div><div class="form-line"><label>Unidad</label><input data-ing="unit" value="${safe(item.unit||item.inventory_unit||'')}"></div><label class="check-line minuta-confirm-check"><input data-ing="confirmed" type="checkbox" ${item.confirmed?'checked':''}> Confirmado</label><button class="btn btn-danger btn-small" type="button" data-remove-ingredient>Quitar</button></div>`;
}

function kitchenPrepBlock(prep={},inventory=[]){
  const ingredients=(prep.ingredients&&prep.ingredients.length?prep.ingredients:[{}]).map(i=>kitchenIngredientRow(i,inventory)).join('');
  return `<article class="minuta-prep-card" data-prep-row><div class="minuta-prep-head"><div class="form-line"><label>Preparación</label><input data-prep="name" value="${safe(prep.name||'')}" placeholder="Ej.: Estofado mixto" required></div><div class="form-line"><label>Raciones</label><input data-prep="servings" type="number" min="0" value="${prep.servings??''}"></div><button class="btn btn-danger btn-small" type="button" data-remove-prep>Eliminar preparación</button></div><div class="form-line"><label>Notas de preparación</label><input data-prep="notes" value="${safe(prep.notes||'')}" placeholder="Indicaciones para cocina"></div><div class="minuta-ingredients" data-ingredients>${ingredients}</div><button class="btn btn-secondary btn-small" type="button" data-add-ingredient>Agregar ingrediente</button></article>`;
}

async function openKitchenMinutaForm(id=null){
  const [detail,inventoryData]=await Promise.all([
    id?api(`/api/admin/kitchen-minutas/${id}`):Promise.resolve({item:{minuta_date:today(),title:'',planned_portions:0,notes:'',status:'borrador',preparations:[{name:'',servings:'',notes:'',ingredients:[{}]}]}}),
    api('/api/admin/inventory_items')
  ]);
  const minuta=detail.item,inventory=inventoryData.items||[];
  modal.classList.add('purchase-modal-wide','minuta-modal');
  modalForm.classList.add('minuta-form');
  modalForm.innerHTML=`<div class="purchase-review-head"><div><div class="kicker">Minutas cocina</div><h2>${id?'Editar minuta':'Crear minuta'}</h2><p class="muted">Confirma cantidades antes de publicar en pantalla de cocina.</p></div>${minutaStatusBadge(minuta.status||'borrador')}</div><div class="two-cols">${field('minuta_date','Fecha','date',String(minuta.minuta_date||today()).slice(0,10),'required')}${field('title','Nombre de la minuta','text',safe(minuta.title||''),'required')}</div><div class="two-cols">${field('planned_portions','Raciones planificadas','number',minuta.planned_portions||0,'min="0"')}<div></div></div>${textArea('notes','Notas generales',safe(minuta.notes||''))}<div class="minuta-toolbar"><h3>Preparaciones</h3><button class="btn btn-secondary btn-small" type="button" id="addKitchenPrep">Agregar preparación</button></div><div id="kitchenPrepList">${(minuta.preparations&&minuta.preparations.length?minuta.preparations:[{}]).map(p=>kitchenPrepBlock(p,inventory)).join('')}</div><div class="purchase-form-actions"><button class="btn btn-primary" type="submit">Guardar</button>${id?'<button class="btn btn-primary" id="saveAndConfirmMinuta" type="button">Guardar y confirmar</button>':'<button class="btn btn-primary" id="saveAndConfirmMinuta" type="button">Crear y confirmar</button>'}<button class="btn btn-secondary" id="closeKitchenMinuta" type="button">Cerrar</button></div>`;

  const prepList=modalForm.querySelector('#kitchenPrepList');
  const bindMinutaControls=()=>{
    modalForm.querySelectorAll('[data-remove-prep]').forEach(b=>b.onclick=()=>b.closest('[data-prep-row]').remove());
    modalForm.querySelectorAll('[data-add-ingredient]').forEach(b=>b.onclick=()=>{b.closest('[data-prep-row]').querySelector('[data-ingredients]').insertAdjacentHTML('beforeend',kitchenIngredientRow({},inventory));bindMinutaControls()});
    modalForm.querySelectorAll('[data-remove-ingredient]').forEach(b=>b.onclick=()=>b.closest('[data-ingredient-row]').remove());
  };
  bindMinutaControls();
  modalForm.querySelector('#addKitchenPrep').onclick=()=>{prepList.insertAdjacentHTML('beforeend',kitchenPrepBlock({ingredients:[{}]},inventory));bindMinutaControls()};
  modalForm.querySelector('#closeKitchenMinuta').onclick=()=>modal.close();

  const save=async(status='borrador')=>{
    const payload=collectKitchenMinutaForm(modalForm,status);
    const result=await api(id?`/api/admin/kitchen-minutas/${id}`:'/api/admin/kitchen-minutas',{method:id?'PUT':'POST',body:JSON.stringify(payload)});
    return result.item;
  };
  modalForm.onsubmit=async e=>{e.preventDefault();try{await save(minuta.status==='confirmada'?'confirmada':'borrador');modal.close();kitchenMinutas()}catch(error){alert(error.message)}};
  modalForm.querySelector('#saveAndConfirmMinuta').onclick=async()=>{try{const saved=await save('confirmada');if(saved?.id)await api(`/api/admin/kitchen-minutas/${saved.id}/confirm`,{method:'POST',body:'{}'});modal.close();kitchenMinutas()}catch(error){alert(error.message)}};
  modal.showModal();
}

function collectKitchenMinutaForm(form,status){
  const base=Object.fromEntries(new FormData(form).entries());
  base.status=status;
  base.preparations=[...form.querySelectorAll('[data-prep-row]')].map(prep=>({
    name:prep.querySelector('[data-prep="name"]')?.value||'',
    servings:prep.querySelector('[data-prep="servings"]')?.value||null,
    notes:prep.querySelector('[data-prep="notes"]')?.value||null,
    ingredients:[...prep.querySelectorAll('[data-ingredient-row]')].map(row=>({
      ingredient_name:row.querySelector('[data-ing="ingredient_name"]')?.value||'',
      inventory_item_id:row.querySelector('[data-ing="inventory_item_id"]')?.value||null,
      quantity:row.querySelector('[data-ing="quantity"]')?.value||null,
      unit:row.querySelector('[data-ing="unit"]')?.value||null,
      confirmed:Boolean(row.querySelector('[data-ing="confirmed"]')?.checked)
    })).filter(x=>x.ingredient_name)
  })).filter(x=>x.name);
  return base;
}

window.openKitchenMinutaForm=openKitchenMinutaForm;
window.confirmKitchenMinuta=async id=>{if(!confirm('¿Confirmar esta minuta y mostrarla en pantalla de cocina si corresponde a hoy?'))return;await api(`/api/admin/kitchen-minutas/${id}/confirm`,{method:'POST',body:'{}'});kitchenMinutas()};
window.removeKitchenMinuta=async id=>{if(!confirm('¿Eliminar esta minuta de cocina?'))return;await api(`/api/admin/kitchen-minutas/${id}`,{method:'DELETE'});kitchenMinutas()};

modal.addEventListener('close',()=>{modal.classList.remove('minuta-modal');modalForm.classList.remove('minuta-form')});
