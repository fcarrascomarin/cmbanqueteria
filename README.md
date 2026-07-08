# CM Banquetería — Web pública + Plataforma Interna

Versión pública actualizada para explicar con claridad las líneas visibles de CM y sumar una capa de confianza mediante la trayectoria de su fundadora, Claudia Méndez.

1. **CM Restaurant**: menú del día, almuerzos caseros y atención diurna de lunes a viernes, 12:00 a 15:00 hrs.
2. **CM Banquetería**: eventos familiares, empresas, celebraciones, coffee break, almuerzos, cenas y servicios a medida.
3. **Trayectoria fundadora**: relato público breve sobre formación hotelera, alimentación colectiva, servicios para empresas, banquetería, etapa educacional y apertura del restaurant familiar.
4. **Espacio y reservas especiales**: línea disponible para consultas, sin cartelera activa por ahora.

La web pública prioriza conversión por WhatsApp, cotización ordenada, menú del día ligado al Restaurant, ubicación con mapa, galería real del local y una presentación más profesional del oficio detrás de CM. La plataforma interna se mantiene en `/admin.html`.

## Qué incluye esta actualización

- Hero principal con el mensaje “Tres maneras de vivir CM en un mismo lugar”.
- Navegación pública ordenada: Restaurant, Banquetería, Trayectoria, Espacio, Cotiza y Cómo llegar.
- Sección Restaurant con menú del día dinámico desde el panel interno.
- Imagen fija del bloque de menú cuando no exista publicación diaria, evitando mostrar menús vencidos.
- Sección Banquetería con galería real de montajes y preparaciones.
- Nueva sección “La experiencia detrás de CM”, con relato fundador y línea de tiempo de Claudia Méndez.
- Sección de espacio y reservas especiales, manteniendo CM Experiencias en suspenso hasta que exista cartelera activa.
- Formulario de cotización que abre WhatsApp con los datos preparados y también intenta registrar la solicitud en el panel interno.
- Sección “Cómo llegar” con dirección, botones de contacto y mapa embebido.
- Imágenes optimizadas en `public/assets/web/`, incluyendo hero de portada comprimido.

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
- Los nombres de terceros se mantienen con redacción prudente. La trayectoria pública evita convertir la página en un currículum extenso.
- El menú del día depende del panel interno y de `/api/public/menu/today`.


## Actualización panel interno · 08 de julio de 2026

Esta versión reemplaza la lógica rígida de “Semana 1 a Semana 6” por el módulo **Proceso de Regularización y Consolidación CM by Metamorfosis Lab**. El proceso queda organizado por hitos, con trazabilidad de hitos realizados, pendientes inmediatos, preparación sanitaria, Drive como respaldo, biblioteca documental, actas y cotizaciones vinculadas al correo institucional `contacto@cmbanqueteria.cl`.

La vista actual está pensada para Claudia + Metamorfosis. La visual de trabajadoras debe desarrollarse después como pantalla separada y mucho más simple.
