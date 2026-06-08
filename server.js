
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { nanoid } = require("nanoid");

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/**
 * Base en memoria para demo.
 * En producción reemplazar por PostgreSQL/MySQL/Supabase/Firebase/etc.
 */
const menu = [
  {
    id: "menu-1",
    name: "Colación casera gourmet",
    description: "Plato del día con sabor de casa, montaje cuidado y acompañamiento fresco.",
    price: 5500,
    stock: 18,
    image: "/assets/plato-1.jpg",
    tags: ["Casero", "Gourmet", "Almuerzo"]
  },
  {
    id: "menu-2",
    name: "Almuerzo ejecutivo CM",
    description: "Preparación abundante y equilibrada para la jornada laboral.",
    price: 6200,
    stock: 12,
    image: "/assets/plato-2.jpg",
    tags: ["Ejecutivo", "Restaurant"]
  },
  {
    id: "menu-3",
    name: "Menú especial del chef",
    description: "Receta familiar con presentación especial y selección de acompañamientos.",
    price: 7500,
    stock: 8,
    image: "/assets/plato-3.jpg",
    tags: ["Especial", "Gourmet"]
  }
];

const orders = new Map();

const statusMessages = {
  PENDIENTE_PAGO: "Tu pedido fue creado, pero aún falta confirmar el pago.",
  PAGO_CONFIRMADO: "El pago fue aprobado correctamente.",
  PEDIDO_RECIBIDO: "Hemos recibido tu pedido.",
  PEDIDO_ACEPTADO: "CM Banquetería confirmó tu pedido.",
  EN_PREPARACION: "Estamos preparando tu colación.",
  LISTO_REPARTO: "Tu pedido está listo para salir a reparto.",
  ASIGNADO_REPARTIDOR: "Tu pedido fue asignado a un repartidor.",
  RETIRADO_LOCAL: "El repartidor retiró tu pedido del local.",
  EN_CAMINO: "Tu pedido ya salió a reparto.",
  CERCA: "Tu repartidor está cerca de la dirección indicada.",
  ENTREGADO: "Tu pedido fue entregado. Gracias por preferirnos.",
  CANCELADO: "El pedido fue cancelado. Revisa el motivo informado.",
  REEMBOLSO_SOLICITADO: "Hemos iniciado la gestión de devolución del pago.",
  REEMBOLSO_REALIZADO: "La devolución fue registrada como realizada."
};

function now() {
  return new Date().toISOString();
}

function publicOrder(order) {
  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    trackingToken: order.trackingToken,
    trackingUrl: `${SITE_URL}/seguimiento.html?pedido=${order.orderNumber}&token=${order.trackingToken}`,
    customer: {
      name: order.customer.name,
      phone: maskPhone(order.customer.phone)
    },
    deliveryType: order.deliveryType,
    address: order.deliveryType === "delivery" ? order.address : "Retiro en local",
    total: order.total,
    status: order.status,
    statusLabel: labelStatus(order.status),
    timeline: order.timeline,
    items: order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    })),
    courier: order.courier || null,
    createdAt: order.createdAt
  };
}

function maskPhone(phone) {
  if (!phone) return "";
  return phone.length > 4 ? `•••• ${phone.slice(-4)}` : phone;
}

function labelStatus(status) {
  const labels = {
    PENDIENTE_PAGO: "Pendiente de pago",
    PAGO_CONFIRMADO: "Pago confirmado",
    PEDIDO_RECIBIDO: "Pedido recibido",
    PEDIDO_ACEPTADO: "Pedido aceptado",
    EN_PREPARACION: "En preparación",
    LISTO_REPARTO: "Listo para reparto",
    ASIGNADO_REPARTIDOR: "Asignado a repartidor",
    RETIRADO_LOCAL: "Retirado del local",
    EN_CAMINO: "En camino",
    CERCA: "Repartidor cerca",
    ENTREGADO: "Entregado",
    CANCELADO: "Cancelado",
    REEMBOLSO_SOLICITADO: "Reembolso solicitado",
    REEMBOLSO_REALIZADO: "Reembolso realizado"
  };
  return labels[status] || status;
}

function addTimeline(order, status, actor = "Sistema", customMessage = null) {
  order.status = status;
  order.timeline.push({
    at: now(),
    status,
    label: labelStatus(status),
    actor,
    message: customMessage || statusMessages[status] || "Estado actualizado."
  });
}

function makeOrderNumber() {
  const serial = String(orders.size + 1).padStart(4, "0");
  return `CM-${serial}`;
}

function findMenuItem(id) {
  return menu.find(item => item.id === id);
}

function releaseStock(order) {
  if (order.stockReleased) return;
  for (const item of order.items) {
    const menuItem = findMenuItem(item.menuId);
    if (menuItem) menuItem.stock += item.quantity;
  }
  order.stockReleased = true;
}

app.get("/api/menu", (req, res) => {
  res.json({ menu });
});

app.post("/api/orders", (req, res) => {
  const { customer, deliveryType, address, reference, items, paymentMethod } = req.body;

  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: "Faltan datos del cliente." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "El pedido no tiene productos." });
  }

  if (deliveryType === "delivery" && !address) {
    return res.status(400).json({ error: "Falta dirección de entrega." });
  }

  const orderItems = [];
  let total = 0;

  for (const requested of items) {
    const menuItem = findMenuItem(requested.menuId);
    const quantity = Number(requested.quantity || 0);

    if (!menuItem || quantity <= 0) {
      return res.status(400).json({ error: "Producto inválido." });
    }

    if (menuItem.stock < quantity) {
      return res.status(409).json({ error: `No hay stock suficiente para ${menuItem.name}.` });
    }

    orderItems.push({
      menuId: menuItem.id,
      name: menuItem.name,
      quantity,
      unitPrice: menuItem.price
    });

    total += menuItem.price * quantity;
  }

  // Costo demo de reparto.
  if (deliveryType === "delivery") total += 1500;

  // Reserva de stock temporal desde creación del pedido.
  for (const item of orderItems) {
    const menuItem = findMenuItem(item.menuId);
    menuItem.stock -= item.quantity;
  }

  const orderId = nanoid();
  const order = {
    orderId,
    orderNumber: makeOrderNumber(),
    trackingToken: nanoid(16),
    customer,
    deliveryType: deliveryType || "pickup",
    address: address || "",
    reference: reference || "",
    items: orderItems,
    total,
    paymentMethod: paymentMethod || "webpay",
    payment: {
      provider: "webpay",
      mode: process.env.WEBPAY_ENV || "mock",
      status: "PENDIENTE",
      token: null,
      transactionId: null
    },
    status: "PENDIENTE_PAGO",
    courier: null,
    stockReleased: false,
    createdAt: now(),
    timeline: []
  };

  addTimeline(order, "PENDIENTE_PAGO", "Sistema");
  orders.set(orderId, order);

  res.status(201).json({
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    total: order.total,
    trackingUrl: `${SITE_URL}/seguimiento.html?pedido=${order.orderNumber}&token=${order.trackingToken}`
  });
});

/**
 * Webpay mock.
 * Producción: aquí crear transacción real con SDK oficial de Transbank.
 */
app.post("/api/payments/webpay/create", (req, res) => {
  const { orderId } = req.body;
  const order = orders.get(orderId);

  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
  if (order.status !== "PENDIENTE_PAGO") return res.status(409).json({ error: "El pedido no está pendiente de pago." });

  const token = `mock_${nanoid(10)}`;
  order.payment.token = token;

  // Simula redirección a Webpay y retorno aprobado.
  res.json({
    mode: "mock",
    paymentUrl: `${SITE_URL}/pago-demo.html?orderId=${order.orderId}&token=${token}`,
    token
  });
});

app.post("/api/payments/mock/approve", (req, res) => {
  const { orderId, token } = req.body;
  const order = orders.get(orderId);

  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
  if (order.payment.token !== token) return res.status(400).json({ error: "Token inválido." });

  order.payment.status = "APROBADO";
  order.payment.transactionId = `TX-${nanoid(8)}`;

  addTimeline(order, "PAGO_CONFIRMADO", "Webpay demo");
  addTimeline(order, "PEDIDO_RECIBIDO", "Sistema");

  res.json({
    ok: true,
    order: publicOrder(order)
  });
});

app.get("/api/orders", (req, res) => {
  res.json({ orders: Array.from(orders.values()).map(publicOrder) });
});

app.get("/api/orders/track", (req, res) => {
  const { phone, orderNumber, token } = req.query;

  const order = Array.from(orders.values()).find(o => {
    const byLink = token && o.orderNumber === orderNumber && o.trackingToken === token;
    const byPhone = phone && orderNumber && o.orderNumber === orderNumber && normalize(o.customer.phone) === normalize(phone);
    return byLink || byPhone;
  });

  if (!order) {
    return res.status(404).json({ error: "No encontramos un pedido con esos datos." });
  }

  res.json({ order: publicOrder(order) });
});

function normalize(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

app.post("/api/orders/:orderId/status", (req, res) => {
  const { orderId } = req.params;
  const { status, actor, message } = req.body;
  const order = orders.get(orderId);

  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
  if (!statusMessages[status]) return res.status(400).json({ error: "Estado inválido." });

  addTimeline(order, status, actor || "Equipo CM", message || null);

  res.json({ order: publicOrder(order) });
});

app.post("/api/orders/:orderId/assign", (req, res) => {
  const { orderId } = req.params;
  const { courierName } = req.body;
  const order = orders.get(orderId);

  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
  if (!courierName) return res.status(400).json({ error: "Falta nombre del repartidor." });

  order.courier = { name: courierName };
  addTimeline(order, "ASIGNADO_REPARTIDOR", courierName);

  res.json({ order: publicOrder(order) });
});

app.post("/api/orders/:orderId/cancel-refund", (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const order = orders.get(orderId);

  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });

  releaseStock(order);

  addTimeline(order, "CANCELADO", "Administración", reason || "Pedido cancelado.");
  addTimeline(order, "REEMBOLSO_SOLICITADO", "Administración", "Se registró la solicitud de devolución del pago.");

  // Producción: ejecutar refund/anulación con Webpay según corresponda.
  setTimeout(() => {
    const current = orders.get(orderId);
    if (current && current.status === "REEMBOLSO_SOLICITADO") {
      addTimeline(current, "REEMBOLSO_REALIZADO", "Webpay demo");
    }
  }, 1200);

  res.json({ order: publicOrder(order) });
});

app.listen(PORT, () => {
  console.log(`CM Banquetería base corriendo en ${SITE_URL}`);
});
