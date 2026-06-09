# CM Banquetería & Restaurant — Base con Neon Postgres

Base web con persistencia real en Neon Postgres.

## Uso local

```bash
npm install
cp .env.example .env
npm run dev
```

En Windows PowerShell:

```bash
copy .env.example .env
npm run dev
```

Edita `.env` y agrega tu URL de Neon:

```env
DATABASE_URL=postgresql://usuario:password@host.neon.tech/database?sslmode=require
WEBPAY_ENV=mock
SITE_URL=http://localhost:3000
```

## Render

Variables de entorno:

```env
DATABASE_URL=tu_url_de_neon
WEBPAY_ENV=mock
SITE_URL=https://tu-servicio.onrender.com
```

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

## Tablas

El servidor crea automáticamente las tablas al iniciar. También puedes ver el esquema en:

```text
scripts/schema.sql
```

## Seguridad

No subas `.env` a GitHub. La integración Webpay real debe hacerse desde backend con credenciales reales de Transbank.
