import { useState, useMemo } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMenu } from '../../context/MenuContext'
import { generateId } from '../../data/menuData'
import Modal from '../shared/Modal'
import './ModifiersPanel.css'

/* ── Shared SVGs ── */
function DotGrid() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
      <circle cx="2.5" cy="2.5"  r="1.5"/>
      <circle cx="7.5" cy="2.5"  r="1.5"/>
      <circle cx="2.5" cy="7"    r="1.5"/>
      <circle cx="7.5" cy="7"    r="1.5"/>
      <circle cx="2.5" cy="11.5" r="1.5"/>
      <circle cx="7.5" cy="11.5" r="1.5"/>
    </svg>
  )
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

/* ── Sortable option row (inside GroupModal) ── */
function SortableOption({ opt, i, updOpt, updOptVariantPrice, toggleOptActive, removeOpt, isOnly, variantNames }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: opt.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:  isDragging ? 0.5 : 1,
    zIndex:   isDragging ? 10 : 'auto',
    position: 'relative',
  }

  const hasVariants = variantNames.length > 0
  const isActive = opt.active !== false && opt.is_active !== false
  const [variantCollapsed, setVariantCollapsed] = useState(false)

  const switchToVariant = () => {
    const init = Object.fromEntries(variantNames.map(v => [v, opt.priceByVariant?.[v] ?? '']))
    updOpt(i, 'priceByVariant', init)
    setVariantCollapsed(false)   // always expand when activating
  }
  const switchToFixed = () => updOpt(i, 'priceByVariant', null)

  return (
    <div ref={setNodeRef} style={style} className="mod-option-row">

      {/* ── Dimmable zone: everything except eye + × ── */}
      <div className={`mod-opt-dimmable${!isActive ? ' mod-opt-dimmable--off' : ''}`}>

        {/* Main row */}
        <div className="mod-opt-main-row">
          <button className="drag-handle mod-opt-drag" {...attributes} {...listeners} tabIndex={-1}>
            <DotGrid />
          </button>
          <span className="mod-opt-num">{i + 1}</span>
          <input
            className="form-input"
            style={{ flex: 2, minWidth: 0 }}
            placeholder="Nombre de la opción"
            value={opt.name}
            onChange={e => updOpt(i, 'name', e.target.value)}
          />

          {/* Price inputs — only in fixed mode */}
          {!isByVariant && (
            <>
              <div className="pm-price-wrap" style={{ width: 110 }}>
                <span className="pm-price-pfx">$</span>
                <input
                  className="form-input pm-price-inp"
                  type="number" min="0" placeholder="0"
                  value={opt.price}
                  onChange={e => updOpt(i, 'price', e.target.value)}
                />
              </div>
              <div className="pm-price-wrap" style={{ width: 110 }}>
                <span className="pm-price-pfx">$</span>
                <input
                  className="form-input pm-price-inp"
                  type="number" min="0" placeholder="—"
                  value={opt.promoPrice}
                  onChange={e => updOpt(i, 'promoPrice', e.target.value)}
                />
              </div>
            </>
          )}

          {/* "Por tamaño" toggle — click to collapse/expand */}
          {isByVariant && (
            <button
              type="button"
              className="mod-opt-by-size-btn"
              onClick={() => setVariantCollapsed(c => !c)}
              title={variantCollapsed ? 'Expandir precios' : 'Colapsar precios'}
            >
              Por tamaño {variantCollapsed ? '▶' : '↓'}
            </button>
          )}

          {/* Price mode toggle */}
          {hasVariants && (
            <div className="mod-price-mode-toggle">
              <button
                type="button"
                className={!isByVariant ? 'active' : ''}
                onClick={switchToFixed}
                title="Precio fijo"
              >Fijo</button>
              <button
                type="button"
                className={isByVariant ? 'active' : ''}
                onClick={switchToVariant}
                title="Precio por tamaño"
              >Tamaño</button>
            </div>
          )}
        </div>

        {/* Variant price sub-row (collapsible) */}
        {isByVariant && (
          <div className={`mod-opt-variant-collapse${variantCollapsed ? '' : ' mod-opt-variant-collapse--open'}`}>
            <div className="mod-opt-variant-prices">
              {variantNames.map(vname => (
                <div key={vname} className="mod-opt-variant-row">
                  <span className="mod-opt-variant-lbl">{vname}</span>
                  <div className="pm-price-wrap" style={{ width: 100 }}>
                    <span className="pm-price-pfx">$</span>
                    <input
                      className="form-input pm-price-inp"
                      type="number" min="0" placeholder="0"
                      value={opt.priceByVariant[vname] ?? ''}
                      onChange={e => updOptVariantPrice(i, vname, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Always-visible: eye + × ── */}
      <div className="mod-opt-always">
        <button
          type="button"
          className={`mod-eye-btn${!isActive ? ' mod-eye-btn--off' : ''}`}
          onClick={() => toggleOptActive(i)}
          title={isActive ? 'Desactivar opción' : 'Activar opción'}
        >
          <EyeIcon open={isActive} />
        </button>
        <button
          type="button"
          className="pm-variant-rm"
          onClick={() => removeOpt(i)}
          disabled={isOnly}
        >✕</button>
      </div>

    </div>
  )
}

/* ── Group modal ── */
function GroupModal({ group, onClose }) {
  const { addModGroup, updateModGroup, categories, bulkUpdateModGroupAssignments } = useMenu()
  const isEdit = !!group

  /* Stable ID — pre-generated for new groups so we can bulk-assign before saving */
  const [stableGroupId] = useState(() => group?.id ?? generateId())

  /* Collect unique variant names from all products that use this group */
  const variantNames = useMemo(() => {
    const names = new Set()
    categories.forEach(cat =>
      (cat.products ?? []).forEach(p => {
        if ((p.modifierGroupIds ?? []).includes(stableGroupId))
          (p.variants ?? []).forEach(v => names.add(v.name))
      })
    )
    return [...names]
  }, [stableGroupId, categories])

  /* Modal tab */
  const [groupTab, setGroupTab] = useState('opciones')

  /* Opciones state */
  const [name,     setName]     = useState(group?.name ?? '')
  const [required, setRequired] = useState(group?.required ?? false)
  const [multiple, setMultiple] = useState(group?.multiple ?? true)
  const [min,      setMin]      = useState(String(group?.min ?? 0))
  const [max,      setMax]      = useState(group?.max !== null && group?.max !== undefined ? String(group.max) : '')
  const [options,  setOptions]  = useState(() => {
    if (!group || !Array.isArray(group.options) || group.options.length === 0) {
      return [{ id: generateId(), name: '', price: '', promoPrice: '', active: true, priceByVariant: null }]
    }
    return group.options.map(opt => ({
      ...opt,
      id: opt.id || crypto.randomUUID(),
      active: opt.active ?? opt.is_active ?? true
    }))
  })

  /* Productos state — initialize from current assignments */
  const [selectedProductIds, setSelectedProductIds] = useState(() => {
    if (!group) return []
    const ids = []
    categories.forEach(cat =>
      (cat.products ?? []).forEach(p => {
        if ((p.modifierGroupIds ?? []).includes(group.id)) ids.push(p.id)
      })
    )
    return ids
  })
  const [productSearch, setProductSearch] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const addOpt    = () => setOptions(prev => [...prev, { id: generateId(), name: '', price: '', promoPrice: '', active: true, priceByVariant: null }])
  const removeOpt = (index) => { if (options.length > 1) setOptions(prev => prev.filter((o, i) => i !== index)) }
  const updOpt    = (index, k, v) => setOptions(prev => prev.map((o, i) => i === index ? { ...o, [k]: v } : o))
  const updOptVariantPrice = (index, variantName, val) =>
    setOptions(prev => prev.map((o, i) =>
      i === index ? { ...o, priceByVariant: { ...o.priceByVariant, [variantName]: val } } : o
    ))
  const toggleOptActive = (index) => setOptions(prev => prev.map((o, i) => i === index ? { ...o, active: o.active === false ? true : false, is_active: o.is_active === false ? true : false } : o))

  const handleDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setOptions(prev => {
        const oi = prev.findIndex(o => o.id === active.id)
        const ni = prev.findIndex(o => o.id === over.id)
        return arrayMove(prev, oi, ni)
      })
    }
  }

  /* Product assignment helpers */
  const toggleProduct = (prodId) =>
    setSelectedProductIds(prev =>
      prev.includes(prodId) ? prev.filter(id => id !== prodId) : [...prev, prodId]
    )

  const q = productSearch.trim().toLowerCase()
  const visibleProductIds = useMemo(() => {
    const ids = []
    categories.forEach(cat =>
      (cat.products ?? []).forEach(p => {
        if (!q || p.name.toLowerCase().includes(q)) ids.push(p.id)
      })
    )
    return ids
  }, [categories, q])

  const selectAllVisible   = () => setSelectedProductIds(prev => [...new Set([...prev, ...visibleProductIds])])
  const deselectAllVisible = () => {
    const vis = new Set(visibleProductIds)
    setSelectedProductIds(prev => prev.filter(id => !vis.has(id)))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const data = {
      id: stableGroupId,
      name: name.trim(), required, multiple,
      min: Number(min) || 0,
      max: max !== '' ? Number(max) : null,
      options: options
        .filter(o => o.name.trim())
        .map(o => ({
          ...o,
          id:             o.id || crypto.randomUUID(),
          is_active:      o.is_active ?? true,
          active:         o.active !== false && o.is_active !== false,
          price:          o.priceByVariant ? null : (Number(o.price) || 0),
          promoPrice:     o.priceByVariant ? null : (o.promoPrice !== '' ? Number(o.promoPrice) : null),
          priceByVariant: o.priceByVariant
            ? Object.fromEntries(Object.entries(o.priceByVariant).map(([k, v]) => [k, Number(v) || 0]))
            : null,
        })),
    }
    isEdit ? updateModGroup(group.id, data) : addModGroup(data)
    bulkUpdateModGroupAssignments(stableGroupId, selectedProductIds)
    onClose()
  }

  return (
    <Modal title={isEdit ? (group?.name ? `Editar grupo: ${group.name}` : 'Editar grupo') : 'Nuevo grupo de modificadores'} onClose={onClose} size="md">
      {/* ── Modal tabs ── */}
      <div className="gm-tabs">
        <button
          type="button"
          className={`gm-tab${groupTab === 'opciones' ? ' active' : ''}`}
          onClick={() => setGroupTab('opciones')}
        >
          Opciones
        </button>
        <button
          type="button"
          className={`gm-tab${groupTab === 'productos' ? ' active' : ''}`}
          onClick={() => setGroupTab('productos')}
        >
          Productos
          {selectedProductIds.length > 0 && (
            <span className="gm-tab-badge">{selectedProductIds.length}</span>
          )}
        </button>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── Opciones tab ── */}
        {groupTab === 'opciones' && (
          <>
            <div className="form-group">
              <label className="form-label">Nombre del grupo <span className="req">*</span></label>
              <input
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Ingredientes extra, Tipo de borde…"
                autoFocus
              />
            </div>

            <div className="mod-settings-row">
              <label className="mod-check-label">
                <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
                <span>Obligatorio</span>
              </label>
              <label className="mod-check-label">
                <input type="checkbox" checked={multiple} onChange={e => setMultiple(e.target.checked)} />
                <span>Permite múltiples</span>
              </label>
              <div className="mod-minmax">
                <span>Min</span>
                <input className="form-input mod-num-input" type="number" min="0"
                  value={min} onChange={e => setMin(e.target.value)} />
                <span>Máx</span>
                <input className="form-input mod-num-input" type="number" min="0"
                  value={max} onChange={e => setMax(e.target.value)} placeholder="∞" />
              </div>
            </div>

            <div className="mod-options-section">
              <div className="mod-options-head">
                <span className="mod-options-title">Opciones</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addOpt}>+ Opción</button>
              </div>
              <div className="mod-options-legend">
                <span style={{ width: 24 }}></span>
                <span style={{ width: 16 }}></span>
                <span style={{ flex: 2 }}>Nombre</span>
                <span style={{ width: 110 }}>Precio extra</span>
                <span style={{ width: 110 }}>Precio promo</span>
                {variantNames.length > 0 && <span style={{ width: 90 }}>Precio por</span>}
                <span style={{ width: 28 }}></span>
                <span style={{ width: 28 }}></span>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={options.map(o => o.id)} strategy={verticalListSortingStrategy}>
                  {options.map((opt, i) => (
                    <SortableOption
                      key={opt.id}
                      opt={opt}
                      i={i}
                      updOpt={updOpt}
                      updOptVariantPrice={updOptVariantPrice}
                      toggleOptActive={toggleOptActive}
                      removeOpt={removeOpt}
                      isOnly={options.length === 1}
                      variantNames={variantNames}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </>
        )}

        {/* ── Productos tab ── */}
        {groupTab === 'productos' && (
          <div>
            <div className="gm-prod-toolbar">
              <input
                className="form-input gm-prod-search"
                placeholder="🔍 Buscar producto..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllVisible}>Sel. todo</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={deselectAllVisible}>Desel.</button>
            </div>
            <p className="gm-prod-count">
              {selectedProductIds.length} producto{selectedProductIds.length !== 1 ? 's' : ''} seleccionado{selectedProductIds.length !== 1 ? 's' : ''}
            </p>
            <div className="gm-prod-list">
              {categories.map(cat => {
                const prods = (cat.products ?? []).filter(
                  p => !q || p.name.toLowerCase().includes(q)
                )
                if (prods.length === 0) return null
                return (
                  <div key={cat.id}>
                    <div className="gm-prod-cat-name">{cat.name}</div>
                    {prods.map(p => (
                      <label key={p.id} className="gm-prod-item">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={() => toggleProduct(p.id)}
                        />
                        <span className="gm-prod-name">{p.name}</span>
                      </label>
                    ))}
                  </div>
                )
              })}
              {visibleProductIds.length === 0 && (
                <p className="gm-prod-empty">Sin resultados para "{productSearch}"</p>
              )}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            {isEdit ? 'Guardar' : 'Crear grupo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Sortable group card ── */
function SortableGroupCard({ g, expanded, onToggle, onEdit, onDelete, onToggleActive }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: String(g.id) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 200ms ease',
    opacity:  isDragging ? 0.45 : 1,
    zIndex:   isDragging ? 500 : 'auto',
    position: 'relative',
  }

  const isActive = g.is_active !== false;

  return (
    <div ref={setNodeRef} style={style} className={`mod-group-card ${!isActive ? 'mod-group-card--off' : ''}`}>
      <div className="mod-group-card-header">
        <button className="drag-handle mod-group-drag" {...attributes} {...listeners} tabIndex={-1}>
          <DotGrid />
        </button>
        <div className="mod-group-card-info">
          <span className="mod-group-card-name">{g.name}</span>
          <div className="mod-group-card-meta">
            <span className={`mod-tag ${g.required ? 'mod-tag--req' : 'mod-tag--opt'}`}>
              {g.required ? 'Obligatorio' : 'Opcional'}
            </span>
            <span className="mod-tag">
              {g.multiple ? 'Múltiple' : 'Una opción'}
            </span>
            {(g.min > 0 || g.max !== null) && (
              <span className="mod-tag">
                Min {g.min}{g.max !== null ? ` / Máx ${g.max}` : ''}
              </span>
            )}
            <span className="mod-tag">{g.options.length} opciones</span>
          </div>
        </div>
        <div className="mod-group-card-actions">
          <label className="toggle" title={isActive ? 'Desactivar' : 'Activar'} onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={onToggleActive}
            />
            <span className="toggle-track" />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>Editar</button>
          <button className="btn btn-sm mod-del-btn" onClick={onDelete}>Eliminar</button>
          <button
            className="btn btn-icon btn-ghost mod-collapse-btn"
            onClick={onToggle}
            title={expanded ? 'Colapsar' : 'Expandir'}
          >
            {expanded ? '▴' : '▾'}
          </button>
        </div>
      </div>

      <div className={`mod-options-collapse${expanded ? ' mod-options-collapse--open' : ''}`}>
        <div className="mod-options-list">
          {g.options.map(opt => {
            const isChipActive = opt.active !== false && opt.is_active !== false;
            return (
              <div key={opt.id} className={`mod-opt-chip${!isChipActive ? ' mod-opt-chip--off' : ''}`}>
                <span className="mod-opt-chip-name">{opt.name}</span>
                {opt.priceByVariant ? (
                  <span className="mod-opt-price mod-opt-price--varies">Varía según tamaño</span>
                ) : opt.promoPrice ? (
                  <>
                    <span className="mod-opt-orig">+${opt.price.toLocaleString('es-CL')}</span>
                    <span className="mod-opt-promo">+${opt.promoPrice.toLocaleString('es-CL')}</span>
                  </>
                ) : (
                  <span className="mod-opt-price">
                    {opt.price > 0 ? `+$${opt.price.toLocaleString('es-CL')}` : 'Gratis'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Main panel ── */
export default function ModifiersPanel() {
  const { modifierGroups, deleteModGroup, reorderModGroups, handleToggleModGroup } = useMenu()
  const [showModal,    setShowModal]   = useState(false)
  const [editing,      setEditing]     = useState(null)
  const [search,       setSearch]      = useState('')
  const [expandedIds,  setExpandedIds] = useState(new Set())

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const openNew  = () => { setEditing(null); setShowModal(true) }
  const openEdit = (g) => { setEditing(g); setShowModal(true) }
  const handleDelete = (g) => {
    if (window.confirm(`¿Eliminar el grupo "${g.name}"? Se desvinculará de todos los productos.`))
      deleteModGroup(g.id)
  }

  const toggleExpanded = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) reorderModGroups(active.id, over.id)
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? modifierGroups.filter(g => g.name.toLowerCase().includes(q))
    : modifierGroups

  return (
    <div className="mods-panel">
      <div className="mods-panel-header">
        <div>
          <h2 className="mods-panel-title">Grupos de modificadores</h2>
          <p className="mods-panel-sub">Crea grupos reutilizables y asígnalos a los productos</p>
        </div>
        <div className="mods-panel-controls">
          <input
            className="form-input mods-search"
            placeholder="🔍 Buscar modificador..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo grupo</button>
        </div>
      </div>

      {modifierGroups.length === 0 ? (
        <div className="mp-empty">
          <span>🔧</span>
          <p>No hay grupos de modificadores.</p>
          <button className="btn btn-primary" onClick={openNew}>Crear primer grupo</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mods-no-results">Sin resultados para "{search}"</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map(g => String(g.id))} strategy={verticalListSortingStrategy}>
            <div className="mod-group-cards">
              {filtered.map(g => (
                <SortableGroupCard
                  key={g.id}
                  g={g}
                  expanded={expandedIds.has(g.id)}
                  onToggle={() => toggleExpanded(g.id)}
                  onEdit={() => openEdit(g)}
                  onDelete={() => handleDelete(g)}
                  onToggleActive={() => handleToggleModGroup(g.id, g.is_active !== false)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showModal && (
        <GroupModal
          group={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
