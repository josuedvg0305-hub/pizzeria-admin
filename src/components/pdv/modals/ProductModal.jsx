import { useState, useEffect, useMemo } from 'react'
import './ProductModal.css'

const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`

const FALLBACK_EMOJI = {
  101: '🧄', 102: '🌿', 103: '🍗', 104: '🧀',
  201: '🍕', 202: '🍕', 203: '🍖', 204: '🥦',
  205: '🌿', 206: '🍅', 301: '🥩', 302: '🍖',
  303: '🥓', 304: '🌶️', 305: '🍍', 306: '🧀',
  401: '🥤', 402: '🥤', 403: '🍵', 404: '💧', 405: '🧃',
}

/* Resolve the effective price of an option given the active variant name */
function getPriceForVariant(opt, variantName) {
  if (opt.priceByVariant && variantName) {
    return opt.priceByVariant[variantName] ?? opt.price ?? 0
  }
  return opt.price ?? 0
}

export default function ProductModal({ product, modifierGroups, onAdd, onClose, editingItem }) {
  const vars = product.variants ?? []

  /* Resolve modifier groups from IDs */
  const mods = useMemo(
    () =>
      (product.modifierGroupIds ?? [])
        .map(id => (modifierGroups ?? []).find(mg => mg.id === id))
        .filter(Boolean),
    [product, modifierGroups]
  )

  const isEditing = !!editingItem

  const [qty,             setQty]             = useState(editingItem?.qty ?? 1)
  const [note,            setNote]            = useState(editingItem?.note ?? '')
  const [selectedVariant, setSelectedVariant] = useState(() => {
    if (editingItem?.variantIdx !== undefined && editingItem.variantIdx !== null)
      return editingItem.variantIdx
    return vars.length > 0 ? 0 : null
  })
  /* radio    → { [modIdx]: { name, price } }
     checkbox → { [modIdx]: [{ name, price }, ...] } */
  const [selectedMods, setSelectedMods] = useState(() => {
    if (editingItem?.selectedMods) return editingItem.selectedMods
    // Pre-select first option for required radio groups
    const init = {}
    mods.forEach((mod, mi) => {
      if (!mod.multiple && mod.required && mod.options?.length > 0) {
        init[mi] = { name: mod.options[0].name, price: mod.options[0].price ?? 0 }
      }
    })
    return init
  })

  /* Current variant name — used to resolve priceByVariant */
  const currentVariantName = selectedVariant !== null ? (vars[selectedVariant]?.name ?? null) : null

  /* Whether any modifier option uses priceByVariant */
  const hasVariantPricedOptions = useMemo(
    () => mods.some(m => (m.options ?? []).some(o => o.priceByVariant)),
    [mods]
  )

  /* When the selected variant changes, update prices of already-selected mods */
  useEffect(() => {
    if (mods.length === 0 || !hasVariantPricedOptions) return
    const variantName = selectedVariant !== null ? vars[selectedVariant]?.name ?? null : null

    setSelectedMods(prev => {
      let changed = false
      const updated = {}
      Object.entries(prev).forEach(([mi, val]) => {
        const mod = mods[Number(mi)]
        if (!mod) { updated[mi] = val; return }

        if (Array.isArray(val)) {
          const newVal = val.map(sel => {
            const opt = (mod.options ?? []).find(o => o.name === sel.name)
            if (!opt || !opt.priceByVariant) return sel
            const newPrice = getPriceForVariant(opt, variantName)
            if (newPrice === sel.price) return sel
            changed = true
            return { ...sel, price: newPrice }
          })
          updated[mi] = newVal
        } else if (val) {
          const opt = (mod.options ?? []).find(o => o.name === val.name)
          if (!opt || !opt.priceByVariant) { updated[mi] = val; return }
          const newPrice = getPriceForVariant(opt, variantName)
          if (newPrice === val.price) { updated[mi] = val; return }
          changed = true
          updated[mi] = { ...val, price: newPrice }
        } else {
          updated[mi] = val
        }
      })
      return changed ? updated : prev
    })
  }, [selectedVariant]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Escape to close */
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  /* Base price (selected variant or simple product) */
  const basePrice = selectedVariant !== null
    ? (vars[selectedVariant].promoPrice ?? vars[selectedVariant].price)
    : (product.promoPrice ?? product.price)

  /* Sum of all selected extras (already have resolved prices from useEffect) */
  const sumExtras = useMemo(() =>
    Object.entries(selectedMods).reduce((sum, [, val]) => {
      if (Array.isArray(val)) return sum + val.reduce((s, o) => s + (o.price ?? 0), 0)
      return sum + (val?.price ?? 0)
    }, 0),
    [selectedMods]
  )

  const unitPrice = basePrice + sumExtras
  const total     = unitPrice * qty

  /* Handlers — resolve price at the moment of selection */
  const toggleRadio = (modIdx, opt) => {
    const price = getPriceForVariant(opt, currentVariantName)
    setSelectedMods(prev => ({ ...prev, [modIdx]: { name: opt.name, price } }))
  }

  const toggleCheck = (modIdx, opt, mod) => {
    const price = getPriceForVariant(opt, currentVariantName)
    setSelectedMods(prev => {
      const cur = prev[modIdx] ?? []
      const has = cur.some(o => o.name === opt.name)
      if (has) return { ...prev, [modIdx]: cur.filter(o => o.name !== opt.name) }
      if (mod.max != null && cur.length >= mod.max) return prev
      return { ...prev, [modIdx]: [...cur, { name: opt.name, price }] }
    })
  }

  const isCheckSel = (modIdx, name) => {
    const arr = selectedMods[modIdx]
    return Array.isArray(arr) && arr.some(o => o.name === name)
  }

  const handleAdd = () => {
    /* Flatten mods — prices already resolved at selection/variant-change time */
    const flatMods = Object.entries(selectedMods).flatMap(([, val]) =>
      Array.isArray(val) ? val : (val ? [val] : [])
    )
    onAdd({
      id:        crypto.randomUUID(),       // unique item ID in the order
      productId: product.id,                // reference to the menu product
      _key:      `${product.id}-${selectedVariant ?? 'simple'}-${Date.now()}`,
      name:      product.name,
      variant:   selectedVariant !== null ? vars[selectedVariant].name : null,
      qty,
      price:     unitPrice,
      modifiers: flatMods,                  // [{name, price}] — for edit reconstruction
      mods:      flatMods.map(m => m.name), // string[] — for display
      total,
      note:      note.trim() || null,
    })
  }

  const emoji = FALLBACK_EMOJI[product.id] ?? '🍕'

  return (
    <div className="pm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pm-modal">

        {/* ── Header ── */}
        <div className="pm-header">
          <span className="pm-header-title">{product.name}</span>
          <button className="pm-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="pm-body">

          {/* Product top row */}
          <div className="pm-product-top">
            <div className="pm-thumb">
              {(product.images?.[0] ?? product.image)
                ? <img src={product.images?.[0] ?? product.image} alt={product.name} />
                : <span>{emoji}</span>
              }
            </div>
            <div className="pm-product-meta">
              <span className="pm-product-name">{product.name}</span>
              {product.description && (
                <span className="pm-product-desc">{product.description}</span>
              )}
              <span className="pm-product-price">{fmt(basePrice)}</span>
            </div>
          </div>

          {/* ── Variants ── */}
          {vars.length > 0 && (
            <div className="pm-section">
              <div className="pm-section-head">
                <span className="pm-section-title">Elige el tamaño de tu pizza</span>
                <span className="pm-badge pm-badge--req">Obligatorio</span>
              </div>
              <span className="pm-section-hint">Seleccione mínimo 1 opción</span>
              <div className="pm-radio-list">
                {vars.map((v, vi) => {
                  const sel = selectedVariant === vi
                  return (
                    <div
                      key={v.id}
                      className={`pm-radio-row${sel ? ' pm-radio-row--sel' : ''}`}
                      onClick={() => setSelectedVariant(vi)}
                    >
                      <span className={`pm-radio-circle${sel ? ' pm-radio-circle--sel' : ''}`}>
                        {sel && <span className="pm-radio-dot" />}
                      </span>
                      <span className="pm-radio-label">{v.name}</span>
                      <span className="pm-radio-price">{fmt(v.promoPrice ?? v.price)}</span>
                    </div>
                  )
                })}
              </div>
              {/* Hint when no variant selected yet and variant-priced extras exist */}
              {selectedVariant === null && hasVariantPricedOptions && (
                <p className="pm-variant-price-hint">
                  💡 Elige el tamaño para ver el precio de los extras
                </p>
              )}
            </div>
          )}

          {/* ── Modifier sections ── */}
          {mods.map((mod, mi) => {
            const visibleOptions = (mod.options ?? []).filter(o => o.active !== false)
            if (visibleOptions.length === 0) return null
            return (
            <div key={mod.id} className="pm-section">
              <div className="pm-section-head">
                <span className="pm-section-title">{mod.name}</span>
                <span className={`pm-badge ${mod.required ? 'pm-badge--req' : 'pm-badge--opt'}`}>
                  {mod.required ? 'Obligatorio' : 'Opcional'}
                </span>
              </div>
              {!mod.multiple
                ? <span className="pm-section-hint">Seleccione mínimo 1 opción</span>
                : mod.max != null && (
                    <span className="pm-section-hint">Seleccione hasta {mod.max} opciones</span>
                  )
              }

              {/* Radio mod */}
              {!mod.multiple ? (
                <div className="pm-radio-list">
                  {visibleOptions.map(opt => {
                    const sel           = selectedMods[mi]?.name === opt.name
                    const resolvedPrice = getPriceForVariant(opt, currentVariantName)
                    const isVariable    = !!opt.priceByVariant && currentVariantName === null
                    return (
                      <div
                        key={opt.id}
                        className={`pm-radio-row${sel ? ' pm-radio-row--sel' : ''}`}
                        onClick={() => toggleRadio(mi, opt)}
                      >
                        <span className={`pm-radio-circle${sel ? ' pm-radio-circle--sel' : ''}`}>
                          {sel && <span className="pm-radio-dot" />}
                        </span>
                        <span className="pm-radio-label">{opt.name}</span>
                        {isVariable ? (
                          <span className="pm-price-varies">📐 varía</span>
                        ) : resolvedPrice > 0 ? (
                          <span className="pm-radio-price">+{fmt(resolvedPrice)}</span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Checkbox mod */
                <div className="pm-check-list">
                  {visibleOptions.map(opt => {
                    const sel           = isCheckSel(mi, opt.name)
                    const resolvedPrice = getPriceForVariant(opt, currentVariantName)
                    const isVariable    = !!opt.priceByVariant && currentVariantName === null
                    return (
                      <div key={opt.id} className="pm-check-row">
                        <span className="pm-check-name">{opt.name}</span>
                        {isVariable ? (
                          <span className="pm-price-varies">📐 varía</span>
                        ) : resolvedPrice > 0 ? (
                          <span className="pm-check-price">+{fmt(resolvedPrice)}</span>
                        ) : null}
                        <button
                          className={`pm-check-btn${sel ? ' pm-check-btn--sel' : ''}`}
                          onClick={() => toggleCheck(mi, opt, mod)}
                        >
                          {sel ? '✓' : '+'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            )
          })}

          {/* ── Item note ── */}
          <div className="pm-section pm-note-section">
            <span className="pm-section-title">Nota para este producto</span>
            <textarea
              className="pm-note-input"
              rows={2}
              placeholder="Ej: sin tomate en la mitad, bien cocido..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

        </div>

        {/* ── Fixed footer ── */}
        <div className="pm-footer">
          <div className="pm-qty-ctrl">
            <button className="pm-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
            <span className="pm-qty-val">{qty}</span>
            <button className="pm-qty-btn" onClick={() => setQty(q => q + 1)}>+</button>
          </div>
          <button className="pm-add-btn" onClick={handleAdd}>
            {isEditing ? 'Guardar cambios' : 'Agregar'} &nbsp;·&nbsp; {fmt(total)}
          </button>
        </div>

      </div>
    </div>
  )
}
