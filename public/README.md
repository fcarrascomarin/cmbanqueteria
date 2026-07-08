# CM Banquetería — Web pública + Plataforma Interna

Versión pública actualizada para explicar con claridad las tres líneas de CM:

1. **CM Restaurant | Desde 2026**: menú del día, almuerzos caseros y atención diurna de lunes a viernes, 12:00 a 15:00 hrs.
2. **CM Banquetería | Desde 2013**: eventos familiares, empresas, celebraciones, coffee break, almuerzos, cenas y servicios a medida.
3. **CM Experiencias | Cartelera**: funciones con reserva, partiendo por “Mitos y Verdades de Laja” frente a Laguna La Señoraza.

La web pública prioriza conversión por WhatsApp, cotización ordenada, menú del día ligado al Restaurant, ubicación con mapa y una galería real del local funcionando como restaurant y banquetería. La plataforma interna se mantiene en `/admin.html`.

## Qué incluye esta actualización

- Hero principal con mensaje: “CM Banquetería, Restaurant y Experiencias”.
- Navegación pública ordenada: Restaurant, Banquetería, Experiencias, Cotiza y Cómo llegar.
- Botón de acceso interno más discreto.
- Sección Restaurant con menú del día dinámico desde el panel interno.
- Sección Banquetería con galería real de montajes y preparaciones.
- Sección CM Experiencias actualizada como cartelera, con información pública de “Mitos y Verdades de Laja”, sin exponer costos internos ni gobernanza del proyecto.
- Formulario de cotización que abre WhatsApp con los datos preparados y también intenta registrar la solicitud en el panel interno.
- Sección “Cómo llegar” con dirección, botones de contacto y mapa embebido.
- Imágenes optimizadas en `public/assets/web/`, incluyendo hero de portada comprimido y selección curada para Restaurant, Banquetería, Experiencias, Contacto y Cómo llegar.

## Rutas principales

- `/` web pública.
- `/admin.html` panel interno.
- `/pantalla.html` vista para TV/pantallas del restaurant.
- `/health` estado del servidor.

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
- La web pública no expone costos, diagnóstico, trámites, hoja de ruta ni información interna de la consultoría.
- CM Experiencias aparece como cartelera con reserva; los detalles internos del dossier no deben exponerse en la web pública.
- El menú del día depende del panel interno y de `/api/public/menu/today`.
