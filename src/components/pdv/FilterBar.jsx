import { useState } from 'react'
import FilterDrawer, { INIT_ADV_FILTERS, countAdvFilters } from './FilterDrawer'
import './FilterBar.css'
import './FilterDrawer.css'

const FILTERS = [
  { id: 'all',    label: 'Todo'                          },
  { id: 'pend',   label: 'Pendiente', color: 'orange'   },
  { id: 'curso',  label: 'En curso',  color: 'green'    },
  { id: 'pdvweb', label: 'PDV / WEB'                    },
]

const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`

export default function FilterBar({ active, counts, total, onSelect, advFilters, onAdvFilter }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const advCount  = countAdvFilters(advFilters)
  const hasActive = advCount > 0

  return (
    <>
      <div className="filter-bar">
        {/* Advanced filter trigger */}
        <button
          className={`filter-adv-btn${hasActive ? ' filter-adv-btn--active' : ''}`}
          onClick={() => setDrawerOpen(true)}
          title="Filtros avanzados"
        >
          ⚙ Filtros
          {hasActive && (
            <span className="filter-adv-badge">{advCount}</span>
          )}
        </button>

        <div className="filter-pills">
          {FILTERS.map(({ id, label, color }) => {
            const count    = counts[id] ?? 0
            const isActive = active === id
            return (
              <button
                key={id}
                className={`filter-pill ${isActive ? 'active' : ''} ${color ? `filter-pill--${color}` : ''}`}
                onClick={() => onSelect(id)}
              >
                {id === 'all' && isActive && <span className="filter-pill-check">✓</span>}
                <span>{label}</span>
                {id !== 'all' && count > 0 && (
                  <span className={`filter-count filter-count--${color ?? 'default'}`}>{count}</span>
                )}
                {id === 'pdvweb' && <span className="filter-dot filter-dot--green" />}
              </button>
            )
          })}
        </div>

        <span className="filter-total">Total: {fmt(total)}</span>
      </div>

      <FilterDrawer
        open={drawerOpen}
        activeFilters={advFilters}
        onApply={onAdvFilter}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  )
}
