import { useState } from 'react'
import './SalesFilterDrawer.css'

/* ── Filter shape & defaults ── */
export const INIT_SALES_FILTERS = {
  origins:   [],   // 'PDV' | 'Web'
  types:     [],   // 'local' | 'llevar' | 'flash' | 'delivery' | 'mesa'
  statuses:  [],   // 'pend' | 'preparacion' | 'listo' | 'finalizado' | 'cancelado'
  paid:      [],   // 'paid' | 'unpaid'
  payMethod: [],   // 'efectivo' | 'tarjeta' | 'transferencia'
}

export function countSalesFilters(f) {
  return (
    f.origins.length +
    f.types.length +
    f.statuses.length +
    f.paid.length +
    f.payMethod.length
  )
}

/* ── Category definitions ── */
const CATS = [
  {
    key: 'origins',
    label: 'Origen',
    options: [
      { value: 'PDV', label: 'PDV (mostrador)' },
      { value: 'Web', label: 'Web / App' },
    ],
  },
  {
    key: 'types',
    label: 'Tipo de servicio',
    options: [
      { value: 'local',    label: 'En el local' },
      { value: 'llevar',   label: 'Para llevar' },
      { value: 'flash',    label: 'Pedido Flash' },
      { value: 'delivery', label: 'Delivery' },
      { value: 'mesa',     label: 'Mesa' },
    ],
  },
  {
    key: 'statuses',
    label: 'Estatus de pedido',
    options: [
      { value: 'pend',        label: 'Pendiente' },
      { value: 'preparacion', label: 'En preparación' },
      { value: 'listo',       label: 'Listo' },
      { value: 'finalizado',  label: 'Finalizado' },
      { value: 'cancelado',   label: 'Cancelado' },
    ],
  },
  {
    key: 'paid',
    label: 'Estatus de pago',
    options: [
      { value: 'paid',   label: 'Pagado' },
      { value: 'unpaid', label: 'Sin pagar' },
    ],
  },
  {
    key: 'payMethod',
    label: 'Método de pago',
    options: [
      { value: 'Efectivo',      label: 'Efectivo' },
      { value: 'Tarjeta',       label: 'Tarjeta' },
      { value: 'Transferencia', label: 'Transferencia' },
      { value: 'Mixto',         label: 'Mixto (Split)' },
    ],
  },
]

export default function SalesFilterDrawer({ filters, onChange, onClose }) {
  const [activeCat, setActiveCat] = useState(CATS[0].key)

  const cat = CATS.find(c => c.key === activeCat)

  const toggle = (key, value) => {
    const cur = filters[key] ?? []
    const has = cur.includes(value)
    onChange({ ...filters, [key]: has ? cur.filter(v => v !== value) : [...cur, value] })
  }

  const clearAll = () => onChange(INIT_SALES_FILTERS)

  const total = countSalesFilters(filters)

  return (
    <div className="sfd-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sfd-drawer">

        {/* Header */}
        <div className="sfd-header">
          <span className="sfd-title">Filtros</span>
          <div className="sfd-header-actions">
            {total > 0 && (
              <button className="sfd-clear-btn" onClick={clearAll}>
                Limpiar ({total})
              </button>
            )}
            <button className="sfd-close-btn" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
        </div>

        {/* Two-panel body */}
        <div className="sfd-body">

          {/* Left: category tabs */}
          <div className="sfd-cats">
            {CATS.map(c => {
              const count = (filters[c.key] ?? []).length
              return (
                <button
                  key={c.key}
                  className={`sfd-cat-btn${activeCat === c.key ? ' sfd-cat-btn--active' : ''}`}
                  onClick={() => setActiveCat(c.key)}
                >
                  <span className="sfd-cat-label">{c.label}</span>
                  {count > 0 && <span className="sfd-cat-badge">{count}</span>}
                </button>
              )
            })}
          </div>

          {/* Right: checkboxes */}
          <div className="sfd-options">
            {cat?.options.map(opt => {
              const checked = (filters[cat.key] ?? []).includes(opt.value)
              return (
                <label key={opt.value} className="sfd-opt-row">
                  <input
                    type="checkbox"
                    className="sfd-checkbox"
                    checked={checked}
                    onChange={() => toggle(cat.key, opt.value)}
                  />
                  <span className="sfd-opt-label">{opt.label}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="sfd-footer">
          <button className="sfd-apply-btn" onClick={onClose}>
            Aplicar filtros{total > 0 ? ` (${total})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
