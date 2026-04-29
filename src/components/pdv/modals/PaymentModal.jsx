import { useState, useEffect, useMemo } from 'react'
import './PaymentModal.css'

const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`

const METHODS = [
  { id: 'Efectivo',     label: 'Efectivo',     emoji: '💵' },
  { id: 'Tarjeta',      label: 'Tarjeta',      emoji: '💳' },
  { id: 'Transferencia', label: 'Transferencia', emoji: '📱' },
]

/** Build the canonical payments array from the per-method input map */
function buildPayments(amounts) {
  return METHODS
    .map(m => ({ method: m.id, amount: Number(amounts[m.id]) || 0 }))
    .filter(p => p.amount > 0)
}

export default function PaymentModal({ order, onConfirm, onClose }) {
  // amounts[method.id] = string value from input
  const [amounts, setAmounts] = useState(() =>
    Object.fromEntries(METHODS.map(m => [m.id, '']))
  )

  /* Escape to close */
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const total = order.total

  /* Derived sums */
  const paidSum   = useMemo(() => METHODS.reduce((s, m) => s + (Number(amounts[m.id]) || 0), 0), [amounts])
  const cashAmt   = Number(amounts['Efectivo']) || 0
  const nonCash   = paidSum - cashAmt
  const change    = cashAmt > 0 && paidSum >= total ? cashAmt - (total - nonCash) : null
  const remaining = Math.max(0, total - paidSum)

  /* Confirm enabled: full amount covered (cash can exceed for change) */
  const canConfirm = paidSum >= total

  const setAmount = (methodId, val) =>
    setAmounts(prev => ({ ...prev, [methodId]: val }))

  /* Quick-fill the remaining into a method */
  const fillRemaining = (methodId) => {
    if (remaining <= 0) return
    setAmounts(prev => ({ ...prev, [methodId]: String((Number(prev[methodId]) || 0) + remaining) }))
  }

  const handleConfirm = () => {
    if (!canConfirm) return
    const payments = buildPayments(amounts)
    const paymentMethod = payments.length === 1 ? payments[0].method : 'Mixto'
    onConfirm({
      paymentMethod,   // canonical single-field: label string or 'Mixto'
      payments,        // full split array for DB
      discount: 0,
      tip: 0,
      total,
    })
  }

  return (
    <div className="paym-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="paym-modal">

        {/* ── Header ── */}
        <div className="paym-header">
          <span className="paym-title">Cobrar pedido <span className="paym-num">#{order.num}</span></span>
          <button className="paym-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* ── Body ── */}
        <div className="paym-body">

          {/* 1. Total destacado */}
          <div className="paym-total-block">
            <span className="paym-total-label">Total a cobrar</span>
            <span className="paym-total-amount">{fmt(total)}</span>
          </div>

          {/* 2. Per-method input rows */}
          <div className="paym-split-list">
            {METHODS.map(m => {
              const val = amounts[m.id]
              const num = Number(val) || 0
              return (
                <div key={m.id} className="paym-split-row">
                  <span className="paym-split-emoji">{m.emoji}</span>
                  <span className="paym-split-label">{m.label}</span>
                  <div className="paym-cash-input-wrap" style={{ flex: 1 }}>
                    <span className="paym-cash-prefix">$</span>
                    <input
                      className="paym-cash-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={val}
                      onChange={e => setAmount(m.id, e.target.value)}
                    />
                  </div>
                  {remaining > 0 && num === 0 && (
                    <button
                      className="paym-fill-btn"
                      type="button"
                      title="Completar con el restante"
                      onClick={() => fillRemaining(m.id)}
                    >
                      +{fmt(remaining)}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* 3. Status bar */}
          <div className={`paym-status-bar ${canConfirm ? 'paym-status-bar--ok' : remaining > 0 ? '' : 'paym-status-bar--excess'}`}>
            {remaining > 0 ? (
              <span>Faltan <strong>{fmt(remaining)}</strong> por asignar</span>
            ) : change !== null && change > 0 ? (
              <span>Vuelto en efectivo: <strong>{fmt(change)}</strong></span>
            ) : (
              <span>✓ Monto cubierto</span>
            )}
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="paym-footer">
          <button
            className="paym-confirm-btn"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Confirmar pago
          </button>
        </div>

      </div>
    </div>
  )
}
