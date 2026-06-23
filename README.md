# CM Banquetería — Vitrina + Plataforma Interna

Versión alineada con el plan de trabajo de CM Banquetería: ordenar, medir, regularizar, rentabilizar y proyectar el negocio.

## Qué incluye

- Web pública coherente con el logo e identidad visual de CM Banquetería.
- Página pública como vitrina: restaurant, menú del día, banquetería y cotizaciones.
- Panel interno privado en `/admin.html`.
- Bitácora diaria de observaciones.
- Gastos.
- Compras por imagen: carga de pantallazos, revisión humana, proveedor, gasto y stock controlado.
- Fichas de proveedores con historial de ventas y productos detectados.
- Inventario y stock crítico.
- Generador diario de menús con publicación automática en la web.
- Minutas de preparación para cocina con cantidades confirmables e ingredientes.
- Descarga para pantalla en video MP4 16:9 de 30 segundos.
- Descarga para Instagram en imagen PNG 9:16.
- Seguimiento de la consultoría mediante línea de tiempo de seis hitos.
- Registro de informes y entregables asociados a cada etapa.
- Resumen del avance de la consultoría en el panel principal.
- Entregables individuales con estado, documento y observaciones.
- Actas estandarizadas de terreno con indicadores y versión imprimible.
- Formulario público de cotización acompañado por video promocional.
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

OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-5.5

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
- El módulo de compras por imagen queda disponible en el panel interno como `Compras por imagen` y `Proveedores`.
- El módulo `Minutas cocina` publica la minuta confirmada del día en `/pantalla.html`.
- La imagen se guarda privada en la base de datos y solo se muestra por rutas autenticadas del panel.
- El análisis automático es opcional: si `OPENAI_API_KEY` no está configurada, el documento se crea para completarlo manualmente.
- Ninguna compra modifica gastos ni stock hasta que el administrador revise y confirme el documento.
- Facturas, boletas y comprobantes manuscritos pueden crear gasto; solo las líneas marcadas y asociadas a productos existentes actualizan stock.
- Los comprobantes de pago se vinculan a una compra ya confirmada y no duplican el gasto.
- Los documentos se guardan como enlaces externos, idealmente a Google Drive u otra carpeta documental.
- Para que el video promocional se vea en la web pública, subir también `public/assets/promo-cm-banqueteria-web.mp4` y `public/assets/promo-cm-banqueteria-poster.jpg`.
- Para mostrar videos en pantallas, usar links directos o archivos accesibles públicamente.
