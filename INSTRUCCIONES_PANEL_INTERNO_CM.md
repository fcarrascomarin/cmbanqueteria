# Instrucciones del panel interno CM · v47

## Inicio

El Inicio funciona como centro de la jornada. No muestra dinero ni totales históricos. Prioriza cuatro acciones:

- registrar o revisar costos de hoy;
- publicar el menú;
- registrar una reserva o retiro;
- enviar un mensaje a la pantalla de cocina.

También resume el estado operativo del día, próximos movimientos y accesos directos a los documentos más usados.

## Restaurant

### Reservas / Cocina

Permite registrar reservas, retiros y entregas, actualizar su estado y crear mensajes visibles para cocina. La información se presenta sobre tarjetas claras y con colores distintos según prioridad y estado.

### Menú del día

Permite cargar o actualizar las opciones que se muestran en la web pública y en la pantalla interna.

### Costos diarios

Cada fecha corresponde a una sola jornada. Desde **Editar** se pueden corregir clientes, ingreso, personal, gastos básicos, insumos y observaciones sin crear duplicados.

Descargas disponibles:

- Excel del mes;
- CSV del mes;
- gráficos PNG;
- impresión o guardado en PDF.

## Gestión interna

### Personal

Cada ficha contiene cargo, contacto, jornada, contrato, estado, tareas y observaciones. Las funciones iniciales pueden editarse cuando Claudia redistribuya responsabilidades. La tabla completa se descarga en Excel.

### Proveedores

Incluye tarjetas, buscador, ficha editable, antecedentes de contacto e historial. La tabla se descarga en Excel.

### Carpeta documental

Se divide visualmente en:

- **Carpeta sanitaria**: manual y checklist.
- **Documentos operacionales**: limpieza, uniformes, charla inicial y controles de temperatura.
- **Documentos agregados por CM**: enlaces, certificados, vencimientos y respaldos posteriores.

### Cotizaciones

Mantiene el seguimiento comercial de solicitudes y eventos.

## Pantalla interna de cocina

Abrir el botón **Pantalla** en un computador, televisor o tablet visible para el equipo. Se actualiza automáticamente y muestra:

- pedidos pendientes y listos;
- menú del día;
- mensajes para cocina, atención o todo el equipo;
- minuta de preparación cuando exista.

## Despliegue

1. Respaldar la base PostgreSQL.
2. Desplegar la versión nueva.
3. Reiniciar el servicio para ejecutar alteraciones y cargas iniciales.
4. Comprobar los seis documentos PDF.
5. Verificar la descarga de Excel.
6. Registrar y editar una jornada de prueba.
7. Probar un mensaje en la pantalla de cocina.

Las credenciales y variables de entorno no deben incluirse en el repositorio.
