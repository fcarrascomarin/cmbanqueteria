
const money = value => new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0
}).format(value || 0);

const result = document.querySelector("#orderResult");
const form = document.querySelector("#trackForm");

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

async function fetchOrder({ orderNumber, phone, token }) {
  const params = new URLSearchParams();
  if (orderNumber) params.set("orderNumber", orderNumber);
  if (phone) params.set("phone", phone);
  if (token) params.set("token", token);

  const res = await fetch(`/api/orders/track?${params.toString()}`);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "No encontramos ese pedido.");
  return data.order;
}

function renderOrder(order) {
  result.classList.remove("hidden");
  result.innerHTML = `
    <div class="card">
      <div class="cart-row" style="align-items:start;">
        <div>
          <div class="kicker">Pedido ${order.orderNumber}</div>
          <h2>${order.statusLabel}</h2>
          <p class="form-note">Total: <strong>${money(order.total)}</strong> · Entrega: ${order.deliveryType === "delivery" ? "Delivery" : "Retiro en local"}</p>
        </div>
        <span class="status-badge">${order.statusLabel}</span>
      </div>

      <div class="notice">
        Enlace único de seguimiento:<br>
        <a href="${order.trackingUrl}">${order.trackingUrl}</a>
      </div>

      <h3 style="margin-top:22px;">Detalle</h3>
      ${order.items.map(item => `
        <div class="cart-item">
          <div class="cart-row">
            <strong>${item.quantity} × ${item.name}</strong>
            <span>${money(item.unitPrice * item.quantity)}</span>
          </div>
        </div>
      `).join("")}

      <h3 style="margin-top:22px;">Línea de tiempo</h3>
      <div class="timeline">
        ${order.timeline.map(entry => `
          <article class="timeline-item">
            <div class="timeline-time">${fmtTime(entry.at)}</div>
            <div>
              <div class="timeline-label">${entry.label}</div>
              <div class="timeline-message">${entry.message}</div>
              <small>Actualizado por: ${entry.actor}</small>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const data = new FormData(form);
  try {
    const order = await fetchOrder({
      orderNumber: data.get("orderNumber"),
      phone: data.get("phone")
    });
    renderOrder(order);
  } catch (err) {
    alert(err.message);
  }
});

async function autoLoadFromLink() {
  const params = new URLSearchParams(location.search);
  const orderNumber = params.get("pedido");
  const token = params.get("token");

  if (!orderNumber || !token) return;

  form.orderNumber.value = orderNumber;

  try {
    const order = await fetchOrder({ orderNumber, token });
    renderOrder(order);
  } catch (err) {
    alert(err.message);
  }
}

autoLoadFromLink();
