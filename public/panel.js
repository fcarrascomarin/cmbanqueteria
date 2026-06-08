
const money = value => new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0
}).format(value || 0);

let orders = [];
let view = "admin";

const ordersEl = document.querySelector("#orders");
const titleEl = document.querySelector("#panelTitle");
const kickerEl = document.querySelector("#panelKicker");
const descEl = document.querySelector("#panelDescription");

const viewText = {
  admin: {
    kicker: "Administración",
    title: "Pedidos y control general",
    desc: "Acepta pedidos, asigna repartidores, cancela por falta de disponibilidad y gestiona devoluciones."
  },
  cocina: {
    kicker: "Cocina",
    title: "Pedidos para preparar",
    desc: "Marca pedidos como aceptados, en preparación o listos para reparto."
  },
  repartidor: {
    kicker: "Repartidor",
    title: "Portal de reparto",
    desc: "Acepta pedidos disponibles y actualiza el avance visible para el cliente."
  }
};

async function loadOrders() {
  const res = await fetch("/api/orders");
  const data = await res.json();
  orders = data.orders;
  render();
}

function render() {
  const text = viewText[view];
  kickerEl.textContent = text.kicker;
  titleEl.textContent = text.title;
  descEl.textContent = text.desc;

  const filtered = filterOrdersByView(orders);

  if (filtered.length === 0) {
    ordersEl.innerHTML = `<div class="card"><p class="form-note">No hay pedidos para esta vista.</p></div>`;
    return;
  }

  ordersEl.innerHTML = filtered.map(order => `
    <article class="order-card">
      <div class="cart-row" style="align-items:start;">
        <div>
          <span class="status-badge">${order.statusLabel}</span>
          <h3 style="margin-top:10px;">${order.orderNumber}</h3>
          <p class="form-note">
            Cliente: ${order.customer.name} · Teléfono: ${order.customer.phone}<br>
            Entrega: ${order.deliveryType === "delivery" ? "Delivery" : "Retiro en local"} · Total: ${money(order.total)}<br>
            ${order.deliveryType === "delivery" ? `Dirección: ${order.address}` : "Retiro en Costanera Norte 1012"}
          </p>
        </div>
        <a class="btn btn-secondary" href="${order.trackingUrl}" target="_blank">Ver seguimiento</a>
      </div>

      <div>
        ${order.items.map(item => `
          <div class="cart-item">
            <div class="cart-row">
              <strong>${item.quantity} × ${item.name}</strong>
              <span>${money(item.quantity * item.unitPrice)}</span>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="order-actions">
        ${actionsFor(order).join("")}
      </div>
    </article>
  `).join("");
}

function filterOrdersByView(all) {
  if (view === "cocina") {
    return all.filter(o => ["PAGO_CONFIRMADO", "PEDIDO_RECIBIDO", "PEDIDO_ACEPTADO", "EN_PREPARACION"].includes(o.status));
  }

  if (view === "repartidor") {
    return all.filter(o => ["LISTO_REPARTO", "ASIGNADO_REPARTIDOR", "RETIRADO_LOCAL", "EN_CAMINO", "CERCA"].includes(o.status));
  }

  return all;
}

function actionsFor(order) {
  if (view === "cocina") {
    return [
      button(order, "PEDIDO_ACEPTADO", "Aceptar pedido"),
      button(order, "EN_PREPARACION", "En preparación"),
      button(order, "LISTO_REPARTO", "Listo para reparto"),
      refundButton(order)
    ].filter(Boolean);
  }

  if (view === "repartidor") {
    return [
      assignButton(order),
      button(order, "RETIRADO_LOCAL", "Retiré del local", "Repartidor"),
      button(order, "EN_CAMINO", "Voy en camino", "Repartidor"),
      button(order, "CERCA", "Estoy cerca", "Repartidor"),
      button(order, "ENTREGADO", "Entregado", "Repartidor")
    ].filter(Boolean);
  }

  return [
    button(order, "PEDIDO_ACEPTADO", "Aceptar"),
    button(order, "EN_PREPARACION", "Preparación"),
    button(order, "LISTO_REPARTO", "Listo reparto"),
    assignButton(order),
    button(order, "EN_CAMINO", "En camino"),
    button(order, "ENTREGADO", "Entregado"),
    refundButton(order)
  ].filter(Boolean);
}

function button(order, status, label, actor = "Equipo CM") {
  return `<button class="btn btn-secondary" onclick="updateStatus('${order.orderId}', '${status}', '${actor}')">${label}</button>`;
}

function assignButton(order) {
  return `<button class="btn btn-gold" onclick="assignCourier('${order.orderId}')">Asignar repartidor</button>`;
}

function refundButton(order) {
  if (["ENTREGADO", "CANCELADO", "REEMBOLSO_SOLICITADO", "REEMBOLSO_REALIZADO"].includes(order.status)) return "";
  return `<button class="btn btn-secondary" onclick="cancelRefund('${order.orderId}')">Cancelar y devolver</button>`;
}

async function updateStatus(orderId, status, actor = "Equipo CM") {
  const res = await fetch(`/api/orders/${orderId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, actor })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || "No se pudo actualizar.");
  await loadOrders();
}

async function assignCourier(orderId) {
  const courierName = prompt("Nombre del repartidor:", "Repartidor CM");
  if (!courierName) return;

  const res = await fetch(`/api/orders/${orderId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courierName })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || "No se pudo asignar.");
  await loadOrders();
}

async function cancelRefund(orderId) {
  const reason = prompt("Motivo de cancelación:", "Producto no disponible. Se gestionará devolución del pago.");
  if (!reason) return;

  const res = await fetch(`/api/orders/${orderId}/cancel-refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || "No se pudo cancelar.");
  await loadOrders();

  setTimeout(loadOrders, 1500);
}

document.querySelectorAll("[data-view]").forEach(btn => {
  btn.addEventListener("click", () => {
    view = btn.dataset.view;
    render();
  });
});

document.querySelector("#refresh").addEventListener("click", loadOrders);

window.updateStatus = updateStatus;
window.assignCourier = assignCourier;
window.cancelRefund = cancelRefund;

loadOrders();
setInterval(loadOrders, 10000);
