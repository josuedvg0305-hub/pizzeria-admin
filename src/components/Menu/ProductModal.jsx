import { useState, useRef, useMemo } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, rectSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Modal from '../shared/Modal'
import { useMenu } from '../../context/MenuContext'
import { generateId } from '../../data/menuData'
import './ProductModal.css'

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

function SortableModItem({ g, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: g.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:  isDragging ? 0.5 : 1,
    zIndex:   isDragging ? 10 : 'auto',
    position: 'relative',
  }
  return (
    <div ref={setNodeRef} style={style} className="pm-mod-sortable-item">
      <button className="drag-handle pm-mod-drag" {...attributes} {...listeners} tabIndex={-1} type="button">
        <DotGrid />
      </button>
      <div className="pm-mod-info">
        <span className="pm-mod-name">{g.name}</span>
        <span className="pm-mod-meta">
          {g.required ? 'Obligatorio' : 'Opcional'} ·
          {g.multiple ? ' Múltiple' : ' Una opción'} ·
          {' '}{g.options.length} opciones
        </span>
      </div>
      <button type="button" className="pm-mod-remove-btn" onClick={onRemove} title="Quitar">✕</button>
    </div>
  )
}

function SortableGallerySlot({ item, isPrincipal, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:  isDragging ? 0.5 : 1,
    zIndex:   isDragging ? 10 : 'auto',
    position: 'relative',
  }
  return (
    <div ref={setNodeRef} style={style} className="pm-gallery-slot">
      <div className="pm-gallery-drag-area" {...attributes} {...listeners}>
        <img src={item.src} alt="" className="pm-gallery-img" />
        {isPrincipal && <span className="pm-gallery-badge">Principal</span>}
      </div>
      <button
        type="button"
        className="pm-gallery-rm"
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onRemove(item.id)}
        title="Eliminar foto"
      >×</button>
    </div>
  )
}

const TABS = [
  { id: 'general',  label: '📝 General'        },
  { id: 'precio',   label: '💰 Precios'         },
  { id: 'stock',    label: '📦 Stock'           },
  { id: 'mods',     label: '🔧 Modificadores'   },
]

const emptyVariant = () => ({ id: generateId(), name: '', price: '', promoPrice: '' })

function initForm(product) {
  if (!product) {
    return {
      name: '', description: '', active: true,
      priceType: 'simple', price: '', promoPrice: '', cost: '',
      variants: [emptyVariant()],
      modifierGroupIds: [],
      stock: { enabled: false, quantity: 0, alertAt: 5 },
    }
  }
  return {
    ...product,
    price:      String(product.price || ''),
    promoPrice: product.promoPrice !== null ? String(product.promoPrice) : '',
    cost:       product.cost !== null ? String(product.cost) : '',
    variants:   product.variants.map(v => ({
      ...v,
      price:      String(v.price),
      promoPrice: v.promoPrice !== null ? String(v.promoPrice) : '',
    })),
  }
}

/* Build stable-ID gallery items from a product (handles old single-image data) */
function initGallery(product) {
  const srcs = product?.images?.length > 0
    ? product.images
    : product?.image ? [product.image] : []
  return srcs.map((src, i) => ({ id: `gi-${i}-${Date.now()}`, src }))
}

function discount(orig, promo) {
  const o = Number(orig); const p = Number(promo)
  if (!o || !p) return null
  return Math.round((1 - p / o) * 100)
}

export default function ProductModal({ product, categoryId, onClose }) {
  const { addProduct, updateProduct, modifierGroups } = useMenu()
  const isEdit     = !!product
  const [tab, setTab] = useState('general')
  const [form, setForm] = useState(() => initForm(product))
  const galleryInputRef = useRef(null)
  const [gallery, setGallery] = useState(() => initGallery(product))

  const set  = (k, v)  => setForm(prev => ({ ...prev, [k]: v }))
  const setS = (k, v)  => set('stock', { ...form.stock, [k]: v })

  const gallerySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleAddImage = (e) => {
    const file = e.target.files[0]
    if (!file || gallery.length >= 3) return
    const reader = new FileReader()
    reader.onload = (ev) => setGallery(prev => [
      ...prev, { id: `gi-${Date.now()}`, src: ev.target.result },
    ])
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeImage = (id) => setGallery(prev => prev.filter(g => g.id !== id))

  const handleGalleryDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setGallery(prev => {
      const oi = prev.findIndex(g => g.id === active.id)
      const ni = prev.findIndex(g => g.id === over.id)
      return arrayMove(prev, oi, ni)
    })
  }

  const addVariant    = () => set('variants', [...form.variants, emptyVariant()])
  const removeVariant = (id) => { if (form.variants.length > 1) set('variants', form.variants.filter(v => v.id !== id)) }
  const updVariant    = (id, k, v) => set('variants', form.variants.map(vr => vr.id === id ? { ...vr, [k]: v } : vr))

  const modSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const assignedGroups = useMemo(
    () => form.modifierGroupIds.map(id => modifierGroups.find(g => g.id === id)).filter(Boolean),
    [form.modifierGroupIds, modifierGroups]
  )
  const unassignedGroups = useMemo(
    () => modifierGroups.filter(g => !form.modifierGroupIds.includes(g.id)),
    [form.modifierGroupIds, modifierGroups]
  )

  const toggleMod = (id) => {
    const ids = form.modifierGroupIds.includes(id)
      ? form.modifierGroupIds.filter(x => x !== id)
      : [...form.modifierGroupIds, id]
    set('modifierGroupIds', ids)
  }

  const handleReorderMods = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oi = form.modifierGroupIds.indexOf(active.id)
    const ni = form.modifierGroupIds.indexOf(over.id)
    set('modifierGroupIds', arrayMove(form.modifierGroupIds, oi, ni))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return

    const data = {
      name:        form.name.trim(),
      description: form.description.trim(),
      active:      form.active,
      images:      gallery.map(g => g.src),
      priceType:   form.priceType,
      price:       form.priceType === 'simple' ? Number(form.price) || 0 : 0,
      promoPrice:  form.priceType === 'simple' && form.promoPrice !== ''
                     ? Number(form.promoPrice) : null,
      cost:        form.cost !== '' ? Number(form.cost) : null,
      variants:    form.priceType === 'variants'
                     ? form.variants.filter(v => v.name.trim()).map(v => ({
                         ...v, id: v.id ?? generateId(),
                         price:     Number(v.price)     || 0,
                         promoPrice: v.promoPrice !== '' ? Number(v.promoPrice) : null,
                       }))
                     : [],
      modifierGroupIds: form.modifierGroupIds,
      stock: {
        ...form.stock,
        quantity: Number(form.stock.quantity) || 0,
        alertAt:  Number(form.stock.alertAt)  || 5,
      },
    }

    isEdit ? updateProduct(categoryId, product.id, data) : addProduct(categoryId, data)
    onClose()
  }

  /* margin helpers */
  const basePrice = form.priceType === 'simple'
    ? Number(form.price) || 0
    : (form.variants[0] ? Number(form.variants[0].price) || 0 : 0)
  const cost   = Number(form.cost) || 0
  const margin = basePrice > 0 ? Math.round(((basePrice - cost) / basePrice) * 100) : 0
  const profit = basePrice - cost
  const marginColor = margin >= 50 ? 'var(--success)' : margin >= 30 ? 'var(--warning)' : 'var(--danger)'

  return (
    <Modal
      title={isEdit ? `Editar: ${product.name}` : 'Nuevo producto'}
      onClose={onClose}
      size="xl"
    >
      {/* ── Tabs ── */}
      <div className="pm-tabs">
        {TABS.map(t => (
          <button
            key={t.id} type="button"
            className={`pm-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>

        {/* ───────── TAB: GENERAL ───────── */}
        {tab === 'general' && (
          <div className="pm-section">
            {/* ── Image gallery (up to 3 photos) ── */}
            <div className="pm-gallery">
              <DndContext
                sensors={gallerySensors}
                collisionDetection={closestCenter}
                onDragEnd={handleGalleryDragEnd}
              >
                <SortableContext items={gallery.map(g => g.id)} strategy={rectSortingStrategy}>
                  {gallery.map((item, i) => (
                    <SortableGallerySlot
                      key={item.id}
                      item={item}
                      isPrincipal={i === 0}
                      onRemove={removeImage}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {gallery.length < 3 && (
                <div className="pm-gallery-add" onClick={() => galleryInputRef.current?.click()}>
                  <span>📷</span>
                  <span>Agregar</span>
                </div>
              )}
            </div>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleAddImage}
            />

            <div className="form-row" style={{ marginTop: 16 }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Nombre <span className="req">*</span></label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Nombre del producto"
                  autoFocus required
                />
              </div>
              <div className="form-group pm-active-group">
                <label className="form-label">Estado</label>
                <div className="pm-toggle-row">
                  <label className="toggle">
                    <input type="checkbox" checked={form.active}
                      onChange={e => set('active', e.target.checked)} />
                    <span className="toggle-track" />
                  </label>
                  <span className="pm-toggle-text">{form.active ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descripción</label>
              <textarea
                className="form-textarea"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Ingredientes o descripción del producto"
              />
            </div>
          </div>
        )}

        {/* ───────── TAB: PRECIOS ───────── */}
        {tab === 'precio' && (
          <div className="pm-section">
            <div className="pm-price-type-row">
              {[['simple', 'Precio único'], ['variants', 'Con variantes / tallas']].map(([val, label]) => (
                <button
                  key={val} type="button"
                  className={`pm-price-type-btn ${form.priceType === val ? 'active' : ''}`}
                  onClick={() => set('priceType', val)}
                >
                  {label}
                </button>
              ))}
            </div>

            {form.priceType === 'simple' && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Precio normal</label>
                  <div className="pm-price-wrap">
                    <span className="pm-price-pfx">$</span>
                    <input className="form-input pm-price-inp" type="number" min="0"
                      value={form.price} onChange={e => set('price', e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Precio promocional</label>
                  <div className="pm-price-wrap">
                    <span className="pm-price-pfx">$</span>
                    <input className="form-input pm-price-inp" type="number" min="0"
                      value={form.promoPrice} onChange={e => set('promoPrice', e.target.value)}
                      placeholder="Sin promo" />
                  </div>
                  {form.promoPrice && form.price && (
                    <div className="pm-promo-preview">
                      <span className="price-orig">${Number(form.price).toLocaleString('es-CL')}</span>
                      <span className="price-promo">${Number(form.promoPrice).toLocaleString('es-CL')}</span>
                      <span className="price-disc">-{discount(form.price, form.promoPrice)}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {form.priceType === 'variants' && (
              <div className="pm-variants-section">
                <div className="pm-variants-head">
                  <span className="pm-variants-title">Variantes</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addVariant}>+ Variante</button>
                </div>
                <div className="pm-variants-legend">
                  <span style={{flex:2}}>Nombre</span>
                  <span style={{width:120}}>Precio normal</span>
                  <span style={{width:120}}>Precio promo</span>
                  <span style={{width:60}}>Desc.</span>
                  <span style={{width:28}}></span>
                </div>
                {form.variants.map((v, i) => {
                  const disc = discount(v.price, v.promoPrice)
                  return (
                    <div key={v.id} className="pm-variant-row">
                      <span className="pm-variant-num">{i + 1}</span>
                      <input className="form-input" style={{flex:2}} placeholder="Nombre (ej: Familiar)"
                        value={v.name} onChange={e => updVariant(v.id, 'name', e.target.value)} />
                      <div className="pm-price-wrap" style={{width:120}}>
                        <span className="pm-price-pfx">$</span>
                        <input className="form-input pm-price-inp" type="number" min="0" placeholder="0"
                          value={v.price} onChange={e => updVariant(v.id, 'price', e.target.value)} />
                      </div>
                      <div className="pm-price-wrap" style={{width:120}}>
                        <span className="pm-price-pfx">$</span>
                        <input className="form-input pm-price-inp" type="number" min="0" placeholder="—"
                          value={v.promoPrice} onChange={e => updVariant(v.id, 'promoPrice', e.target.value)} />
                      </div>
                      <span className="pm-variant-disc" style={{width:60}}>
                        {disc !== null && <span className="price-disc">-{disc}%</span>}
                      </span>
                      <button type="button" className="pm-variant-rm" onClick={() => removeVariant(v.id)}
                        disabled={form.variants.length === 1}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Cost / Margin */}
            <div className="pm-cost-block">
              <div className="pm-cost-title">Costo y margen</div>
              <div className="form-row" style={{ alignItems: 'flex-end' }}>
                <div className="form-group" style={{ maxWidth: 180 }}>
                  <label className="form-label">Costo de producción</label>
                  <div className="pm-price-wrap">
                    <span className="pm-price-pfx">$</span>
                    <input className="form-input pm-price-inp" type="number" min="0" placeholder="0"
                      value={form.cost} onChange={e => set('cost', e.target.value)} />
                  </div>
                </div>
                <div className="pm-margin-cards">
                  <div className="pm-margin-card">
                    <span className="pm-mc-label">Margen</span>
                    <span className="pm-mc-value" style={{ color: marginColor }}>{margin}%</span>
                  </div>
                  <div className="pm-margin-card">
                    <span className="pm-mc-label">Ganancia</span>
                    <span className="pm-mc-value">${profit.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="pm-margin-card">
                    <span className="pm-mc-label">Precio base</span>
                    <span className="pm-mc-value">${basePrice.toLocaleString('es-CL')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ───────── TAB: STOCK ───────── */}
        {tab === 'stock' && (
          <div className="pm-section">
            <div className="pm-stock-toggle-row">
              <label className="toggle">
                <input type="checkbox" checked={form.stock.enabled}
                  onChange={e => setS('enabled', e.target.checked)} />
                <span className="toggle-track" />
              </label>
              <div>
                <p className="pm-stock-label">Control de stock activo</p>
                <p className="pm-stock-desc">Gestiona la cantidad disponible de este producto</p>
              </div>
            </div>

            {form.stock.enabled && (
              <>
                <div className="form-row" style={{ marginTop: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Cantidad disponible</label>
                    <input className="form-input" type="number" min="0"
                      value={form.stock.quantity}
                      onChange={e => setS('quantity', Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alerta cuando baje de</label>
                    <input className="form-input" type="number" min="1"
                      value={form.stock.alertAt}
                      onChange={e => setS('alertAt', Number(e.target.value))} />
                  </div>
                </div>
                <div className="pm-stock-preview">
                  <span>Vista previa del badge:</span>
                  <StockBadgePreview stock={form.stock} />
                </div>
              </>
            )}
          </div>
        )}

        {/* ───────── TAB: MODIFICADORES ───────── */}
        {tab === 'mods' && (
          <div className="pm-section">
            {modifierGroups.length === 0 ? (
              <p className="pm-mods-empty">
                No hay grupos de modificadores. Créalos desde la pestaña <strong>Modificadores</strong>.
              </p>
            ) : (
              <>
                {/* Assigned — sortable */}
                {assignedGroups.length > 0 && (
                  <div className="pm-mods-block">
                    <p className="pm-mods-subtitle">
                      Grupos asignados
                      <span className="pm-mods-hint">Arrastra para reordenar</span>
                    </p>
                    <DndContext sensors={modSensors} collisionDetection={closestCenter} onDragEnd={handleReorderMods}>
                      <SortableContext items={form.modifierGroupIds} strategy={verticalListSortingStrategy}>
                        <div className="pm-mod-sortable-list">
                          {assignedGroups.map(g => (
                            <SortableModItem key={g.id} g={g} onRemove={() => toggleMod(g.id)} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}

                {/* Unassigned — add */}
                {unassignedGroups.length > 0 && (
                  <div className={`pm-mods-block${assignedGroups.length > 0 ? ' pm-mods-block--add' : ''}`}>
                    {assignedGroups.length > 0 && (
                      <p className="pm-mods-subtitle pm-mods-subtitle--add">Agregar grupos</p>
                    )}
                    <div className="pm-mod-list">
                      {unassignedGroups.map(g => (
                        <div
                          key={g.id}
                          className="pm-mod-item pm-mod-item--add"
                          onClick={() => toggleMod(g.id)}
                        >
                          <span className="pm-mod-add-icon">+</span>
                          <div className="pm-mod-info">
                            <span className="pm-mod-name">{g.name}</span>
                            <span className="pm-mod-meta">
                              {g.required ? 'Obligatorio' : 'Opcional'} ·
                              {g.multiple ? ' Múltiple' : ' Una opción'} ·
                              {' '}{g.options.length} opciones
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {assignedGroups.length === 0 && unassignedGroups.length === 0 && null}
              </>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!form.name.trim()}>
            {isEdit ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function StockBadgePreview({ stock }) {
  if (stock.quantity === 0)
    return <span className="stock-badge stock-badge--out">Agotado</span>
  if (stock.quantity < stock.alertAt)
    return <span className="stock-badge stock-badge--low">Poco stock ({stock.quantity})</span>
  return <span className="stock-badge stock-badge--in">En stock ({stock.quantity})</span>
}
