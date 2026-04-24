# CONTEXT.md — La Pizzería de Buin · Panel Admin

Lee este archivo completo antes de escribir cualquier código. Contiene el stack, las decisiones técnicas, la estructura de archivos, los módulos construidos y lo que viene después.

---

## Stack y configuración base

- **React 19 + Vite 8** — sin router (navegación por estado `activePage` en App.jsx)
- **Tailwind CSS** — Estándar principal para todo el diseño de la interfaz.
- **@dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities** — drag & drop en Menú y PDV
- **DM Sans** — fuente vía `@import` en `index.css`
- **Sin backend** — todo es estado local en React, sin localStorage (excepto el logo del sidebar)

**Regla de Estilos:** El proyecto utiliza Tailwind CSS como estándar principal para todo el diseño de la interfaz. Todas las nuevas vistas, refactorizaciones y componentes DEBEN utilizar exclusivamente clases de utilidad de Tailwind (ej. flex, p-4, text-gray-800). NO se deben crear nuevos archivos .css separados a menos que sea para configuraciones globales del framework o animaciones extremadamente complejas que Tailwind no pueda manejar.

---

## Variables CSS globales (`src/index.css`)

```css
--brand:      #C0392B;
--surface:    #ffffff;
--surface2:   #f9fafb;
--surface3:   #f3f4f6;
--border:     rgba(0, 0, 0, 0.08);
--text:       #111827;
--muted:      #6b7280;
--sidebar-bg: #1a1a2e;
--blue:       #2563eb;
--success:    #16a34a;
--warning:    #f59e0b;
--danger:     #dc2626;
--radius:     8px;
--radius-lg:  14px;
--shadow-lg:  0 8px 32px rgba(0,0,0,0.14);
```

Clases utilitarias compartidas en `index.css`: `.btn`, `.btn-primary`, `.btn-blue`, `.btn-secondary`, `.btn-ghost`, `.btn-sm`, `.btn-icon`, `.form-group`, `.form-label`, `.form-input`, `.form-textarea`, `.form-row`, `.form-actions`, `.toggle`, `.stock-badge--in/--low/--out`, `.drag-handle`

---

## Estructura de archivos

```
src/
├── main.jsx
├── App.jsx                          ← navegación por estado, sin router
├── App.css
├── index.css                        ← variables globales + utilidades
│
├── data/
│   ├── menuData.js                  ← seed data + generateId()
│   └── clientsData.js               ← SEED_CLIENTS (array de clientes con addresses[])
│
├── context/
│   ├── MenuContext.jsx              ← estado global del menú y logo
│   ├── OrdersContext.jsx            ← estado global de órdenes
│   └── ClientContext.jsx           ← estado global de clientes (única fuente de verdad)
│
├── components/
│   ├── Layout/
│   │   ├── Sidebar.jsx              ← logo upload, nav por secciones
│   │   └── Sidebar.css
│   │
│   ├── shared/
│   │   ├── Modal.jsx                ← modal genérico (sm/md/lg/xl)
│   │   └── Modal.css
│   │
│   ├── Menu/
│   │   ├── MenuPage.jsx
│   │   ├── MenuPage.css
│   │   ├── CategorySection.jsx      ← drag & drop de productos; colapsado por defecto
│   │   ├── CategorySection.css
│   │   ├── ProductRow.jsx           ← thumbnail usa images[0] ?? image
│   │   ├── ProductRow.css
│   │   ├── ProductModal.jsx         ← crear/editar producto (4 tabs)
│   │   ├── ProductModal.css
│   │   ├── ModifiersPanel.jsx       ← grupos + GroupModal con tabs Opciones/Productos
│   │   └── ModifiersPanel.css
│   │
│   └── pdv/
│       ├── ChannelBar.jsx           ← tabs Mostrador / A domicilio / Mesas
│       ├── ChannelBar.css
│       ├── FilterBar.jsx            ← pills + botón ⚙ Filtros
│       ├── FilterBar.css
│       ├── FilterDrawer.jsx         ← drawer 320px filtros avanzados (exporta INIT_ADV_FILTERS)
│       ├── FilterDrawer.css
│       ├── OrderList.jsx            ← grid CSS (no table)
│       ├── OrderList.css
│       ├── OrderRow.jsx             ← fila con timer vivo (useTick 15s)
│       ├── OrderRow.css
│       ├── DetailPanel.jsx          ← panel lateral derecho, timer vivo
│       ├── DetailPanel.css
│       ├── OrderPrintTemplate.jsx   ← recibo para impresora térmica 80mm
│       ├── OrderPrintTemplate.css   ← display:none en pantalla; @media print aísla el ticket
│       └── modals/
│           ├── OrderTypeModal.jsx   ← elegir tipo de pedido (5 opciones)
│           ├── OrderTypeModal.css
│           ├── OrderBuilderModal.jsx ← constructor 3 columnas (960×620px) con autocomplete de cliente
│           ├── OrderBuilderModal.css
│           ├── ProductModal.jsx     ← variantes + modificadores + qty (PDV)
│           ├── ProductModal.css
│           ├── PaymentModal.jsx     ← cobro con vuelto
│           └── PaymentModal.css
│
└── pages/
    ├── pdv/
    │   ├── PedidosPDV.jsx           ← página principal PDV, toda la lógica
    │   └── PedidosPDV.css
    ├── ventas/
    │   ├── HistorialPage.jsx        ← grilla alta densidad + drawer lateral de detalle
    │   ├── HistorialPage.css
    │   ├── HistoryDetailDrawer.jsx  ← panel lateral de detalles + gestión de pagos
    │   └── HistoryDetailDrawer.css
    └── clientes/
        ├── ClientsPage.jsx          ← grilla CSS + sorting + filtros
        ├── ClientsPage.css
        ├── ClientSearchModal.jsx    ← búsqueda dual nombre/teléfono
        ├── ClientSearchModal.css
        ├── ClientFilterModal.jsx    ← filtros avanzados (drawer lateral)
        ├── ClientFilterModal.css
        ├── ClientDrawer.jsx         ← CRUD inline de clientes con addresses[]
        └── ClientDrawer.css
```

---

## Módulo 1 — Menú / Carta (`src/components/Menu/`)

**Estado:** Conectado a Supabase (Migrado exitosamente).

Gestionado por `MenuContext.jsx`. El contexto mantiene integrados los productos anidados dentro de las categorías para la UI, pero por detrás realiza un mapeo `camelCase` <> `snake_case` e interactúa con 3 tablas independientes en Supabase (`categories`, `modifier_groups`, `products`).

La carga inicial (`fetchMenuData`) utiliza un `Promise.all` disparando un *three-way split* asíncrono para descargar todo el menú optimizando el tiempo de renderizado de la aplicación.

El contexto expone:
```js
{ categories, modifierGroups, logo,
  setLogo, fetchMenuData,
  addCategory, updateCategory, deleteCategory, reorderCategories,
  addProduct, updateProduct, deleteProduct, reorderProducts,
  addModGroup, updateModGroup, deleteModGroup, reorderModGroups,
  bulkUpdateModGroupAssignments,
  updateStock }
```

**`bulkUpdateModGroupAssignments(groupId, assignedProductIds[])`** — actualiza `modifierGroupIds` en todos los productos de todas las categorías de forma atómica: agrega el grupo a los que deben tenerlo, lo quita de los que no.

**Datos seed** (`src/data/menuData.js`):
- `generateId()` — contador desde 90000
- 5 categorías: Entradas, Pizzas Clásicas, Pizzas Especiales, Bebidas, Promos
- Helpers: `mkSimple(id, name, desc, price)` y `mkVariant(id, name, desc, [prices], [modGroupIds])`
- Productos usan `images: []` (no `image`)
- `initialModifierGroups`: "Ingredientes extra" (checkbox, opcional) y "Tipo de borde" (radio, opcional)

**Shape de producto:**
```js
{
  id, name, description, active,
  images: string[],               // array de base64, máx 3 fotos; images[0] es la principal
  // NOTA: campo legacy "image" puede existir en datos viejos — siempre leer con: images?.[0] ?? image
  priceType: 'simple' | 'variants',
  price, promoPrice, cost,
  variants: [{ id, name, price, promoPrice }],
  modifierGroupIds: [],
  stock: { enabled, quantity, alertAt }
}
```

**Shape de modifier group:**
```js
{
  id, name,
  required: bool,
  multiple: bool,   // false = radio, true = checkbox
  min, max,
  options: [{
    id, name,
    active: bool,                 // false = ocultar al cliente en PDV ProductModal
    price:          number | null,   // null cuando priceByVariant está activo
    promoPrice:     number | null,   // null cuando priceByVariant está activo
    priceByVariant: { [variantName]: number } | null,
    // Si priceByVariant es non-null, price y promoPrice son null.
    // Helper: getPriceForVariant(opt, variantName) → resuelve precio correcto para variante activa
  }]
}
```

### ProductModal (Menú) — 4 tabs

**Tab General:**
- Galería de hasta 3 fotos (base64). Las fotos se almacenan en estado separado `gallery: [{ id, src }]`.
- La primera foto tiene badge "Principal". Cada foto tiene botón ×.
- Drag & drop para reordenar (la primera siempre será la principal al guardar).
- Slot "Agregar" (📷) aparece solo si `gallery.length < 3`.
- Usa `SortableGallerySlot` con `rectSortingStrategy`.
- En `handleSubmit`: `images: gallery.map(g => g.src)`.
- `initGallery(product)` inicializa desde `product.images` o `product.image` (compat legado).

**Tab Modificadores:**
- Los grupos asignados se muestran como lista sortable drag & drop (`SortableModItem` con `verticalListSortingStrategy`).
- Reordenar cambia el orden en `form.modifierGroupIds` (determina el orden en que aparecen al armar un pedido).
- Los grupos no asignados se muestran debajo como lista "Agregar grupos" con ícono +.
- Clic en un grupo no asignado lo agrega al final; botón × en uno asignado lo quita.

### ModifiersPanel / GroupModal — 2 tabs

**Tab Opciones:** editor original (nombre, obligatorio/múltiple, min/máx, lista de opciones sortable).

**Tab Productos (asignación masiva):**
- Lista todos los productos del menú agrupados por categoría con checkboxes.
- Busqueda filtrable por nombre de producto.
- Botones "Sel. todo" / "Desel." actúan sobre los productos visibles (filtrados).
- Badge en la tab muestra cantidad de productos seleccionados.
- `selectedProductIds` se inicializa desde los productos que ya tienen este grupo en sus `modifierGroupIds`.
- Al guardar: llama `bulkUpdateModGroupAssignments(stableGroupId, selectedProductIds)`.
- `stableGroupId = group?.id ?? generateId()` — pre-generado para soportar asignación en grupos nuevos.
- `addModGroup(data)` acepta `id` en `data` para usar el ID pre-generado.

### Precios de extras por variante (priceByVariant)

Cada opción de modificador puede tener modo **Fijo** o **Tamaño**:
- **Fijo**: `price` y `promoPrice` son números normales.
- **Tamaño**: `priceByVariant: { [variantName]: number }`, `price` y `promoPrice` son `null`.

En `GroupModal` (`SortableOption`):
- Toggle `Fijo | Tamaño` aparece solo si el grupo está asignado a al menos un producto con variantes.
- `variantNames` se calcula con `useMemo` escaneando `categories` por productos que usan este grupo.
- Al activar "Tamaño": se abre una sub-fila con inputs de precio por variante (plegable).
- **Toggle de colapso**: texto "Por tamaño ↓/▶" (botón). Por defecto: expandido al activar.
- Cuando una opción está inactiva (`active === false`): toda la zona de nombre + precios queda con `opacity: 0.4` — el ícono de ojo y el botón × siempre visibles (estructura: `mod-opt-dimmable` + `mod-opt-always`).

En `ProductModal` (PDV):
- `getPriceForVariant(opt, variantName)` resuelve el precio de una opción para la variante activa.
- `useEffect` sobre `selectedVariant` actualiza precios de todos los mods ya seleccionados cuando cambia la variante.
- Opciones con `active === false` se filtran y no se muestran al cliente.
- Si un grupo queda sin opciones visibles, el título del grupo tampoco se muestra.
- Badge "📐 varía" en opciones con `priceByVariant` cuando no hay variante seleccionada aún.
- Hint "💡 Elige el tamaño para ver el precio de los extras" cuando aplica.

### Categorías colapsadas por defecto

`CategorySection.jsx` inicializa `expanded` en `false`. Al cargar la página, todas las categorías muestran solo el header. Click en ▼/▲ expande/colapsa individualmente.

**Features del módulo Menú:**
- Drag & drop para reordenar categorías y productos con @dnd-kit
- Drag & drop para reordenar grupos de modificadores (ModifiersPanel)
- Drag & drop para reordenar opciones dentro de un grupo (GroupModal)
- Drag & drop para reordenar grupos asignados a un producto (ProductModal tab Modificadores)
- Drag & drop para reordenar fotos de la galería (ProductModal tab General)
- Toggle activo/inactivo por producto, categoría y opción de modificador
- Precios promocionales con badge "% descuento"
- Control de stock con badges (in/low/out)
- Logo del negocio en sidebar (localStorage)

---

## Módulo 2 — PDV (`src/pages/pdv/` + `src/components/pdv/`)

**Estado** — completado.

### Mapeos clave

```js
// Canal → tipos de pedido (para filtrar OrderList)
const CHANNEL_TYPES = {
  mostrador: ['local', 'llevar', 'flash'],
  domicilio: ['delivery'],
  mesas:     ['mesa'],
}

// Tipo → canal (para navegar después de crear pedido)
const TYPE_TO_CHANNEL = {
  flash: 'mostrador', local: 'mostrador', llevar: 'mostrador',
  delivery: 'domicilio', mesa: 'mesas',
}
```

### Estados del pedido — flujo progresivo

```js
const ORDER_STATES = {
  pend:        { label: 'Pendiente',      color: '#92400e', bg: '#fef3c7' },
  preparacion: { label: 'En preparación', color: '#1d4ed8', bg: '#dbeafe' },
  listo:       { label: 'Listo',          color: '#065f46', bg: '#d1fae5' },
  finalizado:  { label: 'Finalizado',     color: '#374151', bg: '#f3f4f6' },
  cancelado:   { label: 'Cancelado',      color: '#991b1b', bg: '#fee2e2' },
}
// Flujo: pend → preparacion → listo → finalizado
// action 'advance' avanza un paso; 'cancel' → cancelado (con closedAt)
// Cobrar desde PaymentModal también setea status: 'finalizado'
```

Botón principal por estado:
```
pend        → ▶ Aceptar   (verde)
preparacion → 🍕 Listo    (azul)
listo       → ✓ Finalizar (gris oscuro) + ⚡ Cobrar y finalizar (solo DetailPanel)
finalizado  → sin botón principal
cancelado   → sin botones de acción
```

Filtro "En curso" en FilterBar cubre `preparacion` + `listo`.

### Shape de ítem de pedido

```js
// Ítem creado desde OrderBuilderModal (vía ProductModal PDV):
{
  id:        string,               // crypto.randomUUID() — ID único del ítem en el pedido
  productId: number,               // ID del producto en el menú (para lookup al editar)
  _key:      string,               // clave React: `${productId}-${variant??'simple'}-${Date.now()}`
  name:      string,
  variant:   string | null,        // nombre de variante seleccionada, o null
  qty:       number,
  price:     number,               // precio unitario ya resuelto (base + extras)
  modifiers: [{ name, price }],    // extras seleccionados con precio snapshot
  mods:      string[],             // nombres de extras (compat display en DetailPanel)
  total:     number,               // price * qty
  note:      string | null,        // nota individual del ítem
}

// Ítem legacy/seed (en SEED_ORDERS): puede tener id = productId y solo mods: string[]
// handleOpenEditItem maneja ambos formatos
```

### Shape de orden

```js
{
  id:            string,           // crypto.randomUUID()
  num:           number,           // correlativo desde 1001
  type:          'flash' | 'local' | 'llevar' | 'delivery' | 'mesa',
  status:        'pend' | 'preparacion' | 'listo' | 'finalizado' | 'cancelado',
  paid:          bool,
  items:         Item[],           // ver shape de ítem arriba
  total:         number,           // subtotal ± cargos/descuentos (sincronizado en tiempo real)
  client:        { name, phone, addr } | null,
  note:          string | null,
  comments:      string | null,
  paymentMethod: string | null,    // 'Efectivo' | 'Débito' | 'Transferencia'
  payMethod:     string | null,
  discount:      number,
  charges: {
    delivery:  number,
    tipMode:   '%' | '$',
    tipVal:    number,
    servicio:  number,
    empaque:   number,
  },
  discountMode:  '%' | '$',
  discountVal:   number,
  createdAt:     Date,
  closedAt:      Date | null,
  scheduledAt:   Date | null,
  origin:        'PDV',
}
```

### OrdersContext.jsx — Única fuente de verdad de pedidos (Supabase Realtime)

**Estado:** Conectado a base de datos y WebSockets (Migrado exitosamente).

Provee a la app:
```js
{ orders, addOrder, updateOrder, deleteOrder, getNextNum }
```

El estado `orders` interactúa en tiempo real con Supabase. Las mutaciones de pedidos (crear, actualizar estado a "preparación", soft-delete, etc.) insertan en el backend localmente usando un modelo Optimista (para percepción instantánea), mientras que los WebSockets de Supabase disparan eventos `INSERT`, `UPDATE` o `DELETE` que sincronizan en milisegundos las ventanas de otros usuarios conectados (por ejemplo, notificando instantáneamente la nueva comanda a la pantalla de la Cocina).

### Estado en PedidosPDV.jsx

```js
const [selectedOrderId, setSelectedOrderId] = useState(null)
const [activeChannel,   setActiveChannel]   = useState('mostrador')
const [activeFilter,    setActiveFilter]    = useState('all')
const [advFilters,      setAdvFilters]      = useState(INIT_ADV_FILTERS)
const [modal,           setModal]           = useState(null)
// modal: null | 'type' | 'builder' | 'pay'
const [pendingOrder,    setPendingOrder]    = useState(null)
const [builderItems,    setBuilderItems]    = useState([])
const [payingOrder,     setPayingOrder]     = useState(null)
```

### Advanced filters (FilterDrawer)

```js
// Exportado desde FilterDrawer.jsx
export const INIT_ADV_FILTERS = {
  origins:   [],   // 'PDV' | 'WEB'
  types:     [],   // 'flash' | 'local' | 'llevar' | 'delivery' | 'mesa'
  statuses:  [],   // 'pend' | 'preparacion' | 'listo' | 'finalizado' | 'cancelado'
  paid:      [],   // 'paid' | 'unpaid'
  scheduled: [],   // 'immediate' | 'scheduled'
}
export function countAdvFilters(f)  // suma de longitudes de todos los arrays
```

- `⚙ Filtros` botón en FilterBar (izquierda de las pills) abre el drawer.
- Badge en el botón muestra `countAdvFilters(advFilters)` cuando > 0.
- AND entre grupos, OR dentro de cada grupo. Combinado con filtro de pill.
- Cierra con ✕, click en backdrop, o Escape.
- "Limpiar filtros" resetea todo. "Filtrar ahora" aplica y cierra.
- CSS prefix: `fdr-`. Archivos: `FilterDrawer.jsx` + `FilterDrawer.css`.

### Callbacks que PedidosPDV pasa a DetailPanel

```js
onAction(orderId, action)          // 'advance' | 'cancel' | 'pay'
onDelete(orderId)                  // elimina del array, cierra panel
onUpdate(orderId, changes)         // merge parcial
onAddProducts(orderId)             // abre OrderBuilderModal sobre pedido existente
onTypeChange(orderId, changes)     // actualiza type/scheduledAt/client.addr + cambia activeChannel
```

### Flujo de creación de pedido

```
+ Nuevo pedido
  → OrderTypeModal (elegir tipo)
  → handleSelectType() → crea pendingOrder con crypto.randomUUID()
  → OrderBuilderModal (3 cols: categorías | productos | resumen+comentarios)
    → click producto → ProductModal (variantes + mods + qty)
    → "Agregar" → vuelve a OrderBuilderModal con item en cart
  → "Crear pedido →" → handleBuilderConfirm()
  → pedido aparece en OrderList, canal cambia automáticamente
```

Si `pendingOrder.id` ya existe en `orders`, `handleBuilderConfirm` hace **append** de items.

### Flujo de cobro (DESACOPLADO de la finalización)

```
Botón "Cobrar"  (disponible en cualquier estado activo)
  → handleOrderAction(id, 'pay') → setPayingOrder + setModal('pay')
  → PaymentModal (método + vuelto si efectivo)
  → handlePaymentConfirm() → { paid: true, paymentMethod, payMethod }
  → El estado del pedido NO cambia (sigue en pend/preparacion/listo)

Botón "Finalizar"  (solo cuando status === 'listo')
  → handleOrderAction(id, 'advance') → { status: 'finalizado', closedAt: new Date() }
```

> **Regla crítica:** cobrar ≠ finalizar. Un pedido puede estar cobrado y seguir en cocina.
> Un pedido también puede finalizarse sin estar cobrado (para agilidad operativa).

### Registro express de clientes desde PDV

Cuando se confirma un nuevo pedido en `handleBuilderConfirm`, si `finalOrder.client?.phone` existe:

```js
registerClientFromOrder(finalOrder.client, 'PDV')  // desde ClientContext
```

Esto crea o actualiza el cliente en la base de datos global sin intervención manual.

### Autocompletado inteligente de clientes en OrderBuilderModal

- Consume `clients` desde `ClientContext`.
- Al escribir en Teléfono o Nombre, filtra con `normalizePhone()` que elimina espacios y prefijo `56`.
- Menú flotante (`position: absolute`) muestra: fila "Nuevo cliente" + separador "(X) Resultados" + lista de coincidencias.
- Al seleccionar un cliente existente, autocompleta Nombre y Teléfono y carga su `addresses[]`.
- En pedidos delivery: si el cliente tiene `addresses[]`, el campo de dirección se convierte en un dropdown de sus direcciones guardadas.
- En pedidos no-delivery: el campo de dirección queda oculto.
- CSS prefix: `obm-ac-wrap`, `obm-suggestions`, `obm-sug-*`, `obm-addr-dropdown-btn`.

### Editar tipo de servicio y fecha desde DetailPanel

- Ícono ✏️ junto al tipo en el header (solo para `pend` y `preparacion`).
- Abre editor inline `dp-type-editor` entre el header y el body del panel.
- Permite cambiar tipo de servicio (select 5 opciones), dirección (si delivery), y si el pedido es inmediato o programado (radio + día/hora).
- Guardar llama `onTypeChange(orderId, { type, scheduledAt, client })` → actualiza el canal activo automáticamente.
- CSS classes: `dp-type-editor`, `dp-te-title`, `dp-te-row`, `dp-te-label`, `dp-te-select`, `dp-te-input`, `dp-te-radios`, `dp-te-day-time-row`, `dp-te-actions`.

### Editar cliente inline desde DetailPanel

- Ícono ✏️ junto al bloque de cliente (solo si el pedido no está finalizado/cancelado).
- Al hacer clic, la tarjeta estática se transforma en inputs de autocompletado inteligente in-place (sin modales).
- Consume `clients` de `ClientContext` para sugerencias en tiempo real (mismo `normalizePhone()`).
- Menú flotante de sugerencias: fila "Nuevo" + separador + coincidencias (nombre + teléfono + segmento).
- En delivery: dropdown de `addresses[]` del cliente seleccionado o input libre.
- Guardar llama `onUpdate(orderId, { client: { name, phone, addr } })` + `registerClientFromOrder()` para sincronizar con el contexto global.
- CSS prefix: `dp-ce-*`. Clases principales: `dp-client-edit-btn`, `dp-client-editor`, `dp-ce-phone-row`, `dp-ce-input`, `dp-ce-suggestions`, `dp-ce-sug-*`, `dp-ce-addr-btn`, `dp-ce-actions`.

### Editar ítems desde DetailPanel

- Botón ✏️ por ítem (visible on hover en `dp-item-actions`).
- `handleOpenEditItem(idx)`:
  1. Busca el producto: primero por `item.productId ?? item.id` (match exacto), luego por `item.name` como fallback.
  2. Reconstruye `selectedMods` según el formato del ítem: `item.modifiers` (`{name,price}[]`) para ítems nuevos, `item.mods` (`string[]`) para legacy/seed.
  3. Reconstruye `variantIdx` desde `item.variant` (nombre → índice).
  4. Abre `ProductModal` (PDV) con `editingItem = { qty, note, variantIdx, selectedMods }`.
  5. Si el producto no existe en el menú: `window.alert(...)` en lugar de fallar silenciosamente.
- `handleEditItemConfirm(newItemData)`: actualiza el ítem preservando `id`, `productId`, `_key`; escribe ambos `modifiers` y `mods` para mantener compatibilidad.
- Los mods se muestran en DetailPanel usando `item.mods` si existe, o `item.modifiers.map(m=>m.name)` como fallback.

### Modales PDV

| Modal | Max-width | Z-index | Notas |
|-------|-----------|---------|-------|
| OrderTypeModal | 410px | 1000 | 5 tipos en grid 2 cols, Flash span full |
| OrderBuilderModal | 960px, h:620px | 1000 | 3 cols: 175px \| flex:1 \| 300px. Prop `mode='create'\|'edit'`. Modo edit oculta datos cliente. Tarjeta producto: 120px imagen, `minmax(140px,1fr)`. Usa `images?.[0] ?? image` |
| ProductModal (PDV) | 470px | 1100 | Sobre OrderBuilderModal. `editingItem` prop preselecciona variante/mods/nota. Opciones con `active===false` no se muestran. Grupos sin opciones visibles se ocultan completamente. |
| PaymentModal | 410px | 1000 | Vuelto en tiempo real |

### ProductModal PDV — props

```js
<ProductModal
  product={product}            // objeto del menú
  modifierGroups={mods}        // array de grupos resueltos
  onAdd={fn}                   // recibe el ítem construido
  onClose={fn}
  editingItem={{               // opcional — preselecciona estado para edición
    qty, note,
    variantIdx: number | null,
    selectedMods: { [modIdx]: {name,price} | [{name,price}] }
  }}
/>
```

Botón de acción: `{isEditing ? 'Guardar cambios' : 'Agregar'} · {fmt(total)}`

### Clientes locales ← OBSOLETO

> ⚠️ El array `LOCAL_CLIENTS` hardcodeado fue eliminado de `OrderBuilderModal.jsx`.
> Ahora se consume el `ClientContext` global. Ver sección Módulo 5.

### Timer vivo

`useTick(ms = 15000)` — hook en `OrderRow.jsx` y `DetailPanel.jsx` que fuerza re-render cada 15s.

### DetailPanel — estructura de secciones

1. **Header** — color dinámico según estado, badge, tipo con ✏️, timer, programación
2. **Editor inline de tipo** (`dp-type-editor`) — entre header y body
3. **Cliente** — nombre, teléfono, dirección
4. **Productos** — lista de ítems con botones ✏️ y × por hover; botón "+ Agregar"
5. **Comentarios** — textarea editable
6. **Cargos adicionales** — delivery, propina, servicio, empaque (solo estados activos)
7. **Descuento** — modo %/$ (solo estados activos)
8. **Totales** — subtotal → descuento → subtotal neto → cargos → TOTAL
9. **Método de pago** — chips clicables / badge "✓ Cobrado"
10. **Footer** — botones según estado

### Grid de OrderList

```css
grid-template-columns: 185px 140px 110px 1fr 205px;
/* Num/Tipo/Hora | Estado | Total | Cliente | Acciones */
```

### Colores de estado

```
pend        → headerBg: #fffbeb  headerBorder: #fde68a
preparacion → headerBg: #eff6ff  headerBorder: #bfdbfe
listo       → headerBg: #f0fdf4  headerBorder: #bbf7d0
finalizado  → headerBg: #f9fafb  headerBorder: #e5e7eb
cancelado   → headerBg: #fef2f2  headerBorder: #fecaca
```

---

## Convenciones de código

- **Tailwind CSS** — Todas las nuevas vistas y componentes deben usar exclusivamente Tailwind. No se deben crear nuevos archivos `.css`.
- **Prefijos de clase**:
  - `otm-` OrderTypeModal · `obm-` OrderBuilderModal · `pm-` ProductModal PDV · `paym-` PaymentModal
  - `or-` OrderRow · `dp-` DetailPanel · `ol-` OrderList · `cb-` ChannelBar · `fb-` FilterBar · `fdr-` FilterDrawer
  - `pm-` ProductModal Menú · `gm-` GroupModal (tab Productos) · `mod-` ModifiersPanel
  - `hp-` HistorialPage · `hdd-` HistoryDetailDrawer
  - `cp-` ClientsPage · `csm-` ClientSearchModal · `cfm-` ClientFilterModal · `cd-` ClientDrawer
  - `dp-ce-` inline client editor en DetailPanel · `obm-ac-` autocomplete en OrderBuilderModal
  - `opt-` OrderPrintTemplate ticket · `dp-print-` print button/popover en DetailPanel
- **No router** — `activePage` state en App.jsx
- **IDs** — `crypto.randomUUID()` para órdenes e ítems de pedido; `generateId()` (contador desde 90000) para productos y opciones del menú
- **Imágenes** — `product.images?.[0] ?? product.image` en todo lugar que muestre la imagen principal
- **Formato moneda** — `const fmt = (n) => \`$\${Number(n).toLocaleString('es-CL')}\``
- **Modales** — Escape + click en overlay para cerrar

---

## Módulo 7 — Impresión de tickets (`src/components/pdv/OrderPrintTemplate`)

**Estado** — completado (Req 1 + Req 2 + fix sincronía/visibilidad + modos cocina/cliente).

### Archivos

| Archivo | Propósito |
|---|---|
| `src/components/pdv/OrderPrintTemplate.jsx` | Componente **solo presentacional**. Recibe `{ order, mode }`. Sin lógica de `window.print()`. |
| `src/components/pdv/OrderPrintTemplate.css` | Técnica `visibility` + selectores `.is-kitchen` para el modo cocina. |

### Props de OrderPrintTemplate

```js
<OrderPrintTemplate
  order={order}   // Shape de orden completo (ver sección PDV)
  mode="cocina"   // 'cocina' | 'cliente'
/>
```

`isKitchen = mode === 'cocina'` — derivado internamente. Activa la clase `.is-kitchen` en el elemento raíz.

### Flujo de impresión (lógica centralizada en DetailPanel)

1. El botón 🖨️ del header abre el **popover** (`dp-print-popover`) con "🍕 Ticket de cocina" y "🧾 Ticket de cliente".
2. Al elegir, se setea `printMode` (`'cocina'` | `'cliente'`), que además se pasa como `mode` al template.
3. **`useEffect #1`** — reacciona a `printMode`. Espera **150 ms** y lanza `window.print()`.
4. **`useEffect #2`** — escucha `afterprint` una sola vez (`[]`). Resetea `printMode → null`.

### Modos diferenciados: ¿qué muestra cada ticket?

| Dato | Ticket Cliente | Ticket Cocina |
|---|:---:|:---:|
| Nombre del negocio | ✅ (24px) | ✅ (20px) |
| Dirección del local | ✅ | ❌ (ahorra espacio) |
| Fecha y hora | ✅ | ✅ (solo hora) |
| **N° pedido + tipo** | ✅ 22px | ✅ **42px** — elemento dominante |
| Origen / Ref | ✅ | ❌ |
| Nombre del cliente | ✅ 14px | ✅ **18px** |
| Teléfono | ✅ | ✅ |
| Dirección de delivery | ✅ | ✅ (info operativa) |
| Nombre + cantidad del ítem | ✅ 13px bold | ✅ **18px bold** |
| **Precio unitario del ítem** | ✅ | ❌ |
| Modificadores/extras | ✅ 11px | ✅ **14px bold** |
| **Precio del modificador** | ✅ | ❌ |
| Notas del ítem | ✅ | ✅ bold |
| **Notas del pedido** | ✅ borde simple | ✅ **borde doble, 16px bold** |
| Subtotal / cargos / Total | ✅ (TOTAL 24px) | ❌ |
| Texto legal "sin valor fiscal" | ✅ italic | ❌ |
| Estado de pago / Método | ✅ | ❌ |
| Pie — confirmación | "¡Gracias!" | "PEDIDO #N" 16px bold |

> **Criterio de diseño:** la cocina solo necesita saber **qué** preparar y **para quién**. Los precios son ruido operativo que puede generar confusión.

### CSS — estrategia de selectores

```css
/* Base (ambos modos) */
.order-print-template .opt-item-label { font-size: 13px; }

/* Solo cocina — override con especificidad por clase */
.order-print-template.is-kitchen .opt-item-label { font-size: 18px; }
```

Todos los selectores son descendientes de `.order-print-template` — ninguno afecta la UI de la app.

### CSS de aislamiento — técnica `visibility`

`body * { visibility: hidden }` + `.order-print-template, .order-print-template * { visibility: visible }` — funciona a cualquier profundidad de anidamiento en el DOM React.

### Clase raíz y prefijos CSS

| Componente | Clase raíz / prefijo |
|---|---|
| `OrderPrintTemplate` (cliente) | `.order-print-template` |
| `OrderPrintTemplate` (cocina) | `.order-print-template.is-kitchen` |
| Clases internas | `opt-` |
| Controles en DetailPanel | `dp-print-btn` · `dp-print-wrap` · `dp-print-popover` · `dp-print-option` |

---

## Módulos por construir

### Módulo 3 — Cocina (`/kitchen`)
Panel de visualización de órdenes en curso para la cocina. Cards grandes con timer, sin acciones complejas.

### Módulo 4 — Ventas (`/historial`)
Grilla de alta densidad (CSS Grid, sin `<table>`) sobre `OrdersContext`. Drawer lateral `HistoryDetailDrawer` para ver detalles + gestión de pagos inline (menú popover ⋮ para anular/reasignar).
**Exportación a Excel**: Botón que exporta el estado actual filtrado a CSV (BOM UTF-8, separador punto y coma). Incluye desglose financiero avanzado (subtotales de ítems, monto y tipo de descuento, propinas, empaque, delivery y totales netos/brutos) sin usar librerías externas (solo Vanilla JS `Blob`).

### Módulo 8 — Configuración de Delivery (`/settings`)
**Estado** — Completado y conectado a Supabase (tabla `delivery_zones`).

#### Archivos

| Archivo | Propósito |
|---|---|
| `src/context/SettingsContext.jsx` | Contexto de configuración global interactuando en tiempo real con Supabase. |
| `src/components/settings/DeliveryMap.jsx` | Componente de mapa Google Maps inyectado nativamente. DrawingManager para polígonos. |
| `src/components/settings/DeliveryMap.css` | Prefijo `dmap-`. |
| `src/pages/settings/SettingsPage.jsx` | Página principal. Layout 2 columnas: mapa + sidebar de zonas. |
| `src/pages/settings/SettingsPage.css` | Prefijo `sp-`. |

#### SettingsContext — shape heredado desde Supabase

```js
// Proveniente de tabla: delivery_zones
{
  id:         string,                        // UUID
  name:       string,                        // 'Zona Centro'
  price:      number,                        // costo en CLP
  color:      string,                        // hex '#2563eb'
  polygon:    Array<{ lat: number, lng: number }>,
  active:     boolean,
  sort_order: number,
  created_at: string
}
```

Provee: `{ deliveryZones, addZone, updateZone, deleteZone }`  
Registrado en `main.jsx` como `<SettingsProvider>` envolviendo `<App>`. Realiza lecturas hacia la DB al montar y re-sincroniza (fetchZones) tras cada escritura, eliminando por completo la deuda técnica de depender de `localStorage`.

#### Google Maps — integración nativa (sin librerías wrapper)

**Regla arquitectónica:** no usar `@react-google-maps/api` ni ningún wrapper. Se inyecta el script directamente:

```js
// useGoogleMapsLoader — hook interno de DeliveryMap.jsx
const script = document.createElement('script')
script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=drawing,places,geometry`
document.head.appendChild(script)
```

El hook devuelve `{ loaded, error }`. El mapa solo se inicializa cuando `loaded === true`.

- **Centro:** Buin, Chile `{ lat: -33.732, lng: -70.742 }`, zoom 14
- **DrawingManager:** configurado exclusivamente para `OverlayType.POLYGON`
- **API Key:** constante `API_KEY` en `DeliveryMap.jsx` — reemplazar `'INSERTAR_API_KEY_AQUI'` por la key real

#### Flujo de uso en Configuración

1. Usuario dibuja polígono → `onZoneDrawn(coords, polygonInstance)` se llama
2. Sidebar muestra formulario: nombre, precio, color  
3. Al guardar → `addZone(...)` persiste en `localStorage` + actualiza estado
4. El mapa re-renderiza el polígono como zona de solo lectura con `google.maps.Polygon`

#### Integración de PDV + Delivery Calculator

El cálculo de envío se ejecuta en tiempo real durante la construcción del pedido (`OrderBuilderModal.jsx`):
1. El archivo `src/utils/deliveryCalculator.js` expone `calculateDeliveryPrice(address, zones)`, usando la API `Geocoder` pura y `geometry.poly.containsLocation`.
2. Cache local in-memory previene múltiple facturación a la API para la misma dirección exacta.
3. Se inserta en el PDV con un *debounce* de 800ms sobre el campo de texto de dirección.
4. Si está fuera de zona (no es válida o no intercepta ningún polígono), expone UI de Alerta y un input para ingresar el costo manual de envío de todos modos.
5. La suma calculada u override sobrescribe la propiedad `charges.delivery` del Payload, impactando el total del ticket nativamente.

#### Prefijos CSS

`dmap-` — DeliveryMap  
`sp-` — SettingsPage

---

## Lo que NO hacer

- No crear nuevos archivos `.css` separados (usar Tailwind)
- No instalar librerías de UI (shadcn, MUI, Chakra, etc.)
- No agregar react-router — la navegación es por estado
- No usar `<table>` para listas de datos — usar CSS Grid con divs (aplica a pedidos, clientes e historial)
- No guardar datos en localStorage excepto: (1) el logo del negocio y (2) las zonas de delivery (`pizzeria_delivery_zones`) — ambas excepciones arquitectónicas explícitas
- No crear helpers o abstracciones para uso único
- No agregar comentarios donde la lógica es obvia
- No usar librerías de parseo CSV/Excel (papaparse, xlsx, etc.) — usar Vanilla JS: `FileReader` + manipulación de strings
- No hardcodear listas de clientes en los componentes — consumir siempre `ClientContext`
- No mezclar lógica de cobro y finalización: `paid: true` ≠ `status: 'finalizado'`

---

## Módulo 5 — Clientes (`src/pages/clientes/`)

**Estado** — completado (funcionalidad core).

### ClientContext.jsx — Única fuente de verdad de clientes (Supabase)

**Estado:** Conectado a Supabase (Migrado exitosamente).

Provee a toda la app:
```js
{ clients, fetchClients, registerClientFromOrder, saveClient, importBulkClients }
```

Inicializado en `main.jsx` como `<ClientProvider>` envolviendo `<App>`. Descarga los clientes interactuando con la nube mediante un `useEffect` (`fetchClients`) y mantiene los campos `loyaltyPoints` y `totalOrders` en camelCase para las vistas de la app.

**Shape de cliente:**
```js
{
  id:            string,           // 'c1', 'c{Date.now()}', etc.
  name:          string,
  phone:         string,           // formato libre, e.g. '+56 995176918'
  addresses:     string[],         // ARRAY — nunca el campo 'address' (string) en clientes nuevos
  channel:       'Chatbot' | 'PDV' | 'Menú digital' | 'Directo' | 'Importado',
  loyaltyPoints: number,
  totalOrders:   number,
  segment:       'Comprador Élite' | 'Comprador Top' | 'Comprador Frecuente' | 'Comprador',
  status:        'Activo' | 'Durmiendo' | 'En riesgo',
}
// Nota: clientes legacy con 'address: string' se normalizan automáticamente
// a 'addresses: [address]' al inicializar el contexto (normalizeClient()).
```

**`normalizePhone(raw)`** — función interna del contexto (también replicada en DetailPanel y OrderBuilderModal):
```js
// Elimina todo lo que no sea dígito, luego quita prefijo '56' si la longitud > 9
// '+56 9 9517 6918' → '995176918'
// '56912345678'     → '912345678'
// '912345678'       → '912345678'
const digits = raw.replace(/\D/g, '')
return digits.startsWith('56') && digits.length > 9 ? digits.slice(2) : digits
```

**`registerClientFromOrder(clientData, origin)`**
- `clientData` tiene forma `{ name, phone, addr }` (campo `addr`, no `address`).
- Busca por teléfono normalizado con `findIndex`.
- **Existe:** incrementa `totalOrders`, hace push de `addr` a `addresses` si es nuevo.
- **No existe:** crea cliente nuevo con `addresses: [addr]` (array).
- La búsqueda es inmune al formato del teléfono almacenado por `normalizePhone()`.

**`saveClient(data, existingId)`** — CRUD manual desde el Drawer:
- `data.addresses` debe ser `string[]`.
- Si `existingId`: actualiza name, phone y addresses.
- Si `null`: crea nuevo con canal 'Directo', loyaltyPoints: 0, totalOrders: 0.

**`importBulkClients(importedArray)`** — importación masiva:
- Itera el array importado, deduplicando por teléfono normalizado.
- **Existe:** merge de datos + push de direcciones nuevas sin duplicar.
- **No existe:** append directo.

### ClientsPage.jsx — Vista principal

- Usa `display: grid` estricto. **Cero `<table>`**.
- Grid de 7 columnas: `2fr 1.2fr 1.2fr 1.2fr 1.6fr 1.2fr 60px`.
- Sorting en columnas "Puntos de fidelidad" y "Total de pedidos" (asc → desc → null, 3 clics).
- Top pills: Todos / Comprador Élite / Comprador Top / Comprador Frecuente.
- Filtros avanzados y pill activa se combinan con lógica AND entre sí.

**Importar/Exportar CSV (Vanilla JS puro):**
- Botón con dropdown (`.cp-ie-menu`) con opciones "📥 Importar CSV" y "📤 Exportar CSV".
- Exportar: construye string CSV con encabezados, escapa comillas (`"` → `""`), separa `addresses[]` con ` | `, descarga con `Blob + URL.createObjectURL`.
- Importar: `FileReader.readAsText()` → regex RFC 4180 para parseo → `importBulkClients()`.
- Sin `papaparse`, sin `xlsx`, sin ninguna librería externa.
- `event.target.value = null` al terminar para permitir re-subir el mismo archivo.

### Modales y Drawer

| Componente | Propósito | CSS prefix |
|---|---|---|
| `ClientSearchModal` | Búsqueda dual nombre/teléfono. Input con selector `<select>`. Prefijo `+56` gris para teléfono. Resultados en lista en tiempo real. | `csm-` |
| `ClientFilterModal` | Drawer lateral 380px. 3 secciones con checkboxes: Tipo de cliente, Estatus, Canal de creación. Botón "Filtrar ahora" dispara `onApplyFilters({types,statuses,channels})`. Pre-rellena checkboxes con `initialFilters`. | `cfm-` |
| `ClientDrawer` | Panel lateral 450px. Modo dual: "Nuevo cliente" (form vacío) o "Administrar cliente" (muestra stats + badges). Campo teléfono con `🇨🇱 +56`. Campo Dirección reemplazado por lista editable de `addresses[]` con botón × por dirección y campo "+ Agregar nueva dirección" con Enter. Link verde WhatsApp en modo edición. | `cd-` |

**Conexión con Buscador:** clic en resultado de `ClientSearchModal` → cierra modal, abre `ClientDrawer` con ese cliente.

**Regla de segmento en filtro avanzado:** los `val` del checkbox son los strings exactos del campo `segment` del cliente (ej. `'Comprador Élite'`, no `'Comprador Élite (Más de 8)'`).

---

## Base de Datos — Supabase (PostgreSQL)

**Estado** — esquema DDL v1.0 generado. Pendiente: integración de clientes SDK en la app.

### Motivación

El sistema actualmente opera 100% en memoria (estado React). La migración a Supabase es incremental: primero se diseña el esquema fiel a los shapes actuales, luego se reemplazan los contextos uno a uno.

### Archivo DDL

El script SQL completo está en `supabase_ddl_v1.sql` (entregar al equipo para ejecutar en Supabase > SQL Editor > Run).

### Tablas y correspondencia con contextos React

| Tabla | Fuente React | Notas clave |
|---|---|---|
| `clients` | `ClientContext` | `phone` UNIQUE para UPSERT de deduplicación |
| `categories` | `MenuContext` | IDs numéricos, igual que `generateId()` |
| `modifier_groups` | `MenuContext` | `options` en JSONB (incluye `priceByVariant`) |
| `products` | `MenuContext` | `images`, `variants`, `modifier_group_ids`, `stock` en JSONB |
| `orders` | `OrdersContext` | `items` y `charges` en JSONB; FK a `clients` + snapshot |
| `delivery_zones` | `SettingsContext` | `polygon` JSONB; reemplaza el `localStorage` actual |

### Decisiones de diseño

1. **JSONB sobre normalización** — `items`, `charges`, `polygon`, `options`, `images`, `variants` y `addresses` se almacenan como JSONB porque cambian con frecuencia de estructura y no son objetivo de JOINs. Simplifica las migraciones de esquema sin downtime.

2. **`client_snapshot` en orders** — la tabla `orders` guarda FK a `clients` (`client_id`) Y una copia inmutable `client_snapshot: { name, phone, addr }` al momento de la creación. Esto garantiza que el historial no mute si el cliente cambia sus datos.

3. **`phone` UNIQUE en `clients`** — resuelve el bug actual donde `registerClientFromOrder` puede crear clientes duplicados. La lógica de upsert en Supabase será:
   ```sql
   INSERT INTO clients (phone, name, addresses, ...)
   VALUES ($1, $2, $3, ...)
   ON CONFLICT (phone) DO UPDATE
     SET name = EXCLUDED.name,
         addresses = (
           SELECT jsonb_agg(DISTINCT val)
           FROM jsonb_array_elements(clients.addresses || EXCLUDED.addresses) AS val
         ),
         total_orders = clients.total_orders + 1,
         updated_at = NOW();
   ```

4. **RLS abierto temporalmente** — todas las tablas tienen `ENABLE ROW LEVEL SECURITY` con policy `FOR ALL USING (true)`. Esto debe reemplazarse con políticas basadas en roles de Supabase Auth cuando se implemente el login de administrador.

5. **`deleted` en orders** — las órdenes nunca se eliminan físicamente (`DELETE`). Se usa soft-delete (`deleted = TRUE`) para mantener el historial de auditoría.

6. **Triggers `updated_at`** — `clients` y `products` tienen trigger `BEFORE UPDATE` que actualiza automáticamente `updated_at = NOW()`.

### Índices

| Índice | Tabla | Propósito |
|---|---|---|
| `idx_clients_name` | `clients` | Autocomplete rápido por nombre en PDV |
| `idx_products_category` | `products` | Filtrar productos por categoría |
| `idx_products_active` | `products` | Mostrar solo activos en PDV |
| `idx_orders_status` | `orders` | Filtrar por estado en PDV live |
| `idx_orders_type` | `orders` | Canal mostrador/domicilio/mesas |
| `idx_orders_created_at` | `orders` | Historial ordenado por fecha DESC |
| `idx_orders_client_id` | `orders` | Historial de pedidos por cliente |
| `idx_orders_paid` | `orders` | Filtro de pago en historial |
| `idx_orders_deleted` | `orders` | Excluir soft-deleted del PDV |

### Cliente Supabase Configurado

- **Paquete:** `@supabase/supabase-js`.
- **Conexión:** instanciada en `src/lib/supabase.js` exportando la constante `supabase`.
- **Seguridad:** Las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` viven en el `.env` (ignorado en git), previniendo que las llaves se suban al repositorio.

### Próximos pasos de integración

*La migración general de contextos a Supabase está completada (Clients, Orders PDV, Menu y Settings).*

---

## Autenticación y Seguridad

**Estado:** Completado.

Todo el panel administrativo está fuertemente protegido (route guard) mediante **Supabase Auth** (Email/Password).
- El estado de la sesión es manejado asincrónicamente e inyectado en la raíz de React a través del `<AuthProvider>` (`src/context/AuthContext.jsx`).
- El componente `App.jsx` actúa como guardia: si `user` es nulo, la pantalla se encierra explícitamente en el `<Login />` anulando el acceso al enrutador de vistas, el Sidebar y cualquier Contexto dependiente de la interfaz.
- La pantalla nativa `<Login />` está construida respetando la estética actual del proyecto (`var(--surface)`, `var(--brand)`) y maneja el feedback visual de errores como credenciales incorrectas.

---

## Sesión del 22 de Abril 2026 - Parte 2

- **Refactorización del PDV** a diseño de pantalla completa anidado (3 columnas) bajo el header principal.
- **Implementación de scroll independiente** (`overflow-y-auto`) para las columnas de Categorías, Productos y Ticket.
- **Implementación de Scroll Continuo (Spy Scroll)** en la lista de productos y limpieza visual del sidebar (sin emojis ni contadores).
- **Corrección del scroll en el módulo de Menú (Panel Admin)** para que ocupe todo el alto disponible y la barra quede al ras de la pantalla.
- **Fix en el input del teléfono del cliente**: Regex `\D` implementado para limpiar espacios y caracteres especiales al pegar números desde WhatsApp, respetando el `maxLength`.

