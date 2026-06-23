cfg.purchases=['Compras','Ingreso por imagen'];
cfg.suppliers=['Compras','Proveedores'];
const baseRenderView=renderView;
renderView=async function(view){
  if(view==='purchases'){setHeader(view);return purchases()}
  if(view==='suppliers'){setHeader(view);return suppliers()}
  return baseRenderView(view);
};

const purchaseTypes={factura:'Factura',boleta:'Boleta',comprobante_manual:'Comprobante manuscrito',comprobante_pago:'Comprobante de pago',conteo_stock:'Conteo de stock',otro:'Otro'};
const purchaseStatuses={requiere_revision:'Requiere revisión',confirmado:'Confirmado',posible_duplicado:'Posible duplicado'};
const purchaseCategories=['Alimentos','Verduras','Carnes','Abarrotes','Bebidas','Gas','Luz / agua','Envases','Limpieza','Sueldos / anticipos','Movilización','Mantención','Otros'];

async function purchases(){
  addAction('Ingresar documento',openPurchaseUpload);
  const data=await api('/api/admin/purchase-documents');
  content.innerHTML=`<div class="notice purchase-intro"><strong>Primero se revisa, después se registra.</strong> La imagen propone datos, pero ningún gasto ni movimiento de stock se genera hasta que confirmes el documento.</div>${table(['Fecha','Documento','Proveedor','Total','Stock','Estado','Acciones'],data.items.map(d=>`<tr><td>${fmtDate(d.purchase_date||d.created_at)}</td><td><strong>${purchaseTypes[d.document_type]||safe(d.document_type)}</strong><br><small>${d.document_number?`Folio ${safe(d.document_number)}`:`Registro N° ${d.id}`}</small></td><td>${safe(d.supplier_name||'Sin identificar')}<br><small>${safe(d.supplier_rut||'')}</small></td><td>${money(d.total)}</td><td><span class="badge ${d.stock_status==='confirmado'?'green':d.stock_status==='pendiente'?'red':''}">${d.stock_status==='no_aplica'?'No aplica':d.stock_status==='confirmado'?'Actualizado':'Pendiente'}</span></td><td><span class="badge ${d.status==='confirmado'?'green':d.status==='posible_duplicado'?'red':'blue'}">${purchaseStatuses[d.status]||safe(d.status)}</span></td><td class="row-actions"><button class="btn btn-secondary btn-small" type="button" onclick="openPurchaseReview(${d.id})">${d.status==='confirmado'?'Ver':'Revisar'}</button>${d.status!=='confirmado'?`<button class="btn btn-danger btn-small" type="button" onclick="removePurchaseDocument(${d.id})">Eliminar</button>`:''}</td></tr>`))}`;
}

function openPurchaseUpload(){
  modal.classList.remove('purchase-modal-wide');
  modalForm.classList.add('purchase-upload-form');
  modalForm.innerHTML=`<div><div class="kicker">Nueva compra</div><h2>Cargar comprobante</h2><p class="muted">Fotografía una factura, boleta, comprobante manuscrito o respaldo de pago.</p></div><label class="purchase-dropzone" for="purchaseImage"><strong>Seleccionar imagen</strong><span>JPG, PNG o WebP · máximo 8 MB</span><input id="purchaseImage" name="image" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required></label><img id="purchasePreview" class="purchase-preview hidden" alt="Vista previa del comprobante"><div id="purchaseAnalyzeStatus" class="muted"></div><div class="row-actions"><button class="btn btn-primary" type="submit">Analizar documento</button><button class="btn btn-secondary" id="closePurchaseUpload" type="button">Cancelar</button></div>`;
  const input=modalForm.querySelector('#purchaseImage'),preview=modalForm.querySelector('#purchasePreview');
  input.onchange=()=>{const file=input.files[0];if(!file)return;preview.src=URL.createObjectURL(file);preview.classList.remove('hidden')};
  modalForm.querySelector('#closePurchaseUpload').onclick=()=>modal.close();
  modalForm.onsubmit=async event=>{event.preventDefault();const button=event.submitter,status=modalForm.querySelector('#purchaseAnalyzeStatus');try{button.disabled=true;button.textContent='Leyendo imagen...';status.textContent='El documento se guardará como borrador para tu revisión.';const image=await preparePurchaseImage(input.files[0]);const result=await api('/api/admin/purchase-documents/analyze',{method:'POST',body:JSON.stringify({image})});modal.close();await openPurchaseReview(result.id)}catch(error){status.className='menu-publish-status error';status.textContent=error.message}finally{button.disabled=false;button.textContent='Analizar documento'}};
  modal.showModal();
}

async function preparePurchaseImage(file){
  if(!file)throw Error('Selecciona una imagen.');
  const source=window.createImageBitmap?await createImageBitmap(file):await new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('No se pudo abrir la imagen.'))};image.src=url}),max=1800,scale=Math.min(1,max/Math.max(source.width,source.height)),canvas=document.createElement('canvas');
  canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);source.close?.();
  return canvas.toDataURL('image/jpeg',.86);
}

function purchaseItemRow(item={},inventory=[]){
  const options=['<option value="">Selecciona producto</option>'].concat(inventory.map(x=>`<option value="${x.id}" ${Number(item.inventory_item_id)===Number(x.id)?'selected':''}>${safe(x.name)} (${safe(x.unit)})</option>`)).join('');
  return `<div class="purchase-item-row"><div class="purchase-item-main"><div class="form-line"><label>Descripción leída</label><input data-key="description" value="${safe(item.description||'')}"></div><div class="form-line"><label>Producto de stock</label><select data-key="inventory_item_id">${options}</select></div></div><div class="purchase-item-values"><div class="form-line"><label>Cantidad</label><input data-key="quantity" type="number" min="0" step="0.001" value="${item.quantity??''}"></div><div class="form-line"><label>Unidad</label><input data-key="unit" value="${safe(item.unit||'')}"></div><div class="form-line"><label>Precio unit.</label><input data-key="unit_price" type="number" min="0" value="${item.unit_price??''}"></div><div class="form-line"><label>Subtotal</label><input data-key="line_total" type="number" min="0" value="${item.line_total??''}"></div></div><div class="purchase-item-footer"><label class="check-line"><input data-key="affects_stock" type="checkbox" ${item.affects_stock?'checked':''}> Actualizar stock al confirmar</label><button class="btn btn-danger btn-small" type="button" data-remove-item>Quitar</button></div></div>`;
}

async function openPurchaseReview(id){
  const [detail,inventoryData,documents]=await Promise.all([api(`/api/admin/purchase-documents/${id}`),api('/api/admin/inventory_items'),api('/api/admin/purchase-documents')]),d=detail.item,locked=d.status==='confirmado';
  modal.classList.add('purchase-modal-wide');modalForm.classList.add('purchase-review-form');
  const typeOptions=Object.entries(purchaseTypes).map(([value,label])=>`<option value="${value}" ${d.document_type===value?'selected':''}>${label}</option>`).join(''),categoryOptions=purchaseCategories.map(x=>`<option ${d.category===x?'selected':''}>${x}</option>`).join(''),linkedOptions=['<option value="">Selecciona compra confirmada</option>'].concat(documents.items.filter(x=>x.status==='confirmado'&&x.document_type!=='comprobante_pago').map(x=>`<option value="${x.id}" ${Number(d.linked_document_id)===Number(x.id)?'selected':''}>N° ${x.id} · ${safe(x.supplier_name||'Sin proveedor')} · ${money(x.total)}</option>`)).join('');
  modalForm.innerHTML=`<div class="purchase-review-head"><div><div class="kicker">Revisión obligatoria</div><h2>Documento N° ${d.id}</h2><p class="muted">Los campos pueden corregirse antes de generar el gasto o actualizar stock.</p></div><span class="badge ${locked?'green':'blue'}">${purchaseStatuses[d.status]}</span></div><div class="purchase-review-layout"><aside><img class="purchase-document-image" src="${d.image_url}" alt="Documento cargado"><a class="btn btn-secondary btn-small" href="${d.image_url}" target="_blank">Abrir imagen</a></aside><section class="purchase-fields"><div class="two-cols"><div class="form-line"><label>Tipo</label><select name="document_type">${typeOptions}</select></div><div class="form-line"><label>Fecha</label><input name="purchase_date" type="date" value="${String(d.purchase_date||'').slice(0,10)}" required></div></div><div class="two-cols">${field('supplier_name','Proveedor','text',safe(d.supplier_name||''))}${field('supplier_rut','RUT','text',safe(d.supplier_rut||''))}</div><div class="two-cols">${field('document_number','Folio / número','text',safe(d.document_number||''))}<div class="form-line"><label>Categoría</label><select name="category">${categoryOptions}</select></div></div><div class="purchase-totals">${field('subtotal','Neto','number',d.subtotal??'','min="0"')}${field('tax','IVA','number',d.tax??'','min="0"')}${field('total','Total','number',d.total??0,'min="0" required')}</div><div class="two-cols">${field('payment_method','Medio de pago','text',safe(d.payment_method||''))}<div class="form-line"><label>Estado del pago</label><select name="payment_status"><option value="pagado" ${d.payment_status==='pagado'?'selected':''}>Pagado</option><option value="pendiente" ${d.payment_status==='pendiente'?'selected':''}>Pendiente</option></select></div></div><div class="form-line linked-purchase-field ${d.document_type==='comprobante_pago'?'':'hidden'}"><label>Compra asociada al comprobante de pago</label><select name="linked_document_id">${linkedOptions}</select></div>${textArea('notes','Observaciones',safe(d.notes||''))}</section></div>${(d.extraction_warnings||[]).length?`<div class="notice warning-list"><strong>Revisar:</strong><ul>${d.extraction_warnings.map(x=>`<li>${safe(x)}</li>`).join('')}</ul></div>`:''}<div class="purchase-items-head"><div><h3>Productos</h3><p class="muted">El stock solo cambia en las filas marcadas y asociadas a un producto existente.</p></div>${locked?'':'<button class="btn btn-secondary btn-small" type="button" id="addPurchaseItem">Agregar producto</button>'}</div><div id="purchaseItems">${d.items.map(x=>purchaseItemRow(x,inventoryData.items)).join('')||'<p class="muted empty-purchase-items">El documento no incluye detalle de productos. Puedes registrarlo solo como gasto o agregar las líneas manualmente.</p>'}</div><div class="purchase-form-actions"><button class="btn btn-primary" type="submit" ${locked?'disabled':''}>Guardar revisión</button><button class="btn btn-primary confirm-purchase" id="confirmPurchase" type="button" ${locked?'disabled':''}>Confirmar ingreso</button><button class="btn btn-secondary" id="closePurchaseReview" type="button">Cerrar</button></div>`;
  const typeSelect=modalForm.elements.document_type,linkedField=modalForm.querySelector('.linked-purchase-field');typeSelect.onchange=()=>linkedField.classList.toggle('hidden',typeSelect.value!=='comprobante_pago');
  const bindRemove=()=>modalForm.querySelectorAll('[data-remove-item]').forEach(b=>b.onclick=()=>b.closest('.purchase-item-row').remove());bindRemove();
  if(!locked)modalForm.querySelector('#addPurchaseItem').onclick=()=>{modalForm.querySelector('.empty-purchase-items')?.remove();modalForm.querySelector('#purchaseItems').insertAdjacentHTML('beforeend',purchaseItemRow({},inventoryData.items));bindRemove()};
  modalForm.querySelector('#closePurchaseReview').onclick=()=>modal.close();
  const save=async()=>{const payload=collectPurchaseReview(modalForm);await api(`/api/admin/purchase-documents/${id}`,{method:'PUT',body:JSON.stringify(payload)})};
  modalForm.onsubmit=async e=>{e.preventDefault();try{await save();modal.close();purchases()}catch(error){alert(error.message)}};
  modalForm.querySelector('#confirmPurchase').onclick=async e=>{if(!confirm('¿Confirmar este documento? Esta acción registrará el gasto y los movimientos de stock seleccionados.'))return;try{e.currentTarget.disabled=true;await save();await api(`/api/admin/purchase-documents/${id}/confirm`,{method:'POST',body:'{}'});modal.close();purchases()}catch(error){alert(error.message);e.currentTarget.disabled=false}};
  modal.showModal();
  if(locked)modalForm.querySelectorAll('input,select,textarea,[data-remove-item]').forEach(control=>control.disabled=true);
}

function collectPurchaseReview(form){
  const base=Object.fromEntries(new FormData(form).entries());
  base.items=[...form.querySelectorAll('.purchase-item-row')].map(row=>{const value=key=>row.querySelector(`[data-key="${key}"]`)?.value||null;return {description:value('description'),inventory_item_id:value('inventory_item_id'),quantity:value('quantity'),unit:value('unit'),unit_price:value('unit_price'),line_total:value('line_total'),affects_stock:Boolean(row.querySelector('[data-key="affects_stock"]')?.checked)}});
  return base;
}

window.openPurchaseReview=openPurchaseReview;
window.removePurchaseDocument=async id=>{if(!confirm('¿Eliminar este documento pendiente?'))return;await api(`/api/admin/purchase-documents/${id}`,{method:'DELETE'});purchases()};

async function suppliers(){
  addAction('Agregar proveedor',()=>openSupplierForm());
  const data=await api('/api/admin/suppliers');
  content.innerHTML=`<div class="notice"><strong>Ficha e historial por proveedor.</strong> Puedes crear proveedores manualmente. Al confirmar boletas y facturas, el historial alimenta las sugerencias de productos para futuras imágenes.</div>${table(['Proveedor','RUT','Rubro','Productos habituales','Compras','Total','Última compra','Acciones'],data.items.map(s=>`<tr><td><strong>${safe(s.name)}</strong><br><small>${safe(s.contact_name||'')}</small></td><td>${safe(s.rut||'')}</td><td>${safe(s.business_type||'')}</td><td>${safe(s.usual_products||'')}</td><td>${s.purchase_count||0}</td><td>${money(s.purchase_total)}</td><td>${fmtDate(s.last_purchase_date)}</td><td class="row-actions"><button class="btn btn-secondary btn-small" type="button" onclick="openSupplierDetail(${s.id})">Ficha</button><button class="btn btn-secondary btn-small" type="button" onclick="editSupplier(${s.id})">Editar</button></td></tr>`))}`;
  cache.suppliers=data.items;
}

function supplierFormHtml(s={}){
  return `<div class="two-cols">${field('name','Nombre proveedor','text',safe(s.name||''),'required')}${field('rut','RUT','text',safe(s.rut||''))}</div><div class="two-cols">${field('business_type','Rubro / tipo de venta','text',safe(s.business_type||''))}${field('usual_products','Productos habituales','text',safe(s.usual_products||''))}</div><div class="two-cols">${field('contact_name','Persona de contacto','text',safe(s.contact_name||''))}${field('phone','Teléfono','text',safe(s.phone||''))}</div>${field('email','Correo','email',safe(s.email||''))}${textArea('notes','Observaciones',safe(s.notes||''))}`;
}

function openSupplierForm(s=null){
  const isEdit=Boolean(s?.id);
  openForm(isEdit?'Editar proveedor':'Agregar proveedor',supplierFormHtml(s||{}),async e=>{
    e.preventDefault();
    const payload=Object.fromEntries(new FormData(e.currentTarget).entries());
    await api(isEdit?`/api/admin/suppliers/${s.id}`:'/api/admin/suppliers',{method:isEdit?'PATCH':'POST',body:JSON.stringify(payload)});
    modal.close();
    suppliers();
  });
}

window.editSupplier=id=>{const s=(cache.suppliers||[]).find(x=>Number(x.id)===Number(id));if(s)openSupplierForm(s)};

window.openSupplierDetail=async id=>{
  const detail=await api(`/api/admin/suppliers/${id}`),s=detail.item;
  modal.classList.add('purchase-modal-wide');
  modalForm.classList.remove('purchase-review-form','purchase-upload-form');
  modalForm.innerHTML=`<div class="supplier-profile-head"><div><div class="kicker">Ficha proveedor</div><h2>${safe(s.name)}</h2><p class="muted">${safe(s.rut||'Sin RUT registrado')}</p></div><div class="row-actions"><button class="btn btn-secondary btn-small" type="button" id="editSupplierFromDetail">Editar ficha</button><button class="btn btn-secondary btn-small" type="button" id="closeSupplierDetail">Cerrar</button></div></div><div class="supplier-summary"><article><span>Rubro</span><strong>${safe(s.business_type||'Sin clasificar')}</strong></article><article><span>Productos habituales</span><strong>${safe(s.usual_products||'Sin registro')}</strong></article><article><span>Contacto</span><strong>${safe(s.contact_name||s.phone||s.email||'Sin contacto')}</strong></article></div><section class="supplier-history-grid"><div><h3>Historial de ventas</h3>${table(['Fecha','Documento','Total','Pago','Stock'],detail.documents.map(d=>`<tr><td>${fmtDate(d.purchase_date)}</td><td>${purchaseTypes[d.document_type]||safe(d.document_type)}<br><small>${safe(d.document_number||'')}</small></td><td>${money(d.total)}</td><td>${safe(d.payment_status||'')}<br><small>${safe(d.payment_method||'')}</small></td><td>${safe(d.stock_status||'')}</td></tr>`))}</div><div><h3>Productos detectados</h3><div class="supplier-products-list">${detail.products.map(p=>`<article><strong>${safe(p.inventory_name||p.description)}</strong><span>${safe(p.description)} · ${p.times} compra(s)</span><small>${Number(p.total_quantity||0)} ${safe(p.unit||'')} · ${money(p.total_amount)}</small></article>`).join('')||'<p class="muted">Sin productos confirmados todavía.</p>'}</div></div></section>`;
  modalForm.querySelector('#closeSupplierDetail').onclick=()=>modal.close();
  modalForm.querySelector('#editSupplierFromDetail').onclick=()=>{modal.close();setTimeout(()=>openSupplierForm(s),0)};
  modal.showModal();
};

modal.addEventListener('close',()=>{modal.classList.remove('purchase-modal-wide');modalForm.classList.remove('purchase-review-form','purchase-upload-form')});
