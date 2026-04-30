# HISTORY.md — Historial de Sesiones y Decisiones

Este archivo conserva el registro histórico de sesiones, refactorizaciones y decisiones pasadas. No representa necesariamente el estado actual del sistema; para el estado vigente consultar CONTEXT.md.

---

## Sesión del 22 de Abril 2026 - Parte 2

- **Refactorización del PDV** a diseño de pantalla completa anidado (3 columnas) bajo el header principal.
- **Implementación de scroll independiente** (`overflow-y-auto`) para las columnas de Categorías, Productos y Ticket.
- **Implementación de Scroll Continuo (Spy Scroll)** en la lista de productos y limpieza visual del sidebar (sin emojis ni contadores).
- **Corrección del scroll en el módulo de Menú (Panel Admin)** para que ocupe todo el alto disponible y la barra quede al ras de la pantalla.
- **Fix en el input del teléfono del cliente**: Regex `\D` implementado para limpiar espacios y caracteres especiales al pegar números desde WhatsApp, respetando el `maxLength`.

---

## Sesión del 24 de Abril 2026 - Reportes y Analíticas

- **Dashboard de Reportes V2**: Implementado con éxito en `Reports.jsx` (ReportesPage.jsx).
    - Incluye cálculo de 3 KPIs principales: Cantidad de Pedidos, Ventas Totales y Ticket Promedio.
    - Lógica de comparación porcentual (%) automática contra el período anterior equivalente.
    - Integración de `recharts` con protecciones contra estados de carga y datos nulos (previniendo crashes de `viewBox`).
    - Selector de rangos de fecha funcional (Hoy, Ayer, 7d, 30d, Mes, Año).
- **Deuda Técnica Crítica (Layout)**: Persiste un problema de solapamiento visual en el módulo de Reportes. El contenido no respeta el espacio del Sidebar (posicionamiento `fixed`). Se intentaron soluciones de compensación con `padding-left` y `margin-left` sin éxito definitivo.
    - *Nota para futuras sesiones*: Es necesario revisar la estructura del contenedor Padre/Layout global para asegurar que el área de contenido principal sea empujada correctamente por el sidebar o migrar a una estructura de flexbox 100% robusta que evite el uso de `fixed` absoluto si no se maneja la compensación en el wrapper. No se recomienda seguir intentando parches de CSS local en el componente de Reportes hasta que el Layout base sea estable.

---

## Sesión del 25 de Abril 2026 - Refactorización UI/UX y Fixes Críticos

- **Dashboard de Reportes**: Se reescribió la lógica de fechas para la gráfica (truncando a hora local) para evitar solapamientos de días y proyecciones futuras. Se cambió a comparativa estricta (Período Actual vs Anterior).
- **Validación de Mitades (PDV)**: Se corrigió la función validadora en `ProductModal.jsx` para que sume las cantidades (`qty`) de las opciones seleccionadas, respetando los límites min/max.
- **Persistencia de Pagos**: Se blindó la lógica de cierre de pedidos para evitar que el estado `paymentMethod` se sobrescribiera o borrara al pasar el pedido a 'Finalizado'.
- **Escalado Tipográfico**: Se aplicó un "bump" general de tipografía (clases Tailwind inline en JSX) en el historial y PDV para mejorar la accesibilidad visual en operación rápida.
- **Drawer de Detalle**: Se refactorizó `DetailPanel.jsx` de un bloque estático en la cuadrícula a un Cajón Flotante (`fixed`, `z-50`) con Backdrop oscuro para evitar saltos en la interfaz.
- **Impresión POS-80**: Se aplicaron modificadores de impresión (`print:static`, etc.) al Drawer para liberar el ticket y permitir que ocupe el ancho total del papel térmico sin recortarse a la izquierda.

---

## Sesión del 26 de Abril 2026 - Auditoría y Seguridad Arquitectónica

- **Desacoplamiento del Historial (Fix Nivel 1)**: Se refactorizó HistorialPage.jsx para que haga fetch directo a Supabase con estado local, dejando de consumir/sobrescribir el OrdersContext global, protegiendo así la cola de pedidos en vivo del PDV en navegaciones SPA.
- **Atomicidad de Correlativos (Fix Nivel 1)**: Se eliminó la generación insegura de números de pedido en el frontend (getNextNum). Se implementó una secuencia en PostgreSQL (order_num_seq) que asume la responsabilidad de generar el correlativo num automáticamente y sin colisiones. El frontend ahora confía en el retorno de la inserción.

---

## Sesión del 26 de Abril 2026 - Parte 2 (Seguridad y Arranque)

- **Optimización de Arranque (Arranque Silencioso)**: Se reestructuró el árbol de componentes en `main.jsx`/`App.jsx` moviendo los proveedores de datos (`MenuProvider`, `OrdersProvider`, `ClientProvider`, `SettingsProvider`) **detrás** del guard de autenticación (`AuthProvider`). Esto elimina el derroche de red y los errores de Supabase al evitar fetches fantasma antes del login exitoso.
- **Seguridad de Credenciales Críticas (Fix Nivel 1)**: Se eliminó la API Key de Google Maps hardcodeada en texto plano dentro de `index.html`. Se migró a un modelo de variables de entorno seguras (`VITE_GOOGLE_MAPS_API_KEY` en `.env` local) con inyección dinámica para proteger la cuota de facturación en Google Cloud.
- **Despliegue en Cloudflare Pages**: Se configuraron exitosamente las variables de entorno de producción directamente en el panel de Cloudflare, garantizando la inyección segura de secretos durante el proceso de build (Redeploy).
- **Fix de Build CSS**: Se corrigió el orden estricto de precedencia de `@import` en `index.css` para que Vite y PostCSS compilen correctamente, manteniendo a Tailwind CSS de forma explícita en la línea 1 como estándar arquitectónico.

---

## Sesión del 27 de Abril 2026 - Parte 3 (Arquitectura de Enrutamiento)

- **Migración a React Router**: Se derogó la regla de navegación por estado (`activePage`) y se implementó `react-router-dom` v6 de forma oficial.
- **Code Splitting y Optimización**: Se aplicó `React.lazy` y `<Suspense>` para diferir la carga de módulos pesados. Esto optimiza radicalmente la carga inicial aislando el peso de `recharts` (Reportes) y SDKs externos (Configuración/Mapas) del bundle de la vista principal del PDV.
- **Nuevos Módulos (WIP)**: Se creó un placeholder temporal para el módulo de Cocina (`/cocina`) inyectado en el sistema de enrutamiento con el mismo patrón arquitectónico de Lazy Loading.

---

## Sesión del 28 de Abril 2026 - Optimización Core, UX y Pagos Mixtos

- **Dieta del OrdersContext:** Se optimizó el flujo de WebSockets y el fetch inicial para que el PDV solo retenga en memoria RAM los pedidos activos (`pend`, `preparacion`, `listo`), purgando automáticamente los finalizados/cancelados.
- **Pestaña TODOS en PDV:** Se agregó una vista panorámica en `PedidosPDV.jsx` para ver simultáneamente los pedidos de todos los canales.
- **Sincronización Matemática:** Se corrigió el cálculo total en `OrderRow.jsx` para que coincida con `DetailPanel`, sumando cargos extras (delivery, empaque) y restando descuentos.
- **Buscador y Refresh en Vivo:** Se activaron los botones del header en el PDV. La lupa hace un filtrado local instantáneo (por N° pedido, nombre o teléfono) y el botón ↻ fuerza un re-fetch a Supabase.
- **Pagos Mixtos (Split Payments):** Se cambió la nomenclatura "Débito" por "Tarjeta". Se añadió soporte para pagar un pedido combinando métodos. Se agregó la columna `payments` (JSONB) en Supabase. Se filtró el payload de guardado para evitar rechazos por la columna fantasma `tip`.
- **Filtros de Historial:** Se reescribió la matemática de `HistorialPage.jsx` para que, al filtrar por método de pago, "abra" los pedidos mixtos y sume en el header únicamente la fracción pagada con ese método específico.
- **UX de Impresión y UI:** Se agrandó el botón de impresión en el detalle, se agregó un atajo de impresión directo en el `OrderRow`, y se reemplazó el botón "Cobrar" por un texto verde de "✓ Pagado" para evitar saltos en la interfaz.
