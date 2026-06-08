
const money = value => new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0
}).format(value || 0);

const state = {
  menu: [],
  cart: []
};

const menuList = document.querySelector("#menuList");
const cartItems = document.querySelector("#cartItems");
const cartTotal = document.querySelector("#cartTotal");
const modal = document.querySelector("#checkoutModal");
const openCheckout = document.querySelector("#openCheckout");
const closeCheckout = document.querySelector("#closeCheckout");
const checkoutForm = document.querySelector("#checkoutForm");
const deliveryType = document.querySelector("#deliveryType");
const addressLine = document.querySelector("#addressLine");

async function loadMenu() {
  const res = await fetch("/api/menu");
  const data = await res.json();
  state.menu = data.menu;
  renderMenu();
  renderCart();
}

function renderMenu() {
  menuList.innerHTML = state.menu.map(item => `
    <article class="card menu-card">
      <div class="menu-img">${item.name}</div>
      <div class="menu-content">
        <div class="menu-top">
          <h3>${item.name}</h3>
          <div class="price">${money(item.price)}</div>
        </div>
        <p>${item.description}</p>
        <div class="tags">
          ${item.tags.map(tag => `<span class="tag">${tag}</span>`).join("")}
        </div>
        <div class="stock ${item.stock <= 3 ? "low" : ""}">
          ${item.stock > 0 ? `Disponibles: ${item.stock}` : "Agotado"}
        </div>
        <button class="btn btn-primary" ${item.stock <= 0 ? "disabled" : ""} onclick="addToCart('${item.id}')">
          Agregar al pedido
        </button>
      </div>
    </article>
  `).join("");
}

function addToCart(menuId) {
  const menuItem = state.menu.find(item => item.id === menuId);
  const current = state.cart.find(item => item.menuId === menuId);
  const currentQty = current?.quantity || 0;

  if (!menuItem || currentQty >= menuItem.stock) {
    alert("No hay más stock disponible para este producto.");
    return;
  }

  if (current) current.quantity += 1;
  else state.cart.push({ menuId, quantity: 1 });

  renderCart();
}

function changeQty(menuId, delta) {
  const current = state.cart.find(item => item.menuId === menuId);
  const menuItem = state.menu.find(item => item.id === menuId);
  if (!current || !menuItem) return;

  current.quantity += delta;

  if (current.quantity <= 0) {
    state.cart = state.cart.filter(item => item.menuId !== menuId);
  }

  if (current.quantity > menuItem.stock) {
    current.quantity = menuItem.stock;
  }

  renderCart();
}

function calculateTotal(includeDelivery = false) {
  const subtotal = state.cart.reduce((acc, item) => {
    const menuItem = state.menu.find(m => m.id === item.menuId);
    return acc + (menuItem ? menuItem.price * item.quantity : 0);
  }, 0);

  return subtotal + (includeDelivery ? 1500 : 0);
}

function renderCart() {
  if (state.cart.length === 0) {
    cartItems.innerHTML = `<p class="form-note">Todavía no has agregado productos.</p>`;
    cartTotal.textContent = money(0);
    return;
  }

  cartItems.innerHTML = state.cart.map(item => {
    const menuItem = state.menu.find(m => m.id === item.menuId);
    return `
      <div class="cart-item">
        <div class="cart-row">
          <strong>${menuItem.name}</strong>
          <span>${money(menuItem.price * item.quantity)}</span>
        </div>
        <div class="cart-row">
          <span>${money(menuItem.price)} c/u</span>
          <div class="qty-actions">
            <button onclick="changeQty('${item.menuId}', -1)">−</button>
            <strong>${item.quantity}</strong>
            <button onclick="changeQty('${item.menuId}', 1)">+</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const includeDelivery = deliveryType?.value === "delivery";
  cartTotal.textContent = money(calculateTotal(includeDelivery));
}

openCheckout?.addEventListener("click", () => {
  if (state.cart.length === 0) {
    alert("Agrega al menos un producto al pedido.");
    return;
  }
  modal.showModal();
  renderCart();
});

closeCheckout?.addEventListener("click", () => modal.close());

deliveryType?.addEventListener("change", () => {
  const isDelivery = deliveryType.value === "delivery";
  addressLine.style.display = isDelivery ? "grid" : "none";
  renderCart();
});

checkoutForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const formData = new FormData(checkoutForm);
  const delivery = formData.get("deliveryType");

  const payload = {
    customer: {
      name: formData.get("name"),
      phone: formData.get("phone")
    },
    deliveryType: delivery,
    address: formData.get("address"),
    reference: formData.get("reference"),
    paymentMethod: "webpay",
    items: state.cart
  };

  try {
    const orderRes = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) throw new Error(orderData.error || "No se pudo crear el pedido.");

    const payRes = await fetch("/api/payments/webpay/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: orderData.orderId })
    });

    const payData = await payRes.json();
    if (!payRes.ok) throw new Error(payData.error || "No se pudo iniciar el pago.");

    window.location.href = payData.paymentUrl;
  } catch (err) {
    alert(err.message);
  }
});

document.querySelector("#quoteForm")?.addEventListener("submit", event => {
  event.preventDefault();
  alert("Solicitud recibida en modo demo. En producción se guardará en el panel interno.");
});

window.addToCart = addToCart;
window.changeQty = changeQty;

if (addressLine) addressLine.style.display = "none";
loadMenu();
