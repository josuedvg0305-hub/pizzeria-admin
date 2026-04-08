import { useState, useEffect } from 'react'
import './FilterDrawer.css'

const ORIGIN_OPTIONS = [
  { value: 'PDV', label: 'PDV' },
  { value: 'WEB', label: 'WEB' },
]

const TYPE_OPTIONS = [
  { value: 'local',    label: 'En el local'  },
  { value: 'llevar',   label: 'Para llevar'  },
  { value: 'delivery', label: 'Delivery'     },
  { value: 'mesa',     label: 'Mesa'         },
  { value: 'flash',    label: 'Pedido Flash' },
]

const STATUS_OPTIONS = [
  { value: 'pend',        label: 'Pendiente'      },
  { value: 'preparacion', label: 'En preparación' },
  { value: 'listo',       label: 'Listo'          },
  { value: 'finalizado',  label: 'Finalizado'     },
  { value: 'cancelado',   label: 'Cancelado'      },
]

const PAID_OPTIONS = [
  { value: 'unpaid', label: 'No pagado' },
  { value: 'paid',   label: 'Pagado'   },
]

const SCHED_OPTIONS = [
  { value: 'immediate', label: 'Inmediato'  },
  { value: 'scheduled', label: 'Programado' },
]

export const INIT_ADV_FILTERS = {
  origins:   [],
  types:     [],
  statuses:  [],
  paid:      [],
  scheduled: [],
}

export function countAdvFilters(f) {
  return f.origins.length + f.types.length + f.statuses.length + f.paid.length + f.scheduled.length
}

function CheckGroup({ label, options, values, onChange }) {
  const toggle = (val) => {
    const next = values.includes(val)
      ? values.filter(v => v !== val)
      : [...values, val]
    onChange(next)
  }
  return (
    <div className="fdr-group">
      <div className="fdr-group-label">{label}</div>
      <div className="fdr-checks">
        {options.map(opt => (
          <label key={opt.value} className="fdr-check-label">
            <input
              type="checkbox"
              checked={values.includes(opt.value)}
              onChange={() => toggle(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export default function FilterDrawer({ open, activeFilters, onApply, onClose }) {
  const [draft, setDraft] = useState(activeFilters)

  useEffect(() => {
    if (open) setDraft(activeFilters)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Escape to close */
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  const update = (key, val) => setDraft(d => ({ ...d, [key]: val }))

  const handleClear = () => {
    setDraft(INIT_ADV_FILTERS)
    onApply(INIT_ADV_FILTERS)
    onClose()
  }

  const handleApply = () => {
    onApply(draft)
    onClose()
  }

  return (
    <>
      <div
        className={`fdr-backdrop${open ? ' fdr-backdrop--open' : ''}`}
        onClick={onClose}
      />
      <div className={`fdr-drawer${open ? ' fdr-drawer--open' : ''}`}>
        <div className="fdr-header">
          <span className="fdr-title">Filtros avanzados</span>
          <button className="fdr-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="fdr-body">
          <CheckGroup
            label="Origen del pedido"
            options={ORIGIN_OPTIONS}
            values={draft.origins}
            onChange={v => update('origins', v)}
          />
          <CheckGroup
            label="Tipo de servicio"
            options={TYPE_OPTIONS}
            values={draft.types}
            onChange={v => update('types', v)}
          />
          <CheckGroup
            label="Estado del pedido"
            options={STATUS_OPTIONS}
            values={draft.statuses}
            onChange={v => update('statuses', v)}
          />
          <CheckGroup
            label="Estado de pago"
            options={PAID_OPTIONS}
            values={draft.paid}
            onChange={v => update('paid', v)}
          />
          <CheckGroup
            label="Fecha de entrega"
            options={SCHED_OPTIONS}
            values={draft.scheduled}
            onChange={v => update('scheduled', v)}
          />
        </div>

        <div className="fdr-footer">
          <button className="fdr-btn fdr-btn--clear" onClick={handleClear}>
            Limpiar filtros
          </button>
          <button className="fdr-btn fdr-btn--apply" onClick={handleApply}>
            Filtrar ahora
          </button>
        </div>
      </div>
    </>
  )
}
