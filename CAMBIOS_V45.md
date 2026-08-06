# CM Panel Interno v45

## Navegación

- Inicio: acceso directo al panel diario.
- Restaurant: Reservas / Cocina, Menú del día y Costos diarios.
- Gestión interna: Personal, Proveedores, Carpeta documental y Cotizaciones.
- Gastos se retiró de la navegación y del panel de inicio.

## Panel de inicio

- Accesos directos: Costos, Nueva cotización y Menú del día.
- Indicadores visibles: ingresos del último mes registrado, neto del último mes registrado y cotizaciones pendientes.
- Se retiraron stock crítico, observaciones abiertas y documentos por vencer.

## Datos históricos de costos

- 53 jornadas precargadas entre el 24 de abril y el 23 de julio de 2026.
- Cada jornada incorpora fecha, clientes aproximados, ingreso, personal, gastos básicos y costo consolidado de alimentos.
- La carga es idempotente: solo inserta fechas inexistentes y no reemplaza correcciones posteriores.
- Los datos históricos pueden editarse desde el botón Editar de cada fila.
- Las jornadas nuevas se incorporan con Registrar jornada.

## Comprobación de la carga inicial

| Mes | Jornadas | Clientes promedio | Costo promedio diario | Neto promedio |
|---|---:|---:|---:|---:|
| Abril 2026 | 5 | 47,6 | 43,0% | $85.470 |
| Mayo 2026 | 19 | 56,4 | 40,5% | $101.594 |
| Junio 2026 | 15 | 42,0 | 41,6% | $18.739 |
| Julio 2026 | 14 | 29,9 | 41,2% | $2.886 |
