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
        .filter(mg => mg && mg.is_active !== false),
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
  /* State for multiple quantities mapping option.id -> quantity */
  const [modifierQuantities, setModifierQuantities] = useState(() => {
    if (editingItem?.modifierQuantities) return editingItem.modifierQuantities
    // Fallback: If legacy payload is being edited, map from flat modifiers list
    if (editingItem?.modifiers && !editingItem.modifierQuantities) {
      const init = {}
      editingItem.modifiers.forEach(m => {
        if (m.id && m.qty > 0) init[m.id] = m.qty
      })
      return init
    }
    return {}
  })

  /* Current variant name — used to resolve priceByVariant */
  const currentVariantName = selectedVariant !== null ? (vars[selectedVariant]?.name ?? null) : null

  /* Whether any modifier option uses priceByVariant */
  const hasVariantPricedOptions = useMemo(
    () => mods.some(m => (m.options ?? []).some(o => o.priceByVariant)),
    [mods]
  )

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

  /* Sum of all selected extras */
  const sumExtras = useMemo(() => {
    let sum = 0
    Object.entries(modifierQuantities).forEach(([optId, q]) => {
      if (q > 0) {
        for (const mod of mods) {
          const opt = (mod.options ?? []).find(o => String(o.id) === optId)
          if (opt) {
            sum += getPriceForVariant(opt, currentVariantName) * q
            break
          }
        }
      }
    })
    return sum
  }, [modifierQuantities, mods, currentVariantName])

  const unitPrice = basePrice + sumExtras
  const total     = unitPrice * qty

  /* Form Validation
   * Must mirror the render-side filtering exactly:
   *   1. Skip groups hidden by the variant filter.
   *   2. Sum only options that are visible (active !== false).
   * This prevents invisible groups from blocking submission and ensures the
   * counted quantity matches exactly what the user can interact with.
   */
  const isFormValid = useMemo(() => {
    if (vars.length > 0 && selectedVariant === null) return false;

    for (const mod of mods) {
      // Skip inactive groups (same guard as in the render)
      if (mod.is_active === false) continue;

      // ── Replicate the variant-filter from the render ──────────────────────
      if (currentVariantName) {
        const sizeKeywords = ['Porción', 'Mediana', 'Familiar'];
        const isGlobal      = !sizeKeywords.some(kw => mod.name.includes(kw));
        const matchesVariant = mod.name.includes(currentVariantName);
        // If this group is neither global nor matched to the current variant,
        // the user cannot see it → skip validation for it.
        if (!matchesVariant && !isGlobal) continue;
      }

      // ── Only count options that are visible in the UI ─────────────────────
      const visibleOpts = (mod.options ?? []).filter(o => o.active !== false);
      if (visibleOpts.length === 0) continue; // nothing to interact with

      // ── Sum of quantities for visible options in this group ───────────────
      const groupSum = visibleOpts.reduce(
        (acc, opt) => acc + (modifierQuantities[opt.id] || 0),
        0
      );

      // ── Min check ────────────────────────────────────────────────────────
      const minRequired = mod.required ? Math.max(mod.min || 1, 1) : (mod.min || 0);
      if (minRequired > 0 && groupSum < minRequired) return false;

      // ── Max check (optional safety guard) ────────────────────────────────
      if (mod.max != null && mod.max > 0 && groupSum > mod.max) return false;
    }

    return true;
  }, [mods, modifierQuantities, vars, selectedVariant, currentVariantName]);

  /* Handlers */
  const handleModifyQty = (mod, opt, delta) => {
    setModifierQuantities(prev => {
      const currentQty = prev[opt.id] || 0
      const newQty = Math.max(0, currentQty + delta)
      const limit = mod.multiple ? (mod.max ?? Infinity) : 1
      
      const copy = { ...prev }

      // If limits to 1 (like radios), auto reset others in the same group
      if (delta > 0 && limit === 1) {
        (mod.options ?? []).forEach(o => {
          if (o.id !== opt.id) {
            copy[o.id] = 0
          }
        })
      }

      copy[opt.id] = newQty
      return copy
    })
  }

  const handleAdd = () => {
    const flatMods = []
    Object.entries(modifierQuantities).forEach(([optId, q]) => {
      if (q > 0) {
        for (const mod of mods) {
          const opt = (mod.options ?? []).find(o => String(o.id) === optId)
          if (opt) {
            flatMods.push({
              id: opt.id,
              name: opt.name,
              price: getPriceForVariant(opt, currentVariantName),
              qty: q
            })
            break
          }
        }
      }
    })

    onAdd({
      id:        crypto.randomUUID(),       // unique item ID in the order
      productId: product.id,                // reference to the menu product
      _key:      `${product.id}-${selectedVariant ?? 'simple'}-${Date.now()}`,
      name:      product.name,
      variant:   selectedVariant !== null ? vars[selectedVariant].name : null,
      qty,
      price:     unitPrice,
      modifiers: flatMods,                  // [{id, name, price, qty}] — for print and edit reconstruction
      modifierQuantities,                   // para fácil rehidratación en edición
      mods:      flatMods.map(m => m.qty > 1 ? `${m.qty}x ${m.name}` : m.name), // string[] — for display
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
          {vars.length > 0 && (() => {
            const firstVar = vars[0].name.toLowerCase()
            let title = 'Elige una opción'
            if (['porción', 'porcion', 'mediana', 'familiar', 'individual'].some(w => firstVar.includes(w))) {
              title = 'Elige el tamaño de tu pizza'
            } else if (firstVar.includes('gr') || firstVar.includes('kg') || firstVar.match(/\d+\s*(gr|kg)/)) {
              title = 'Elige el tamaño de tu porción'
            }
            return (
              <div className="pm-section">
                <div className="pm-section-head">
                  <span className="pm-section-title">{title}</span>
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
            )
          })()}

          {/* ── Modifier sections ── */}
          {mods.map((mod, mi) => {
            // Filter variant-specific modifier groups based on size names
            if (currentVariantName) {
              const sizeKeywords = ['Porción', 'Mediana', 'Familiar']
              const isGlobal = !sizeKeywords.some(keyword => mod.name.includes(keyword))
              const matchesVariant = mod.name.includes(currentVariantName)

              if (!matchesVariant && !isGlobal) {
                return null
              }
            }

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

              <div className="flex flex-col mt-1">
                {visibleOptions.map(opt => {
                  const resolvedPrice = getPriceForVariant(opt, currentVariantName)
                  const isVariable    = !!opt.priceByVariant && currentVariantName === null
                  const currentQty    = modifierQuantities[opt.id] || 0
                  
                  // Calculate group limit
                  const limit = mod.multiple ? (mod.max ?? Infinity) : 1
                  const groupSum = visibleOptions.reduce((acc, o) => acc + (modifierQuantities[o.id] || 0), 0)
                  
                  // Disable [+] if the group limit is reached
                  let disablePlus = groupSum >= limit
                  if (limit === 1 && currentQty === 0) {
                    // For single choice, we allow clicking on other options to auto-reset
                    disablePlus = false
                  } else if (limit === 1 && currentQty >= 1) {
                    // But we disable it for the currently selected one up to max 1
                    disablePlus = true
                  }

                  return (
                    <div key={opt.id} className="pm-opt-row">
                      <div className="pm-opt-info">
                        <div className="pm-opt-name">
                          {opt.name}
                        </div>
                        {isVariable ? (
                          <div><span className="pm-price-varies">📐 varía</span></div>
                        ) : resolvedPrice > 0 ? (
                          <div className="pm-opt-price">
                            +{fmt(resolvedPrice)}
                          </div>
                        ) : null}
                      </div>

                      <div className="pm-opt-stepper">
                        <button
                          className="pm-opt-btn"
                          disabled={currentQty === 0}
                          onClick={() => handleModifyQty(mod, opt, -1)}
                        >
                          −
                        </button>
                        <span className="pm-opt-qty">
                          {currentQty}
                        </span>
                        <button
                          className="pm-opt-btn"
                          disabled={disablePlus}
                          onClick={() => handleModifyQty(mod, opt, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
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
          <button 
            className="pm-add-btn" 
            disabled={!isFormValid}
            onClick={handleAdd}
          >
            {!isFormValid ? 'Completa las opciones requeridas' : (isEditing ? 'Guardar cambios' : 'Agregar')} &nbsp;·&nbsp; {fmt(total)}
          </button>
        </div>

      </div>
    </div>
  )
}
