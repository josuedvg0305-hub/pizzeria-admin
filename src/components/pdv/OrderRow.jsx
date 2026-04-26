import { useState, useEffect } from 'react'
import './OrderRow.css'

const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`

const TYPE_CONFIG = {
  flash:    { icon: '⚡', label: 'Pedido Flash' },
  local:    { icon: '🏪', label: 'En el local'  },
  llevar:   { icon: '🛍️', label: 'Para llevar'  },
  delivery: { icon: '🛵', label: 'Delivery'      },
  mesa:     { icon: '🪑', label: 'Mesa'          },
}

const ORDER_STATES = {
  pend:        { label: 'Pendiente',      color: '#92400e', bg: '#fef3c7', cls: 'or-badge--pend'        },
  preparacion: { label: 'En preparación', color: '#1d4ed8', bg: '#dbeafe', cls: 'or-badge--preparacion' },
  listo:       { label: 'Listo',          color: '#065f46', bg: '#d1fae5', cls: 'or-badge--listo'       },
  finalizado:  { label: 'Finalizado',     color: '#374151', bg: '#f3f4f6', cls: 'or-badge--finalizado'  },
  cancelado:   { label: 'Cancelado',      color: '#991b1b', bg: '#fee2e2', cls: 'or-badge--cancelado'   },
}

function fmtTime(date) {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function agoText(date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1)  return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `hace ${h} h ${m} min` : `hace ${h} h`
}

function fmtSchedLabel(scheduledAt) {
  if (!scheduledAt) return null
  const d    = new Date(scheduledAt)
  const now  = new Date()
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  const todayStr    = now.toDateString()
  const tomorrowStr = new Date(now.getTime() + 86400000).toDateString()
  if (d.toDateString() === todayStr)    return `📅 Hoy ${time}`
  if (d.toDateString() === tomorrowStr) return `📅 Mañana ${time}`
  return `📅 ${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} ${time}`
}

function fmtPhone(phone) {
  if (!phone) return null
  const d = phone.replace(/\D/g, '')
  if (d.length === 9) return `+56 ${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`
  return phone
}

function useTick(ms = 15000) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

export default function OrderRow({ order, selected, onClick, onAction }) {
  useTick()
  const tc    = TYPE_CONFIG[order.type]    ?? { icon: '📋', label: order.type }
  const state = ORDER_STATES[order.status] ?? ORDER_STATES.pend

  const isDone = order.status === 'finalizado' || order.status === 'cancelado'

  /* ── Time display ── */
  const timeNode = isDone
    ? <span className="or-closed !text-sm">Cerrado {fmtTime(order.closedAt)}</span>
    : <span className="or-ago !text-sm">{agoText(order.createdAt)}</span>

  /* ── Primary action button ── */
  let primaryBtn = null
  if (order.status === 'pend') {
    primaryBtn = (
      <button className="or-btn or-btn--accept !text-sm !font-bold" onClick={() => onAction('advance')}>
        ▶ Aceptar
      </button>
    )
  } else if (order.status === 'preparacion') {
    primaryBtn = (
      <button className="or-btn or-btn--prep !text-sm !font-bold" onClick={() => onAction('advance')}>
        🍕 Listo
      </button>
    )
  } else if (order.status === 'listo') {
    primaryBtn = (
      <button className="or-btn or-btn--finish !text-sm !font-bold" onClick={() => onAction('advance')}>
        ✓ Finalizar
      </button>
    )
  }

  const showCancel = order.status === 'pend' || order.status === 'preparacion' || order.status === 'listo'
  const showPay    = !order.paid && (order.status !== 'cancelado')

  return (
    <div
      className={`order-row ${selected ? 'order-row--selected' : ''}`}
      onClick={onClick}
    >
      {/* ── FECHA / TIPO ── */}
      <div className="or-cell">
        <span className="or-num !text-lg !font-bold">#{order.num}</span>
        <span className="or-type !text-sm">
          <span className="or-type-icon">{tc.icon}</span>
          {tc.label}
        </span>
        <span className="or-time !text-sm">{fmtTime(order.createdAt)}</span>
        {order.scheduledAt && (
          <span className="or-sched !text-xs">{fmtSchedLabel(order.scheduledAt)}</span>
        )}
        {timeNode}
      </div>

      {/* ── ESTADO ── */}
      <div className="or-cell">
        <span className={`or-badge ${state.cls} !text-sm`}>{state.label}</span>
      </div>

      {/* ── TOTAL ── */}
      <div className="or-cell">
        <span className="or-total !text-xl !font-bold">{fmt(order.total)}</span>
      </div>

      {/* ── CLIENTE ── */}
      <div className="or-cell">
        {order.client?.name ? (
          <>
            <span className="or-client-name !text-base !font-semibold">{order.client.name}</span>
            {order.client.phone && (
              <span className="or-client-phone !text-sm">{fmtPhone(order.client.phone)}</span>
            )}
            {order.client.addr && (
              <span className="or-client-addr !text-sm">{order.client.addr}</span>
            )}
            {order.paid && order.paymentMethod && (
              <span className="or-paid-badge !text-xs">💳 {order.paymentMethod} · Cobrado</span>
            )}
          </>
        ) : (
          <span className="or-no-client !text-sm">—</span>
        )}
      </div>

      {/* ── ACCIONES ── */}
      <div className="or-cell or-cell--actions" onClick={e => e.stopPropagation()}>
        {showCancel && (
          <button
            className="or-btn or-btn--cancel !text-sm !font-semibold"
            onClick={() => onAction('cancel')}
            title="Cancelar pedido"
          >
            Cancelar
          </button>
        )}
        {showPay && (
          <button
            className="or-btn or-btn--pay !text-sm !font-semibold"
            onClick={() => onAction('pay')}
            title="Cobrar pedido"
          >
            Cobrar
          </button>
        )}
        {primaryBtn}
      </div>
    </div>
  )
}
