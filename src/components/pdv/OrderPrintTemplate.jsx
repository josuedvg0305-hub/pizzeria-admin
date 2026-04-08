import './OrderPrintTemplate.css'

const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`

function fmtDateTime(date) {
  if (!date) return '—'
  const d = new Date(date)
  const day  = String(d.getDate()).padStart(2, '0')
  const mon  = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const h    = String(d.getHours()).padStart(2, '0')
  const min  = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${mon}/${year} ${h}:${min}`
}

const TYPE_LABELS = {
  flash:    'Flash',
  local:    'En el local',
  llevar:   'Para llevar',
  delivery: 'Domicilio',
  mesa:     'Mesa',
}

function computeTotals(order) {
  const items    = order.items ?? []
  const charges  = order.charges ?? {}
  const subtotal = items.reduce((s, i) => s + (i.total ?? 0), 0)
  const discAmt  = order.discountMode === '%'
    ? Math.round(subtotal * (Number(order.discountVal) || 0) / 100)
    : (Number(order.discountVal) || 0)
  const subtotalNet = Math.max(0, subtotal - discAmt)
  const delivery    = Number(charges.delivery)  || 0
  const tip         = charges.tipMode === '%'
    ? Math.round(subtotalNet * (Number(charges.tipVal) || 0) / 100)
    : (Number(charges.tipVal) || 0)
  const servicio = Number(charges.servicio) || 0
  const empaque  = Number(charges.empaque)  || 0
  const total    = subtotalNet + delivery + tip + servicio + empaque
  return { subtotal, discAmt, subtotalNet, delivery, tip, servicio, empaque, total }
}

/*
  Componente de solo presentación.
  Props:
    order  — objeto de pedido (Shape de orden según CONTEXT.md)
    mode   — 'cocina' | 'cliente'  (viene de printMode en DetailPanel)

  Cuando mode === 'cocina' (isKitchen):
    OCULTA: precios unitarios, precios de modificadores, subtotales,
            delivery, total, texto legal, estado de pago, método de pago,
            dirección del local.
    MUESTRA: número de pedido MASIVO, cliente, ítems con fuente grande,
             modificadores claramente indentados, notas en bloque destacado.
*/
export default function OrderPrintTemplate({ order, mode }) {
  if (!order) return null

  const isKitchen = mode === 'cocina'

  const { subtotal, discAmt, subtotalNet, delivery, tip, servicio, empaque, total } =
    computeTotals(order)

  const typeLabel = TYPE_LABELS[order.type] ?? order.type ?? ''
  const shortId   = String(order.id ?? '').slice(-6).toUpperCase()
  const hasClient = order.client && (order.client.name || order.client.phone)

  // Comentarios/notas a nivel de pedido
  const hasNotes = Boolean(order.note || order.comments)
  const notesText = [order.note, order.comments].filter(Boolean).join(' / ')

  // Clase raíz: añade is-kitchen para activar selectores CSS específicos
  const rootClass = `order-print-template${isKitchen ? ' is-kitchen' : ''}`

  return (
    <div className={rootClass} aria-hidden="true">

      {/* ── Cabecera ── */}
      {isKitchen ? (
        /* COCINA: sin nombre del local, cabecera ultra-compacta */
        <div className="opt-kitchen-header">
          <div className="opt-kitchen-num">#{order.num} — {typeLabel}</div>
          <div className="opt-kitchen-date">{fmtDateTime(order.createdAt)}</div>
        </div>
      ) : (
        /* CLIENTE: cabecera completa con nombre, dirección y metadatos */
        <>
          <div className="opt-header">
            <div className="opt-biz-name">La Pizzería de Buin</div>
            <div className="opt-biz-addr">Buin, Región Metropolitana</div>
          </div>
          <div className="opt-divider" />
          <div className="opt-meta">
            <div className="opt-meta-date">{fmtDateTime(order.createdAt)}</div>
            <div className="opt-meta-order">#{order.num} — {typeLabel}</div>
            <div className="opt-meta-origin">{order.origin ?? 'PDV'} · Ref: {shortId}</div>
          </div>
        </>
      )}

      <div className="opt-divider" />


      {/* ── Cliente ── */}
      {hasClient && (
        <>
          <div className="opt-client">
            {order.client.name  && (
              <div className="opt-client-name">{order.client.name}</div>
            )}
            {order.client.phone && (
              <div className="opt-client-line">{order.client.phone}</div>
            )}
            {/* Dirección: solo en cliente y si es delivery */}
            {!isKitchen && order.client.addr && order.type === 'delivery' && (
              <div className="opt-client-line">{order.client.addr}</div>
            )}
            {/* En cocina también mostramos la dir. de delivery (es info operativa) */}
            {isKitchen && order.client.addr && order.type === 'delivery' && (
              <div className="opt-client-line">{order.client.addr}</div>
            )}
          </div>
          <div className="opt-divider" />
        </>
      )}

      {/* ── Lista de productos ── */}
      <div className="opt-items">
        {(order.items ?? []).map((item, i) => {
          const mods = item.mods?.length > 0
            ? item.mods
            : (item.modifiers ?? []).map(m => m.name)
          const modPrices = item.modifiers ?? []

          return (
            <div key={`${item.id}-${i}`} className="opt-item">

              {/* Fila principal */}
              <div className="opt-item-row">
                <span className="opt-item-label">
                  x{item.qty} {item.name}{item.variant ? ` — ${item.variant}` : ''}
                </span>
                {/* Precio: solo ticket de cliente */}
                {!isKitchen && (
                  <span className="opt-item-price">{fmt(item.total ?? 0)}</span>
                )}
              </div>

              {/* Modificadores */}
              {mods.length > 0 && mods.map((mod, mi) => {
                const modObj     = modPrices[mi]
                // Precio del modificador: solo visible en ticket cliente
                const extraPrice = (!isKitchen && modObj?.price)
                  ? ` ${fmt(modObj.price)}` : ''
                return (
                  <div key={mi} className="opt-item-mod">
                    +{item.qty} {mod}{extraPrice}
                  </div>
                )
              })}

              {/* Nota del ítem */}
              {item.note && (
                <div className="opt-item-note">📝 {item.note}</div>
              )}

            </div>
          )
        })}
      </div>

      {/* ── Notas / comentarios del pedido — bloque destacado en cocina ── */}
      {hasNotes && (
        <>
          <div className="opt-divider" />
          <div className={`opt-notes-block${isKitchen ? ' opt-notes-block--kitchen' : ''}`}>
            <div className="opt-notes-label">⚠ NOTAS DEL PEDIDO</div>
            <div className="opt-notes-text">{notesText}</div>
          </div>
        </>
      )}

      {/* ── Totales: solo ticket de cliente ── */}
      {!isKitchen && (
        <>
          <div className="opt-divider" />
          <div className="opt-totals">
            <div className="opt-total-row">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {discAmt > 0 && (
              <div className="opt-total-row">
                <span>Descuento</span>
                <span>-{fmt(discAmt)}</span>
              </div>
            )}
            {delivery > 0 && (
              <div className="opt-total-row">
                <span>Precio de entrega</span>
                <span>{fmt(delivery)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="opt-total-row">
                <span>Propina</span>
                <span>{fmt(tip)}</span>
              </div>
            )}
            {servicio > 0 && (
              <div className="opt-total-row">
                <span>Servicio</span>
                <span>{fmt(servicio)}</span>
              </div>
            )}
            {empaque > 0 && (
              <div className="opt-total-row">
                <span>Empaque</span>
                <span>{fmt(empaque)}</span>
              </div>
            )}
            <div className="opt-divider" />
            <div className="opt-total-final">
              <span>TOTAL</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        </>
      )}

      <div className="opt-divider" />

      {/* ── Pie de página ── */}
      <div className="opt-footer">
        {/* Pie completo: solo ticket de cliente */}
        {!isKitchen ? (
          <>
            <div className="opt-footer-legal">
              Este documento no tiene valor fiscal.
            </div>
            <div className="opt-footer-pay-row">
              <span>Estado de pago:</span>
              <span>{order.paid ? 'Pagado' : 'Pendiente'}</span>
            </div>
            {order.paymentMethod && (
              <div className="opt-footer-pay-row">
                <span>Método:</span>
                <span>{order.paymentMethod}</span>
              </div>
            )}
            <div className="opt-footer-thanks">¡Gracias por su preferencia!</div>
          </>
        ) : (
          /* Pie de cocina: solo el número de pedido repetido como confirmación */
          <div className="opt-kitchen-footer">
            PEDIDO #{order.num}
          </div>
        )}
      </div>

    </div>
  )
}
