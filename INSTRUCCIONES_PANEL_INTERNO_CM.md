# Instrucciones del panel interno CM · v40

## Objetivo

El panel queda preparado para uso cotidiano de la administradora de CM Banquetería & Restaurant. La navegación visible ya no incluye la antigua pestaña de consultoría. El respaldo de resoluciones, certificados, registros y otros antecedentes se concentra en **Gestión interna > Carpeta documental**.

## Costos diarios

Abrir **Compras y stock > Costos diarios**.

1. Seleccionar **Registrar día**.
2. Completar fecha, clientes aproximados, ingreso total, costo de personal y gastos básicos.
3. Agregar los insumos de la jornada. La cantidad multiplicada por el valor unitario calcula el total; también puede escribirse un total directo.
4. Revisar el costo de alimentos y el neto estimado.
5. Guardar. La tabla y los gráficos del mes se actualizan automáticamente.
6. Usar **Editar** para corregir una jornada existente. Existe un único registro por fecha.

La pantalla permite:

- revisar ingresos, costo de alimentos, personal, gastos básicos y neto;
- comparar clientes promedio y porcentaje de costo por mes;
- descargar los datos en CSV;
- descargar ambos gráficos en PNG;
- imprimir o guardar la vista como PDF.

## Carpeta documental

Abrir **Gestión interna > Carpeta documental** y registrar el nombre, tipo, carpeta, fechas, enlace al archivo y notas. Las carpetas disponibles son: Sanitario, Municipal, Tributario, Laboral, Operación, Proveedores, Web y tecnología y Empresa/general.

El panel conserva el enlace y la información de control. El archivo original debe mantenerse en la carpeta oficial de CM.

## Despliegue

Antes de publicar esta versión:

1. Respaldar la base de datos.
2. Desplegar primero el backend/panel interno, para que el esquema cree las tablas `daily_financials` y `daily_cost_items`.
3. Confirmar inicio de sesión y registrar una jornada de prueba.
4. Probar edición, eliminación, CSV, PNG e impresión/PDF.
5. Publicar luego la web pública y revisar navegación fija, sección Restaurant y sección Cómo llegar en escritorio y móvil.

Las credenciales y variables de entorno no deben agregarse al repositorio. Usar `.env.example` únicamente como referencia de nombres.
