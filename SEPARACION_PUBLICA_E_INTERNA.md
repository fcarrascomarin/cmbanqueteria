# Separación pública estática + backend interno Render

## Objetivo
Evitar que los clientes vean la pantalla de espera de Render al entrar a `cmbanqueteria.cl`.

## Arquitectura

- `cmbanqueteria.cl`: web pública estática en GitHub Pages, usando la carpeta `public-static`.
- `https://cmbanqueteria.onrender.com`: backend, panel interno, API, menú, cotizaciones y pantalla interna en Render.

## Configuración ya aplicada

En `public-static/config.js` quedó configurado:

```js
window.CM_API_BASE = 'https://cmbanqueteria.onrender.com';
window.CM_ADMIN_URL = 'https://cmbanqueteria.onrender.com/admin.html';
```

## Qué subir a GitHub Pages

Subir el contenido de `public-static` a la raíz del repositorio público.

Correcto:

```txt
index.html
styles.css
public.js
menu-graphic.js
config.js
assets/
CNAME
```

Incorrecto:

```txt
public-static/index.html
public-static/styles.css
```

## CNAME

El archivo `public-static/CNAME` ya contiene:

```txt
cmbanqueteria.cl
```

## Panel interno

Mientras no exista subdominio propio, el acceso interno queda en:

```txt
https://cmbanqueteria.onrender.com/admin.html
```

Cuando más adelante se configure `admin.cmbanqueteria.cl`, solo hay que cambiar `public-static/config.js` a:

```js
window.CM_API_BASE = 'https://admin.cmbanqueteria.cl';
window.CM_ADMIN_URL = 'https://admin.cmbanqueteria.cl/admin.html';
```
