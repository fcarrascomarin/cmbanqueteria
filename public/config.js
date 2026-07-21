// CM Banquetería · configuración pública.
// En Render/backend dejar vacío para usar el mismo origen.
// En hosting estático, reemplazar por la URL del backend Render, por ejemplo:
// window.CM_API_BASE = 'https://cm-banqueteria-backend.onrender.com';
window.CM_API_BASE = window.CM_API_BASE || '';
window.CM_ADMIN_URL = window.CM_ADMIN_URL || (window.CM_API_BASE ? window.CM_API_BASE.replace(/\/$/, '') + '/admin.html' : '/admin.html');
