import { useState, useEffect, useRef, useMemo } from 'react'
import ProductModal from './ProductModal'
import { useClients } from '../../../context/ClientContext'
import { useSettings } from '../../../context/SettingsContext'
import { calculateDeliveryPrice } from '../../../utils/deliveryCalculator'
import './OrderBuilderModal.css'

const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`

const TYPE_LABEL = {
  flash:    'Pedido Flash',
  local:    'En el local',
  llevar:   'Para llevar',
  delivery: 'Delivery',
  mesa:     'Mesa',
}

const FALLBACK_EMOJI = {
  101: '🧄', 102: '🌿', 103: '🍗', 104: '🧀',
  201: '🍕', 202: '🍕', 203: '🍖', 204: '🥦',
  205: '🌿', 206: '🍅', 301: '🥩', 302: '🍖',
  303: '🥓', 304: '🌶️', 305: '🍍', 306: '🧀',
  401: '🥤', 402: '🥤', 403: '🍵', 404: '💧', 405: '🧃',
}

const CAT_EMOJI = {
  'Entradas':          '🥗',
  'Pizzas Clásicas':   '🍕',
  'Pizzas Especiales': '⭐',
  'Bebidas':           '🥤',
  'Promos':            '🎁',
}

export default function OrderBuilderModal({
  orderType,
  orderNum,
  categories,
  modifierGroups,
  onConfirm,
  onClose,
  mode = 'create',   // 'create' | 'edit'
}) {
  const { clients } = useClients()
  const { deliveryZones } = useSettings()

  const [activeCatId,     setActiveCatId]     = useState(() => categories?.[0]?.id ?? null)
  const [search,          setSearch]          = useState('')
  const [items,           setItems]           = useState([])
  const [phone,           setPhone]           = useState('')
  const [clientName,      setClientName]      = useState('')
  const [address,         setAddress]         = useState('')
  const [note,            setNote]            = useState('')
  const [scheduled,       setScheduled]       = useState(false)
  const [schedDay,        setSchedDay]        = useState('today')
  const [schedCustomDate, setSchedCustomDate] = useState('')
  const [schedTime,       setSchedTime]       = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)

  // Autocomplete state
  const [showPhoneSug,           setShowPhoneSug]           = useState(false)
  const [showNameSug,            setShowNameSug]            = useState(false)
  const [clientAddresses,        setClientAddresses]        = useState([])  // addresses[] from matched client
  const [showAddrDropdown,       setShowAddrDropdown]       = useState(false)
  const phoneRef = useRef(null)
  const nameRef  = useRef(null)

  const isFlash    = orderType === 'flash'
  const isDelivery = orderType === 'delivery'
  const isEdit     = mode === 'edit'

  /* Delivery Cost State */
  const [deliveryCost, setDeliveryCost] = useState(0)
  const [isOutOfZone, setIsOutOfZone] = useState(false)
  const [calculatingDelivery, setCalculatingDelivery] = useState(false)

  /* Delivery Calculation Effect with Debounce */
  useEffect(() => {
    if (!isDelivery || !address.trim() || isFlash || isEdit) {
      setDeliveryCost(0)
      setIsOutOfZone(false)
      setCalculatingDelivery(false)
      return
    }

    setCalculatingDelivery(true)
    setIsOutOfZone(false)
    
    const timer = setTimeout(async () => {
      const price = await calculateDeliveryPrice(address.trim(), deliveryZones)
      if (price === null) {
        setIsOutOfZone(true)
        setDeliveryCost(0)
      } else {
        setIsOutOfZone(false)
        setDeliveryCost(price)
      }
      setCalculatingDelivery(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [address, isDelivery, deliveryZones, isFlash, isEdit])

  /* Escape closes builder (only if ProductModal isn't open) */
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && !selectedProduct) onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose, selectedProduct])

  /* Phone auto-lookup replaced by live autocomplete — see JSX below */

  /* Products shown in Col 2 */
  const displayProducts = useMemo(() => {
    if (search.trim()) {
      return categories.flatMap(c =>
        (c.products ?? []).filter(
          p => p.is_active !== false &&
               p.name.toLowerCase().includes(search.toLowerCase())
        )
      )
    }
    const cat = categories.find(c => c.id === activeCatId)
    // Only Front-End filter applied: ensure is_active isn't false
    return cat ? (cat.products ?? []).filter(p => p.is_active !== false) : []
  }, [categories, activeCatId, search])

  const handleProductAdd = (item) => {
    setItems(prev => [...prev, item])
    setSelectedProduct(null)
  }

  const removeItem = (key) => setItems(prev => prev.filter(i => i._key !== key))

  const itemsSubtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const total = itemsSubtotal + (isDelivery ? (Number(deliveryCost) || 0) : 0)

  // Live-filter clients for suggestions
  const phoneSuggestions = useMemo(() => {
    const q = phone.trim().replace(/\D/g, '')
    if (!q) return []
    return clients.filter(c => (c.phone ?? '').replace(/\D/g, '').includes(q)).slice(0, 5)
  }, [clients, phone])

  const nameSuggestions = useMemo(() => {
    const q = clientName.trim().toLowerCase()
    if (q.length < 2) return []
    return clients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 5)
  }, [clients, clientName])

  const handleSelectClient = (c) => {
    const rawPhone = (c.phone ?? '').replace(/\D/g, '').replace(/^56/, '')
    setPhone(rawPhone)
    setClientName(c.name)
    setClientAddresses(Array.isArray(c.addresses) ? c.addresses : [])
    setAddress('')
    setShowPhoneSug(false)
    setShowNameSug(false)
    setShowAddrDropdown(false)
  }

  const handleConfirm = () => {
    if (items.length === 0) return
    const customer = (!isEdit && !isFlash && (clientName.trim() || phone.trim()))
      ? { name: clientName.trim(), phone: phone.trim(), address: address.trim() }
      : null

    let scheduledAt = null
    if (!isEdit && scheduled && schedTime) {
      const today    = new Date()
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
      let base
      if (schedDay === 'today')         base = today
      else if (schedDay === 'tomorrow') base = tomorrow
      else                              base = schedCustomDate ? new Date(schedCustomDate) : today
      const [h, m] = schedTime.split(':').map(Number)
      base.setHours(h, m, 0, 0)
      scheduledAt = base
    }

    const charges = isDelivery ? { delivery: Number(deliveryCost) || 0 } : {}
    onConfirm({ items, total, customer, comments: note.trim() || null, scheduledAt, charges })
  }

  return (
    <>
      <div
        className="obm-overlay"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="obm-modal">

          {/* ── Header ── */}
          <div className="obm-header">
            <div className="obm-header-left">
              <span className="obm-title">{isEdit ? 'Agregar productos' : 'Nuevo pedido'}</span>
              <span className="obm-sep">—</span>
              <span className="obm-num">#{orderNum}</span>
              <span className="obm-type-tag">{TYPE_LABEL[orderType] ?? orderType}</span>
            </div>
            <button className="obm-close" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>

          {/* ── 3-column body ── */}
          <div className="obm-body">

            {/* Col 1: Categories */}
            <div className="obm-cats">
              {categories.map(cat => {
                const emoji = CAT_EMOJI[cat.name] ?? '🍽️'
                const count = (cat.products ?? []).filter(p => p.active !== false).length
                const isActive = activeCatId === cat.id && !search.trim()
                return (
                  <button
                    key={cat.id}
                    className={`obm-cat-btn${isActive ? ' obm-cat-btn--active' : ''}`}
                    onClick={() => { setActiveCatId(cat.id); setSearch('') }}
                  >
                    <span className="obm-cat-emoji">{emoji}</span>
                    <span className="obm-cat-name">{cat.name}</span>
                    <span className="obm-cat-count">{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Col 2: Product grid */}
            <div className="obm-products">
              {displayProducts.length === 0 ? (
                <div className="obm-no-products">
                  {search.trim()
                    ? `Sin resultados para "${search}"`
                    : 'Sin productos en esta categoría'}
                </div>
              ) : (
                <div className="obm-grid">
                  {displayProducts.map(product => (
                    <div
                      key={product.id}
                      className="obm-prod-card"
                      onClick={() => setSelectedProduct(product)}
                    >
                      <div className="obm-prod-thumb">
                        {(product.images?.[0] ?? product.image)
                          ? <img src={product.images?.[0] ?? product.image} alt={product.name} />
                          : <span>{FALLBACK_EMOJI[product.id] ?? '🍕'}</span>
                        }
                      </div>
                      <span className="obm-prod-name">{product.name}</span>
                      {product.priceType === 'simple' ? (
                        <span className="obm-prod-price">
                          {fmt(product.promoPrice ?? product.price)}
                        </span>
                      ) : (
                        <span className="obm-prod-price obm-prod-price--multi">
                          Desde {fmt(Math.min(...product.variants.map(v => v.promoPrice ?? v.price)))}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Col 3: Summary */}
            <div className="obm-summary">

              {/* Search */}
              <div className="obm-search-wrap">
                <IconSearch />
                <input
                  className="obm-search"
                  placeholder="Buscar en el menú…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className="obm-search-clear" onClick={() => setSearch('')}>✕</button>
                )}
              </div>

              {/* Client section — create mode only, not flash */}
              {!isEdit && !isFlash && (
                <div className="obm-client-section">
                  <div className="obm-section-label">Cliente</div>

                  {/* Phone input with autocomplete */}
                  <div className="obm-ac-wrap" ref={phoneRef}>
                    <div className="obm-phone-row">
                      <span className="obm-phone-prefix">🇨🇱 +56</span>
                      <input
                        className="obm-phone-input"
                        placeholder="912345678"
                        maxLength={9}
                        value={phone}
                        onChange={e => {
                          setPhone(e.target.value.replace(/\D/g, ''))
                          setShowPhoneSug(true)
                          setClientAddresses([])
                        }}
                        onFocus={() => setShowPhoneSug(true)}
                        onBlur={() => setTimeout(() => setShowPhoneSug(false), 150)}
                        autoComplete="off"
                      />
                    </div>
                    {showPhoneSug && phone.length > 0 && (
                      <div className="obm-suggestions">
                        <div
                          className="obm-sug-new"
                          onMouseDown={() => { setShowPhoneSug(false); setClientAddresses([]) }}
                        >
                          👤 &ldquo;{phone}&rdquo;
                          <span className="obm-sug-new-label">Nuevo cliente</span>
                        </div>
                        {phoneSuggestions.length > 0 && (
                          <div className="obm-sug-sep">
                            <span>({phoneSuggestions.length}) Resultado{phoneSuggestions.length !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {phoneSuggestions.map(c => (
                          <div key={c.id} className="obm-sug-item" onMouseDown={() => handleSelectClient(c)}>
                            <div className="obm-sug-name">{c.name}</div>
                            <div className="obm-sug-meta">{c.phone} · <span className="obm-sug-seg">{c.segment}</span></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Name input with autocomplete */}
                  <div className="obm-ac-wrap" ref={nameRef}>
                    <input
                      className="obm-input"
                      placeholder="Nombre del cliente"
                      value={clientName}
                      onChange={e => {
                        setClientName(e.target.value)
                        setShowNameSug(true)
                        setClientAddresses([])
                      }}
                      onFocus={() => setShowNameSug(true)}
                      onBlur={() => setTimeout(() => setShowNameSug(false), 150)}
                      autoComplete="off"
                    />
                    {showNameSug && clientName.length >= 2 && (
                      <div className="obm-suggestions">
                        <div
                          className="obm-sug-new"
                          onMouseDown={() => { setShowNameSug(false); setClientAddresses([]) }}
                        >
                          👤 &ldquo;{clientName}&rdquo;
                          <span className="obm-sug-new-label">Nuevo cliente</span>
                        </div>
                        {nameSuggestions.length > 0 && (
                          <div className="obm-sug-sep">
                            <span>({nameSuggestions.length}) Resultado{nameSuggestions.length !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {nameSuggestions.map(c => (
                          <div key={c.id} className="obm-sug-item" onMouseDown={() => handleSelectClient(c)}>
                            <div className="obm-sug-name">{c.name}</div>
                            <div className="obm-sug-meta">{c.phone} · <span className="obm-sug-seg">{c.segment}</span></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Address section — only delivery */}
                  {isDelivery && (
                    <div className="obm-ac-wrap">
                      {clientAddresses.length > 0 ? (
                        <>
                          <button
                            type="button"
                            className="obm-addr-dropdown-btn"
                            onClick={() => setShowAddrDropdown(v => !v)}
                          >
                            <span>{address || 'Seleccionar dirección…'}</span>
                            <span className="obm-addr-chevron">{showAddrDropdown ? '▲' : '▼'}</span>
                          </button>
                          {showAddrDropdown && (
                            <div className="obm-suggestions obm-suggestions--addr">
                              <div
                                className="obm-sug-new"
                                onMouseDown={() => { setAddress(''); setShowAddrDropdown(false) }}
                              >
                                ✏️ Agregar o editar dirección
                              </div>
                              {clientAddresses.map((addr, i) => (
                                <div
                                  key={i}
                                  className={`obm-sug-item${address === addr ? ' obm-sug-item--selected' : ''}`}
                                  onMouseDown={() => { setAddress(addr); setShowAddrDropdown(false) }}
                                >
                                  📍 {addr}
                                </div>
                              ))}
                            </div>
                          )}
                          {(!address || !clientAddresses.includes(address)) && (
                            <input
                              className="obm-input"
                              placeholder="Dirección de entrega"
                              value={address}
                              onChange={e => setAddress(e.target.value)}
                            />
                          )}
                        </>
                      ) : (
                        <input
                          className="obm-input"
                          placeholder="Dirección de entrega"
                          value={address}
                          onChange={e => setAddress(e.target.value)}
                        />
                      )}

                      {/* Delivery Notification block */}
                      {address.trim() !== '' && (
                        <div className="obm-delivery-calc">
                          {calculatingDelivery && (
                            <div className="obm-calc-loading">
                              <span className="dmap-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                              Calculando costo de envío...
                            </div>
                          )}
                          {!calculatingDelivery && isOutOfZone && (
                            <div className="obm-calc-error">
                              <span className="obm-calc-error-msg">⚠️ Fuera de zona de reparto</span>
                              <div className="obm-delivery-input-row">
                                Ingresa costo manual: 
                                <input 
                                  type="number" 
                                  className="obm-delivery-input" 
                                  value={deliveryCost} 
                                  onChange={e => setDeliveryCost(e.target.value)}
                                  placeholder="$0" 
                                  min="0"
                                />
                              </div>
                            </div>
                          )}
                          {!calculatingDelivery && !isOutOfZone && deliveryCost > 0 && (
                            <div className="obm-calc-success">
                              <span>✅ Zona identificada</span>
                              <strong>+{fmt(deliveryCost)}</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Note — create mode only, not flash */}
              {!isEdit && !isFlash && (
                <div className="obm-note-section">
                  <div className="obm-section-label">💬 Nota general</div>
                  <textarea
                    className="obm-input obm-note"
                    placeholder="Ej: sin gluten, tocar el timbre, alérgico al maní…"
                    rows={2}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </div>
              )}

              {/* Scheduled — create mode only */}
              {!isEdit && (
                <div className="obm-scheduled-section">
                  <label className="obm-sched-toggle">
                    <input
                      type="checkbox"
                      checked={scheduled}
                      onChange={e => setScheduled(e.target.checked)}
                    />
                    <span>Programar para después</span>
                  </label>
                  {scheduled && (
                    <div className="obm-sched-fields">
                      <div className="obm-sched-day-row">
                        <button type="button"
                          className={`obm-sched-day-btn${schedDay === 'today' ? ' active' : ''}`}
                          onClick={() => setSchedDay('today')}
                        >Hoy</button>
                        <button type="button"
                          className={`obm-sched-day-btn${schedDay === 'tomorrow' ? ' active' : ''}`}
                          onClick={() => setSchedDay('tomorrow')}
                        >Mañana</button>
                        <button type="button"
                          className={`obm-sched-day-btn${schedDay === 'custom' ? ' active' : ''}`}
                          onClick={() => setSchedDay('custom')}
                        >📅 Fecha</button>
                      </div>
                      {schedDay === 'custom' && (
                        <input
                          type="date"
                          className="obm-input obm-sched-date"
                          value={schedCustomDate}
                          onChange={e => setSchedCustomDate(e.target.value)}
                        />
                      )}
                      <input
                        type="time"
                        className="obm-input obm-sched-time"
                        placeholder="HH:MM"
                        value={schedTime}
                        onChange={e => setSchedTime(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Items divider */}
              <div className="obm-items-divider">
                <span>Pedido</span>
                {items.length > 0 && (
                  <span className="obm-items-badge">{items.length} ítem{items.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Items list — scrolleable */}
              <div className="obm-items-list">
                {items.length === 0 ? (
                  <div className="obm-items-empty">Agrega productos del menú</div>
                ) : (
                  items.map(item => (
                    <div key={item._key} className="obm-item-row">
                      <span className="obm-item-qty">{item.qty}×</span>
                      <div className="obm-item-info">
                        <span className="obm-item-name">{item.name}</span>
                        {item.variant && (
                          <span className="obm-item-variant">({item.variant})</span>
                        )}
                        {item.modifiers?.length > 0 && (
                          <span className="obm-item-mods">
                            <span className="obm-item-extra-lbl">Extra: </span>
                            {item.modifiers.map(m => m.name).join(', ')}
                          </span>
                        )}
                        {item.note && (
                          <span className="obm-item-note">📝 {item.note}</span>
                        )}
                      </div>
                      <span className="obm-item-total">{fmt(item.price * item.qty)}</span>
                      <button
                        className="obm-item-remove"
                        onClick={() => removeItem(item._key)}
                        title="Quitar"
                      >×</button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="obm-footer">
                {isDelivery && Number(deliveryCost) > 0 && (
                  <div className="obm-total-row">
                    <span>Subtotal ítems</span>
                    <span>{fmt(itemsSubtotal)}</span>
                  </div>
                )}
                {isDelivery && Number(deliveryCost) > 0 && (
                  <div className="obm-total-row">
                    <span>Costo de envío</span>
                    <span>{fmt(deliveryCost)}</span>
                  </div>
                )}
                <div className="obm-total-row">
                  <span>Total</span>
                  <span className="obm-total-amount">{fmt(total)}</span>
                </div>
                <button
                  className="obm-confirm-btn"
                  onClick={handleConfirm}
                  disabled={items.length === 0}
                >
                  {isEdit ? 'Guardar cambios →' : 'Crear pedido →'}
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ProductModal renders above the builder */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          modifierGroups={modifierGroups}
          onAdd={handleProductAdd}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  )
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, color: 'var(--muted)' }}>
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}
