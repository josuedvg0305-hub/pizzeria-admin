import { useState, useEffect, useRef, useMemo } from 'react'
import { computeOrderTotal } from '../../utils/orderMath'
import OrderPrintTemplate from './OrderPrintTemplate'
import './OrderRow.css'

function IconPrinter() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

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

  /* Print state */
  const [printMode, setPrintMode] = useState(null)   // null | 'cocina' | 'cliente'
  const [printOpen, setPrintOpen] = useState(false)  // popover visible
  const printPopoverRef = useRef(null)

  /* 1) Disparar window.print() después de que React haya pintado el ticket */
  useEffect(() => {
    if (!printMode) return
    const timer = setTimeout(() => window.print(), 150)
    return () => clearTimeout(timer)
  }, [printMode])

  /* 2) Resetear printMode cuando el diálogo de impresión se cierre (o se cancele) */
  useEffect(() => {
    const handler = () => setPrintMode(null)
    window.addEventListener('afterprint', handler)
    return () => window.removeEventListener('afterprint', handler)
  }, [])

  /* Cerrar popover al hacer clic fuera */
  useEffect(() => {
    if (!printOpen) return
    const handler = (e) => {
      if (printPopoverRef.current && !printPopoverRef.current.contains(e.target)) {
        setPrintOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [printOpen])

  const grandTotal = useMemo(() => computeOrderTotal(order), [order])

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
  const isCanceled = order.status === 'cancelado'

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
        <span className="or-total !text-xl !font-bold">{fmt(grandTotal)}</span>
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
        {/* ── Botón Imprimir (atajo) ── */}
        <div className="relative" ref={printPopoverRef}>
          <button
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors text-xl flex items-center justify-center mr-1"
            title="Imprimir ticket"
            onClick={() => setPrintOpen(v => !v)}
          >
            <IconPrinter />
          </button>
          {printOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 shadow-xl rounded-md z-50 flex flex-col w-48 overflow-hidden text-sm">
              <button
                className="px-4 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 transition-colors border-b border-gray-100"
                onClick={() => { setPrintOpen(false); setPrintMode('cocina') }}
              >
                🍕 Ticket de cocina
              </button>
              <button
                className="px-4 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => { setPrintOpen(false); setPrintMode('cliente') }}
              >
                🧾 Ticket de cliente
              </button>
            </div>
          )}
        </div>

        {showCancel && (
          <button
            className="or-btn or-btn--cancel !text-sm !font-semibold"
            onClick={() => onAction('cancel')}
            title="Cancelar pedido"
          >
            Cancelar
          </button>
        )}
        {!isCanceled && (
          order.paid ? (
            <span className="text-green-600 font-semibold px-2 py-1 text-sm flex items-center justify-center">
              ✓ Pagado
            </span>
          ) : (
            <button
              className="or-btn or-btn--pay !text-sm !font-semibold"
              onClick={() => onAction('pay')}
              title="Cobrar pedido"
            >
              Cobrar
            </button>
          )
        )}
        {primaryBtn}
      </div>

      {/* Renderizado condicional del ticket invisible para impresión */}
      {printMode && (
        <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999]">
          <OrderPrintTemplate order={order} mode={printMode} />
        </div>
      )}
    </div>
  )
}
