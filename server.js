require("dotenv").config();
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const { nanoid } = require("nanoid");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

if (!process.env.DATABASE_URL) {
  console.warn("Falta DATABASE_URL. Crea .env local o agrega la variable en Render.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("neon.tech") ? { rejectUnauthorized: false } : undefined
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

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

function labelStatus(status) { return labels[status] || status; }
function normalize(value) { return String(value || "").replace(/[^\d]/g, ""); }
function maskPhone(phone) { return phone && phone.length > 4 ? `•••• ${phone.slice(-4)}` : (phone || ""); }
function trackingUrl(order) { return `${SITE_URL}/seguimiento.html?pedido=${order.order_number}&token=${order.tracking_token}`; }

async function initDb() {
  const schema = fs.readFileSync("./scripts/schema.sql", "utf8");
  await pool.query(schema);
  const count = await pool.query("SELECT COUNT(*)::int AS total FROM menu_items");
  if (count.rows[0].total === 0) {
    await pool.query(`
      INSERT INTO menu_items (id, name, description, price, stock, image, tags)
      VALUES
      ('menu-1', 'Colación casera gourmet', 'Plato del día con sabor de casa, montaje cuidado y acompañamiento fresco.', 5500, 18, '/assets/plato-1.jpg', ARRAY['Casero','Gourmet','Almuerzo']),
      ('menu-2', 'Almuerzo ejecutivo CM', 'Preparación abundante y equilibrada para la jornada laboral.', 6200, 12, '/assets/plato-2.jpg', ARRAY['Ejecutivo','Restaurant']),
      ('menu-3', 'Menú especial del chef', 'Receta familiar con presentación especial y selección de acompañamientos.', 7500, 8, '/assets/plato-3.jpg', ARRAY['Especial','Gourmet'])
      ON CONFLICT (id) DO NOTHING
    `);
  }
}

async function addTimeline(client, orderId, status, actor = "Sistema", customMessage = null) {
  await client.query(
    `INSERT INTO order_timeline (order_id, status, label, actor, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, status, labelStatus(status), actor, customMessage || statusMessages[status] || "Estado actualizado."]
  );
  await client.query("UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2", [status, orderId]);
}

async function fullOrder(orderId) {
  const orderRes = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
  if (!orderRes.rowCount) return null;
  const order = orderRes.rows[0];
  const items = await pool.query("SELECT * FROM order_items WHERE order_id = $1 ORDER BY id", [orderId]);
  const timeline = await pool.query("SELECT * FROM order_timeline WHERE order_id = $1 ORDER BY at, id", [orderId]);
  return publicOrder(order, items.rows, timeline.rows);
}

function publicOrder(order, items = [], timeline = []) {
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    trackingToken: order.tracking_token,
    trackingUrl: trackingUrl(order),
    customer: { name: order.customer_name, phone: maskPhone(order.customer_phone) },
    deliveryType: order.delivery_type,
    address: order.delivery_type === "delivery" ? order.address : "Retiro en local",
    total: order.total,
    status: order.status,
    statusLabel: labelStatus(order.status),
    items: items.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unit_price })),
    timeline: timeline.map(t => ({ at: t.at, status: t.status, label: t.label, actor: t.actor, message: t.message })),
    courier: order.courier_name ? { name: order.courier_name } : null,
    createdAt: order.created_at
  };
}

app.get("/api/menu", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, description, price, stock, image, tags FROM menu_items WHERE active = TRUE ORDER BY created_at, id");
    res.json({ menu: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo cargar el menú." });
  }
});

app.post("/api/orders", async (req, res) => {
  const { customer, deliveryType, address, reference, items } = req.body;
  if (!customer?.name || !customer?.phone) return res.status(400).json({ error: "Faltan datos del cliente." });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "El pedido no tiene productos." });
  if (deliveryType === "delivery" && !address) return res.status(400).json({ error: "Falta dirección de entrega." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const menuIds = items.map(i => i.menuId);
    const menuRes = await client.query("SELECT * FROM menu_items WHERE id = ANY($1::text[]) AND active = TRUE FOR UPDATE", [menuIds]);
    const menu = new Map(menuRes.rows.map(row => [row.id, row]));
    const orderItems = [];
    let total = 0;

    for (const reqItem of items) {
      const m = menu.get(reqItem.menuId);
      const quantity = Number(reqItem.quantity || 0);
      if (!m || quantity <= 0) throw new Error("Producto inválido.");
      if (m.stock < quantity) throw new Error(`No hay stock suficiente para ${m.name}.`);
      await client.query("UPDATE menu_items SET stock = stock - $1, updated_at = NOW() WHERE id = $2", [quantity, m.id]);
      orderItems.push({ menuId: m.id, name: m.name, quantity, unitPrice: m.price });
      total += m.price * quantity;
    }

    if (deliveryType === "delivery") total += 1500;

    const orderId = nanoid();
    const seq = await client.query("SELECT 'CM-' || LPAD(nextval('order_serial')::text, 4, '0') AS order_number");
    const orderNumber = seq.rows[0].order_number;
    const token = nanoid(16);

    await client.query(
      `INSERT INTO orders (id, order_number, tracking_token, customer_name, customer_phone, customer_phone_normalized, delivery_type, address, reference, total, payment_mode, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [orderId, orderNumber, token, customer.name, customer.phone, normalize(customer.phone), deliveryType || "pickup", address || "", reference || "", total, process.env.WEBPAY_ENV || "mock", "PENDIENTE_PAGO"]
    );

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_id, name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)`,
        [orderId, item.menuId, item.name, item.quantity, item.unitPrice]
      );
    }

    await addTimeline(client, orderId, "PENDIENTE_PAGO", "Sistema");
    await client.query("COMMIT");
    res.status(201).json({ orderId, orderNumber, total, trackingUrl: `${SITE_URL}/seguimiento.html?pedido=${orderNumber}&token=${token}` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(409).json({ error: err.message || "No se pudo crear el pedido." });
  } finally {
    client.release();
  }
});

app.post("/api/payments/webpay/create", async (req, res) => {
  const { orderId } = req.body;
  try {
    const order = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
    if (!order.rowCount) return res.status(404).json({ error: "Pedido no encontrado." });
    if (order.rows[0].status !== "PENDIENTE_PAGO") return res.status(409).json({ error: "El pedido no está pendiente de pago." });
    const token = `mock_${nanoid(10)}`;
    await pool.query("UPDATE orders SET payment_token = $1, updated_at = NOW() WHERE id = $2", [token, orderId]);
    res.json({ mode: "mock", paymentUrl: `${SITE_URL}/pago-demo.html?orderId=${orderId}&token=${token}`, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo iniciar el pago." });
  }
});

app.post("/api/payments/mock/approve", async (req, res) => {
  const { orderId, token } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!order.rowCount) throw new Error("Pedido no encontrado.");
    if (order.rows[0].payment_token !== token) throw new Error("Token inválido.");
    await client.query("UPDATE orders SET payment_status = 'APROBADO', payment_transaction_id = $1, updated_at = NOW() WHERE id = $2", [`TX-${nanoid(8)}`, orderId]);
    await addTimeline(client, orderId, "PAGO_CONFIRMADO", "Webpay demo");
    await addTimeline(client, orderId, "PEDIDO_RECIBIDO", "Sistema");
    await client.query("COMMIT");
    res.json({ ok: true, order: await fullOrder(orderId) });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ error: err.message || "No se pudo aprobar el pago." });
  } finally {
    client.release();
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const rows = await pool.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100");
    const result = [];
    for (const order of rows.rows) result.push(await fullOrder(order.id));
    res.json({ orders: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron cargar los pedidos." });
  }
});

app.get("/api/orders/track", async (req, res) => {
  const { phone, orderNumber, token } = req.query;
  try {
    let order;
    if (token && orderNumber) {
      order = await pool.query("SELECT * FROM orders WHERE order_number = $1 AND tracking_token = $2", [orderNumber, token]);
    } else if (phone && orderNumber) {
      order = await pool.query("SELECT * FROM orders WHERE order_number = $1 AND customer_phone_normalized = $2", [orderNumber, normalize(phone)]);
    } else {
      return res.status(400).json({ error: "Ingresa número de pedido y teléfono, o usa el enlace único." });
    }
    if (!order.rowCount) return res.status(404).json({ error: "No encontramos un pedido con esos datos." });
    res.json({ order: await fullOrder(order.rows[0].id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo consultar el pedido." });
  }
});

app.post("/api/orders/:orderId/status", async (req, res) => {
  const { orderId } = req.params;
  const { status, actor, message } = req.body;
  if (!statusMessages[status]) return res.status(400).json({ error: "Estado inválido." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!order.rowCount) throw new Error("Pedido no encontrado.");
    await addTimeline(client, orderId, status, actor || "Equipo CM", message || null);
    await client.query("COMMIT");
    res.json({ order: await fullOrder(orderId) });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(404).json({ error: err.message || "No se pudo actualizar el pedido." });
  } finally {
    client.release();
  }
});

app.post("/api/orders/:orderId/assign", async (req, res) => {
  const { orderId } = req.params;
  const { courierName } = req.body;
  if (!courierName) return res.status(400).json({ error: "Falta nombre del repartidor." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!order.rowCount) throw new Error("Pedido no encontrado.");
    await client.query("UPDATE orders SET courier_name = $1, updated_at = NOW() WHERE id = $2", [courierName, orderId]);
    await addTimeline(client, orderId, "ASIGNADO_REPARTIDOR", courierName);
    await client.query("COMMIT");
    res.json({ order: await fullOrder(orderId) });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(404).json({ error: err.message || "No se pudo asignar repartidor." });
  } finally {
    client.release();
  }
});

app.post("/api/orders/:orderId/cancel-refund", async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderRes = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!orderRes.rowCount) throw new Error("Pedido no encontrado.");
    const order = orderRes.rows[0];
    if (!order.stock_released) {
      const items = await client.query("SELECT * FROM order_items WHERE order_id = $1", [orderId]);
      for (const item of items.rows) {
        await client.query("UPDATE menu_items SET stock = stock + $1, updated_at = NOW() WHERE id = $2", [item.quantity, item.menu_id]);
      }
      await client.query("UPDATE orders SET stock_released = TRUE, updated_at = NOW() WHERE id = $1", [orderId]);
    }
    await addTimeline(client, orderId, "CANCELADO", "Administración", reason || "Pedido cancelado.");
    await addTimeline(client, orderId, "REEMBOLSO_SOLICITADO", "Administración", "Se registró la solicitud de devolución del pago.");
    await client.query("COMMIT");

    setTimeout(async () => {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await addTimeline(c, orderId, "REEMBOLSO_REALIZADO", "Webpay demo");
        await c.query("COMMIT");
      } catch (err) {
        await c.query("ROLLBACK");
        console.error(err);
      } finally {
        c.release();
      }
    }, 1200);

    res.json({ order: await fullOrder(orderId) });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(404).json({ error: err.message || "No se pudo cancelar el pedido." });
  } finally {
    client.release();
  }
});

initDb()
  .then(() => app.listen(PORT, () => console.log(`CM Banquetería con Neon corriendo en ${SITE_URL}`)))
  .catch(err => {
    console.error("No se pudo inicializar Neon/Postgres:", err);
    process.exit(1);
  });
