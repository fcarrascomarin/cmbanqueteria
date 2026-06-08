# CM Banquetería & Restaurant — Base web para VS Code

Base inicial para una web operativa de CM Banquetería & Restaurant.

## Qué incluye

- Página de inicio con estética cálida: burdeo, crema, dorado y fotos reales como base visual.
- Concepto de marca: restaurant que mezcla lo casero y lo gourmet.
- Menú del día con stock.
- Carrito de compra.
- Pedido con retiro en local o reparto a domicilio.
- Pago Webpay en modo mock/demo.
- Seguimiento del pedido por:
  - enlace único del pedido; y
  - teléfono + número de pedido.
- Panel interno para administración/cocina.
- Portal de repartidores.
- Estados y mensajes automáticos del pedido.
- Flujo de cancelación y devolución en modo mock.

## Cómo usar en VS Code

1. Abre esta carpeta en VS Code.
2. Ejecuta:

```bash
npm install
npm run dev
```

3. Abre:

```text
http://localhost:3000
```

## Páginas principales

- `/` Inicio y pedido.
- `/seguimiento.html` Sigue tu pedido.
- `/panel.html` Panel interno: administración, cocina y repartidores.

## Importante sobre Webpay

Esta base trae Webpay en modo mock para poder desarrollar sin credenciales reales.
La integración real debe hacerse en backend, nunca solo en frontend, usando las credenciales del comercio y el SDK/documentación oficial de Transbank.

## Imágenes

Reemplaza estos archivos por imágenes reales:

- `public/assets/local-fondo.jpg`
- `public/assets/plato-1.jpg`
- `public/assets/plato-2.jpg`
- `public/assets/plato-3.jpg`

Si no existen, el diseño usa gradientes y tarjetas como respaldo.
