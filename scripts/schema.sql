CREATE SEQUENCE IF NOT EXISTS order_serial START 1;

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image TEXT,
  tags TEXT[] DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  tracking_token TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_phone_normalized TEXT NOT NULL,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('pickup', 'delivery')),
  address TEXT,
  reference TEXT,
  total INTEGER NOT NULL CHECK (total >= 0),
  payment_provider TEXT NOT NULL DEFAULT 'webpay',
  payment_mode TEXT NOT NULL DEFAULT 'mock',
  payment_status TEXT NOT NULL DEFAULT 'PENDIENTE',
  payment_token TEXT,
  payment_transaction_id TEXT,
  status TEXT NOT NULL,
  courier_name TEXT,
  stock_released BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_id TEXT REFERENCES menu_items(id),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS order_timeline (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  label TEXT NOT NULL,
  actor TEXT NOT NULL,
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_phone_number ON orders(customer_phone_normalized, order_number);
CREATE INDEX IF NOT EXISTS idx_timeline_order ON order_timeline(order_id, at);


-- Datos históricos iniciales CM Restaurant · abril a julio de 2026.
-- Se insertan únicamente si la fecha todavía no existe, para no reemplazar correcciones posteriores de la administradora.
WITH seed(financial_date,customers_count,income,personnel_cost,basic_expenses,food_cost) AS (VALUES
  ('2026-04-24'::date,62,403100,77000,15000,161400),
  ('2026-04-27'::date,49,317000,77000,15000,132930),
  ('2026-04-28'::date,35,225000,77000,15000,111307),
  ('2026-04-29'::date,38,247500,77000,15000,100672),
  ('2026-04-30'::date,54,352941,77000,15000,151881),
  ('2026-05-04'::date,56,362326,77000,15000,177684),
  ('2026-05-05'::date,66,430000,77000,15000,198378),
  ('2026-05-06'::date,85,555700,77000,15000,240625),
  ('2026-05-07'::date,86,556800,77000,15000,235604),
  ('2026-05-08'::date,70,452100,77000,15000,148415),
  ('2026-05-11'::date,30,193000,77000,15000,78005),
  ('2026-05-12'::date,16,105900,77000,15000,49581),
  ('2026-05-13'::date,58,379600,136000,15000,143478),
  ('2026-05-14'::date,81,529600,131600,15000,227930),
  ('2026-05-15'::date,51,333900,131600,15000,145084),
  ('2026-05-18'::date,78,506600,131600,15000,258014),
  ('2026-05-19'::date,87,562800,131600,15000,195878),
  ('2026-05-20'::date,23,148900,75000,15000,73889),
  ('2026-05-21'::date,23,148900,75000,15000,56249),
  ('2026-05-22'::date,60,388100,131600,15000,126706),
  ('2026-05-25'::date,98,639000,131600,15000,262865),
  ('2026-05-26'::date,39,252000,108500,15000,82638),
  ('2026-05-27'::date,27,176000,121500,15000,65163),
  ('2026-05-29'::date,38,246000,75000,15000,66152),
  ('2026-06-01'::date,28,179500,103500,15000,77355),
  ('2026-06-02'::date,41,264000,131600,15000,89267),
  ('2026-06-03'::date,25,162000,131600,15000,81814),
  ('2026-06-09'::date,30,198000,121500,15000,88007),
  ('2026-06-10'::date,30,198000,121500,15000,93712),
  ('2026-06-11'::date,85,550900,131600,15000,226680),
  ('2026-06-12'::date,113,737000,196500,15000,258292),
  ('2026-06-15'::date,70,452100,131600,15000,144905),
  ('2026-06-16'::date,40,258000,121500,15000,96795),
  ('2026-06-17'::date,38,247500,136000,15000,93460),
  ('2026-06-19'::date,41,264000,131600,15000,119041),
  ('2026-06-22'::date,18,120000,131600,15000,58946),
  ('2026-06-23'::date,22,141600,130000,15000,64606),
  ('2026-06-24'::date,26,167000,121500,15000,49025),
  ('2026-06-25'::date,23,150000,121500,15000,78504),
  ('2026-07-01'::date,50,350000,129500,15000,97282),
  ('2026-07-03'::date,50,350000,146500,15000,107739),
  ('2026-07-04'::date,34,240000,121600,15000,95427),
  ('2026-07-06'::date,27,189000,121500,15000,71451),
  ('2026-07-07'::date,32,225000,146500,15000,83497),
  ('2026-07-08'::date,22,154000,121500,15000,71278),
  ('2026-07-13'::date,13,91000,95000,15000,55015),
  ('2026-07-14'::date,35,245000,100000,15000,95759),
  ('2026-07-15'::date,31,217000,110000,15000,78294),
  ('2026-07-17'::date,24,168000,95000,15000,67664),
  ('2026-07-20'::date,29,203000,95000,15000,73214),
  ('2026-07-21'::date,29,203000,95000,15000,83777),
  ('2026-07-22'::date,29,203000,95000,15000,70819),
  ('2026-07-23'::date,14,98000,95000,15000,67276)
), inserted AS (
  INSERT INTO daily_financials(financial_date,customers_count,income,personnel_cost,basic_expenses,notes)
  SELECT financial_date,customers_count,income,personnel_cost,basic_expenses,
    'Registro histórico abril-julio 2026 importado desde la planilla inicial de CM. El costo de alimentos está consolidado y puede reemplazarse por su desglose real mediante Editar.'
  FROM seed
  ON CONFLICT(financial_date) DO NOTHING
  RETURNING id,financial_date
)
INSERT INTO daily_cost_items(financial_id,category,item_name,quantity,unit,unit_cost,total_cost,notes)
SELECT i.id,'Ingredientes','Costo de alimentos consolidado',1,'jornada',s.food_cost,s.food_cost,
  'Carga inicial histórica. Editar para corregir el monto o sustituirlo por insumos detallados.'
FROM inserted i JOIN seed s USING(financial_date);
