# CM Banquetería — Vitrina + Plataforma Interna

Versión alineada con el plan de trabajo de CM Banquetería: ordenar, medir, regularizar, rentabilizar y proyectar el negocio.

## Qué incluye

- Web pública coherente con el logo e identidad visual de CM Banquetería.
- Página pública como vitrina: restaurant, menú del día, banquetería y cotizaciones.
- Panel interno privado en `/admin.html`.
- Bitácora diaria de observaciones.
- Gastos.
- Inventario y stock crítico.
- Menús diarios editables.
- Minutas semanales.
- Costeo/raciones.
- Cotizaciones de eventos.
- Personal.
- Documentos con links y vencimientos.
- Base de videos e imágenes para pantallas del restaurant en `/pantalla.html`.
- Envío opcional de cotizaciones por Zoho SMTP.
- Persistencia en Neon Postgres.

## Variables de entorno en Render

```env
DATABASE_URL=postgresql://...
SITE_URL=https://cmbanqueteria.cl
ADMIN_USER=admin@cmbanqueteria.cl
ADMIN_PASS=una_clave_segura
SESSION_SECRET=un_secreto_largo

SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=cotizaciones@cmbanqueteria.cl
SMTP_PASS=clave_o_app_password
MAIL_TO=cotizaciones@cmbanqueteria.cl
MAIL_FROM="CM Banquetería" <cotizaciones@cmbanqueteria.cl>
```

## Rutas principales

- `/` web pública.
- `/admin.html` panel interno.
- `/pantalla.html` vista para TV/pantallas del restaurant.
- `/health` estado del servidor.

## Instalación local

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

## Notas

- No subir `.env` a GitHub.
- Los documentos se guardan como enlaces externos, idealmente a Google Drive u otra carpeta documental.
- Para mostrar videos en pantallas, usar links directos o archivos accesibles públicamente.
