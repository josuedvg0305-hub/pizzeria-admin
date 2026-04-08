import { useEffect } from 'react'
import './OrderTypeModal.css'

const ORDER_TYPES = [
  {
    type:     'flash',
    icon:     '⚡',
    label:    'Pedido Flash',
    sub:      'Rápido sin detalles',
    badge:    'Nuevo',
    gridSpan: 2,
    variant:  'flash',
  },
  { type: 'local',    icon: '🏪', label: 'En el local',  sub: 'Mostrador'       },
  { type: 'llevar',   icon: '🛍️', label: 'Para llevar',  sub: 'Mostrador'       },
  { type: 'delivery', icon: '🛵', label: 'Delivery',      sub: 'A domicilio'     },
  { type: 'mesa',     icon: '🪑', label: 'Mesa',          sub: 'Servicio en mesa' },
]

export default function OrderTypeModal({ onSelect, onClose }) {
  /* Escape to close */
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="otm-overlay" onClick={handleOverlayClick}>
      <div className="otm-modal">
        {/* ── Header ── */}
        <div className="otm-header">
          <div className="otm-header-text">
            <span className="otm-title">Nuevo pedido</span>
            <span className="otm-title-sep">—</span>
            <span className="otm-title-sub">¿Cómo es?</span>
          </div>
          <button className="otm-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {/* ── Grid ── */}
        <div className="otm-grid">
          {ORDER_TYPES.map(({ type, icon, label, sub, badge, gridSpan, variant }) => (
            <button
              key={type}
              className={[
                'otm-card',
                gridSpan === 2   ? 'otm-card--span2'  : '',
                variant === 'flash' ? 'otm-card--flash' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelect(type)}
            >
              <span className="otm-card-icon">{icon}</span>
              <div className="otm-card-body">
                <span className="otm-card-label">{label}</span>
                <span className="otm-card-sub">{sub}</span>
              </div>
              {badge && <span className="otm-card-badge">{badge}</span>}
              <span className="otm-card-arrow">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
