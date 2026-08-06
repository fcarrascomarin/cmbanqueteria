# CM Banquetería & Restaurant · Panel interno v40

Aplicación administrativa para la operación cotidiana de CM Banquetería & Restaurant. Incluye autenticación, menú del día, cotizaciones, compras, inventario, personal, documentos y un nuevo módulo de costos diarios con gráficos y exportación.

## Cambios principales de v40

- Nueva vista **Compras y stock > Costos diarios**.
- Registro diario de clientes, ingresos, personal, gastos básicos e insumos detallados.
- Cálculo automático de gasto de alimentos, porcentaje de costo y neto.
- Tabla diaria y resumen mensual.
- Gráfico diario de ingreso, costo y neto.
- Gráfico mensual de clientes promedio y costo de alimentos.
- Descarga CSV, gráficos PNG e impresión/guardado en PDF.
- Vista documental simplificada como **Carpeta sanitaria y documental**.
- Retiro de la pestaña visible de consultoría/Metamorfosis.
- Panel inicial orientado exclusivamente al uso de la administradora.

## Arquitectura

- Node.js + Express.
- PostgreSQL.
- Frontend administrativo en `/public/admin.html`.
- API y servidor en `server.js`.
- Esquema en `schema.sql`.

## Variables de entorno

Copiar `.env.example` y completar solo en el servicio de hosting o entorno local seguro. No guardar contraseñas, claves SMTP, cadena de base de datos ni secretos de sesión en Git.

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

La aplicación ejecuta el esquema al iniciar. Antes de actualizar producción, respaldar la base de datos.

## Tablas nuevas

- `daily_financials`: un registro por fecha con clientes, ingreso, personal, gastos básicos y notas.
- `daily_cost_items`: insumos o costos directos asociados a cada jornada.

## API de costos

- `GET /api/admin/daily-financials?month=YYYY-MM`
- `GET /api/admin/daily-financials/summary?months=12`
- `POST /api/admin/daily-financials`
- `DELETE /api/admin/daily-financials/:id`

Todas requieren sesión administrativa.

## Orden de despliegue recomendado

1. Crear respaldo de la base de datos.
2. Desplegar el panel/backend.
3. Revisar `/healthz`.
4. Iniciar sesión y registrar una jornada de prueba.
5. Confirmar gráficos y descargas.
6. Publicar la web pública.
7. Completar la lista de pruebas incluida en el manual de traspaso.

## Legado técnico

Las rutas y tablas históricas de consultoría pueden conservarse temporalmente para no eliminar información anterior, pero no forman parte de la navegación ni del uso entregado a la administradora. Una eliminación física futura debe realizarse solo después de respaldar y confirmar que esos datos ya no son necesarios.


## Ajuste v45 · administración CM

- Navegación simplificada en **Inicio**, **Restaurant** y **Gestión interna**.
- **Costos diarios** forma parte del módulo Restaurant.
- Gestión interna reúne Personal, Proveedores, Carpeta documental y Cotizaciones.
- El módulo Gastos se retiró de la navegación.
- Se incorporó una carga inicial idempotente de 53 jornadas entre abril y julio de 2026. La carga no reemplaza registros existentes ni vuelve a imponer valores después de que la administradora los edite.
- Cada jornada histórica puede corregirse con **Editar**, y las jornadas nuevas se agregan mediante **Registrar jornada**.
