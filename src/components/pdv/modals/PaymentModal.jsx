import { useState, useEffect } from 'react'
import './PaymentModal.css'

const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`

const METHODS = [
  { id: 'efectivo',      label: 'Efectivo',       emoji: '💵' },
  { id: 'debito',        label: 'Débito',          emoji: '💳' },
  { id: 'transferencia', label: 'Transferencia',   emoji: '📱' },
]

export default function PaymentModal({ order, onConfirm, onClose }) {
  const [payMethod,     setPayMethod]     = useState('efectivo')
  const [cashReceived,  setCashReceived]  = useState('')

  /* Escape to close */
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const total    = order.total
  const cashAmt  = cashReceived === '' ? NaN : Number(cashReceived)
  const change   = isNaN(cashAmt) ? null : cashAmt - total

  const handleConfirm = () => {
    onConfirm({
      paymentMethod: METHODS.find(m => m.id === payMethod)?.label ?? payMethod,
      payMethod,
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

          {/* 2. Métodos de pago */}
          <div className="paym-methods">
            {METHODS.map(m => (
              <button
                key={m.id}
                className={`paym-method-btn${payMethod === m.id ? ' paym-method-btn--active' : ''}`}
                onClick={() => setPayMethod(m.id)}
              >
                <span className="paym-method-emoji">{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* 3. Sección efectivo */}
          {payMethod === 'efectivo' && (
            <div className="paym-cash-section">
              <label className="paym-field-label">Monto recibido</label>
              <div className="paym-cash-input-wrap">
                <span className="paym-cash-prefix">$</span>
                <input
                  className="paym-cash-input"
                  type="number"
                  min="0"
                  placeholder={String(total)}
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  autoFocus
                />
              </div>

              {change !== null && (
                <div className={`paym-change${change < 0 ? ' paym-change--insuf' : ''}`}>
                  {change < 0
                    ? 'Monto insuficiente'
                    : <>Vuelto: <strong>{fmt(change)}</strong></>
                  }
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="paym-footer">
          <button className="paym-confirm-btn" onClick={handleConfirm}>
            Confirmar pago
          </button>
        </div>

      </div>
    </div>
  )
}
