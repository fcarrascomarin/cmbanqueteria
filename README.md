# CM Banquetería & Restaurant · Panel interno v47

Aplicación administrativa para el uso cotidiano de CM Banquetería & Restaurant. La navegación se concentra en tres áreas: **Inicio**, **Restaurant** y **Gestión interna**.

## Prioridades de uso

1. Registrar y revisar costos diarios.
2. Publicar el menú del día.
3. Registrar reservas, retiros y entregas.
4. Comunicar instrucciones mediante la pantalla interna de cocina.
5. Mantener personal, proveedores, cotizaciones y carpeta documental.

## Cambios de v47

- Contraste reforzado en todo el panel y en la pantalla de cocina.
- Paneles opacos y textos oscuros sobre fondos claros para evitar pérdida de lectura.
- Inicio reorganizado según acciones de la jornada, sin mostrar montos ni totales históricos cargados.
- Tarjetas de costos con cifras adaptables al ancho, sin desbordes.
- Personal con funciones y tareas editables.
- Proveedores con tarjetas, buscador y vista tabular.
- Descarga Excel dinámica para costos, personal y proveedores.
- Carpeta sanitaria con manual y checklist incorporados.
- Subcarpeta visual de documentos operacionales con programas de limpieza, entrega de uniformes y controles internos.
- Base histórica de 53 jornadas de abril a julio de 2026, editable por fecha.

## Arquitectura

- Node.js + Express.
- PostgreSQL.
- Frontend administrativo en `/public/admin.html`.
- Pantalla interna de cocina en `/public/pantalla.html`.
- API y servidor en `server.js`.
- Esquema en `schema.sql` y `scripts/schema.sql`.

## Variables de entorno

Copiar `.env.example` y completar solo en el hosting o entorno local seguro. No guardar credenciales en Git.

Variables principales:

- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `PUBLIC_SITE_URL`
- `MAIL_TO`
- `MAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`

## Instalación local

```bash
npm install
npm start
```

La aplicación ejecuta el esquema y las cargas iniciales al iniciar. Antes de actualizar producción, respaldar la base de datos.

## API y descargas

- `GET /api/admin/daily-financials?month=YYYY-MM`
- `POST /api/admin/daily-financials`
- `DELETE /api/admin/daily-financials/:id`
- `GET /api/admin/daily-financials.xlsx?month=YYYY-MM`
- `GET /api/admin/staff.xlsx`
- `GET /api/admin/suppliers.xlsx`

Todas las rutas administrativas requieren sesión iniciada.

## Documentos incorporados

Los archivos se encuentran en `public/docs/cm` y se muestran en **Gestión interna > Carpeta documental**:

- Manual sanitario base.
- Checklist sanitario operativo por zonas.
- Programa de limpieza de cocina y bodega.
- Programa de limpieza de comedores.
- Entrega de uniformes.
- Formatos internos: charla de cinco minutos, control de frío y control de cocción.

## Orden de despliegue recomendado

1. Respaldar la base de datos.
2. Desplegar panel y backend.
3. Revisar `/healthz`.
4. Iniciar sesión y comprobar Inicio, Restaurant, Costos, Personal, Proveedores y Documentos.
5. Abrir `/pantalla.html` en otra ventana y probar un mensaje a cocina.
6. Descargar un Excel de costos, personal y proveedores.
7. Confirmar que las 53 jornadas históricas siguen siendo editables y no se duplican.

## Legado técnico

Algunas tablas y rutas históricas permanecen en el código para no destruir información anterior. No aparecen en la navegación entregada a la administradora. Su eliminación física solo debe hacerse después de un respaldo y una decisión explícita.
