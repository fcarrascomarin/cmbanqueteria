# CM Panel Interno v47

## Enfoque

Esta versión reorganiza el panel para el uso diario de la administradora de CM. La prioridad visual es:

1. registrar o revisar costos del día;
2. publicar el menú;
3. registrar reservas o retiros;
4. comunicar instrucciones a la pantalla de cocina;
5. acceder a documentos sanitarios y operacionales.

## Cambios principales

- Contraste reforzado: paneles opacos, textos oscuros y estados diferenciados por color.
- Pantalla de cocina rediseñada para lectura a distancia.
- Cifras de costos adaptables al ancho de las tarjetas, sin desbordes.
- Inicio sin montos ni contadores históricos irrelevantes; muestra acciones y situación del día.
- Proveedores y personal con tarjetas, búsqueda/edición y descarga Excel.
- Costos diarios con descarga Excel mensual, CSV, gráficos e impresión/PDF.
- Carpeta documental con Manual Sanitario, Checklist Sanitario y documentos operacionales entregados por CM.
- Personal con funciones editables y distribución inicial de tareas basada en los programas internos de limpieza.

## Nota de implementación

Los documentos se sirven desde `public/docs/cm`. Los archivos Excel se generan dinámicamente desde la base de datos, por lo que reflejan las correcciones realizadas por la administradora.
