import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import ProductModal from './modals/ProductModal'
import OrderPrintTemplate from './OrderPrintTemplate'
import { useClients } from '../../context/ClientContext'
import { useSettings } from '../../context/SettingsContext'
import { calculateDeliveryPrice } from '../../utils/deliveryCalculator'
import './DetailPanel.css'

/* ── Helpers ── */
function useTick(ms = 15000) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`

function fmtPhone(phone) {
  if (!phone) return null
  const d = phone.replace(/\D/g, '')
  if (d.length === 9) return `+56 ${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`
  return phone
}

function agoText(date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1)  return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `hace ${h} h ${m} min` : `hace ${h} h`
}

/* ── Config ── */
const TYPE_CONFIG = {
  flash:    { icon: '⚡', label: 'Pedido Flash' },
  local:    { icon: '🏪', label: 'En el local'  },
  llevar:   { icon: '🛍️', label: 'Para llevar'  },
  delivery: { icon: '🛵', label: 'Delivery'      },
  mesa:     { icon: '🪑', label: 'Mesa'          },
}

const ORDER_STATES = {
  pend:        { label: 'Pendiente',      badgeCls: 'dp-badge--pend',        headerBg: '#fffbeb', headerBorder: '#fde68a' },
  preparacion: { label: 'En preparación', badgeCls: 'dp-badge--preparacion', headerBg: '#eff6ff', headerBorder: '#bfdbfe' },
  listo:       { label: 'Listo',          badgeCls: 'dp-badge--listo',       headerBg: '#f0fdf4', headerBorder: '#bbf7d0' },
  finalizado:  { label: 'Finalizado',     badgeCls: 'dp-badge--finalizado',  headerBg: '#f9fafb', headerBorder: '#e5e7eb' },
  cancelado:   { label: 'Cancelado',      badgeCls: 'dp-badge--cancelado',   headerBg: '#fef2f2', headerBorder: '#fecaca' },
}

const PAYMENT_METHODS = [
  { id: 'Efectivo',      label: 'Efectivo',      icon: '💵' },
  { id: 'Débito',        label: 'Débito',        icon: '💳' },
  { id: 'Transferencia', label: 'Transferencia', icon: '📱' },
]

/* ── Amount computation ── */
function computeAmounts(items, charges, discountMode, discountVal) {
  const subtotal     = items.reduce((s, i) => s + i.total, 0)
  const discountAmt  = discountMode === '%'
    ? Math.round(subtotal * (Number(discountVal) || 0) / 100)
    : (Number(discountVal) || 0)
  const subtotalNet  = Math.max(0, subtotal - discountAmt)
  const tipAmt       = charges.tipMode === '%'
    ? Math.round(subtotalNet * (Number(charges.tipVal) || 0) / 100)
    : (Number(charges.tipVal) || 0)
  const deliveryAmt  = Number(charges.delivery)  || 0
  const servicioAmt  = Number(charges.servicio)  || 0
  const empaqueAmt   = Number(charges.empaque)   || 0
  const total        = subtotalNet + deliveryAmt + tipAmt + servicioAmt + empaqueAmt
  return { subtotal, discountAmt, subtotalNet, tipAmt, deliveryAmt, servicioAmt, empaqueAmt, total }
}

/* ── Scheduled label ── */
function fmtSchedLabel(scheduledAt) {
  if (!scheduledAt) return null
  const d    = new Date(scheduledAt)
  const now  = new Date()
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  const todayStr    = now.toDateString()
  const tomorrowStr = new Date(now.getTime() + 86400000).toDateString()
  if (d.toDateString() === todayStr)    return `📅 Hoy ${time}`
  if (d.toDateString() === tomorrowStr) return `📅 Mañana ${time}`
  return `📅 ${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} ${time}`
}

/* ── Init charge state from order ── */
function initCharges(order) {
  return {
    delivery: order.charges?.delivery ?? 0,
    tipMode:  order.charges?.tipMode  ?? '%',
    tipVal:   order.charges?.tipVal   ?? 0,
    servicio: order.charges?.servicio ?? 0,
    empaque:  order.charges?.empaque  ?? 0,
  }
}

/* ── Sub-components ── */
function ModeToggle({ mode, onMode }) {
  return (
    <div className="dp-mode-toggle">
      <button
        type="button"
        className={mode === '%' ? 'active' : ''}
        onClick={() => onMode('%')}
      >%</button>
      <button
        type="button"
        className={mode === '$' ? 'active' : ''}
        onClick={() => onMode('$')}
      >$</button>
    </div>
  )
}

const TYPE_OPTIONS = [
  { value: 'flash',    label: '⚡ Pedido Flash' },
  { value: 'local',    label: '🏪 En el local'  },
  { value: 'llevar',   label: '🛍️ Para llevar'  },
  { value: 'delivery', label: '🛵 Delivery'      },
  { value: 'mesa',     label: '🪑 Mesa'          },
]

/* ── Main component ── */
export default function DetailPanel({ order, onClose, onAction, onDelete, onUpdate, onAddProducts, onTypeChange, categories, modifierGroups }) {
  useTick()
  const { clients, registerClientFromOrder } = useClients()
  const { deliveryZones } = useSettings()

  /* Print state */
  const [printMode,  setPrintMode]  = useState(null)   // null | 'cocina' | 'cliente'
  const [printOpen,  setPrintOpen]  = useState(false)  // popover visible
  const printPopoverRef = useRef(null)

  /* 1) Disparar window.print() después de que React haya pintado el ticket */
  useEffect(() => {
    if (!printMode) return
    const timer = setTimeout(() => window.print(), 150)
    return () => clearTimeout(timer)
  }, [printMode])

  /* 2) Resetear printMode cuando el diálogo de impresión se cierre (o se cancele) */
  useEffect(() => {
    const handler = () => setPrintMode(null)
    window.addEventListener('afterprint', handler)
    return () => window.removeEventListener('afterprint', handler)
  }, [])

  /* Cerrar popover al hacer clic fuera */
  useEffect(() => {
    if (!printOpen) return
    const handler = (e) => {
      if (printPopoverRef.current && !printPopoverRef.current.contains(e.target)) {
        setPrintOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [printOpen])

  const [charges,        setCharges]        = useState(() => initCharges(order))
  const [discountMode,   setDiscountMode]   = useState(() => order.discountMode ?? '%')
  const [discountVal,    setDiscountVal]    = useState(() => order.discountVal  ?? 0)
  const [comments,       setComments]       = useState(() => order.comments     ?? '')
  const [schedEdit,      setSchedEdit]      = useState(false)
  const [schedDay,       setSchedDay]       = useState('today')
  const [schedCustomDate, setSchedCustomDate] = useState('')
  const [schedTime,      setSchedTime]      = useState(() => {
    if (!order.scheduledAt) return ''
    const d = new Date(order.scheduledAt)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  })

  /* Type editor state */
  const [typeEdit,       setTypeEdit]       = useState(false)
  const [editType,       setEditType]       = useState(order.type)
  const [editSched,      setEditSched]      = useState(() => order.scheduledAt ? 'scheduled' : 'immediate')
  const [editSchedDay,   setEditSchedDay]   = useState('today')
  const [editSchedDate,  setEditSchedDate]  = useState('')
  const [editSchedTime,  setEditSchedTime]  = useState(() => {
    if (!order.scheduledAt) return ''
    const d = new Date(order.scheduledAt)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  })
  const [editAddr,       setEditAddr]       = useState(() => order.client?.addr ?? '')

  /* Client inline editor state */
  const [isEditingClient,    setIsEditingClient]    = useState(false)
  const [editPhone,          setEditPhone]          = useState('')
  const [editName,           setEditName]           = useState('')
  const [editClientAddr,     setEditClientAddr]     = useState('')
  const [editClientAddresses,setEditClientAddresses]= useState([])
  const [showPhoneSug,       setShowPhoneSug]       = useState(false)
  const [showNameSug,        setShowNameSug]        = useState(false)
  const [showAddrDrop,       setShowAddrDrop]       = useState(false)

  /* Item editing */
  const [editingItemIdx,    setEditingItemIdx]    = useState(null)
  const [editingProduct,    setEditingProduct]    = useState(null)
  const [editingInitValues, setEditingInitValues] = useState(null)

  /* Normalize phone: strip all non-digits and the 56 country prefix */
  const normalizePhone = (raw = '') => {
    const digits = raw.replace(/\D/g, '')
    return digits.startsWith('56') && digits.length > 9 ? digits.slice(2) : digits
  }

  /* Live client search for inline editor */
  const phoneSuggestions = useMemo(() => {
    const q = normalizePhone(editPhone)
    if (!q) return []
    return clients.filter(c => normalizePhone(c.phone).includes(q)).slice(0, 5)
  }, [clients, editPhone])

  const nameSuggestions = useMemo(() => {
    const q = editName.trim().toLowerCase()
    if (q.length < 2) return []
    return clients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 5)
  }, [clients, editName])

  const handleSelectSuggestion = (c) => {
    const rawPhone = normalizePhone(c.phone)
    setEditPhone(rawPhone)
    setEditName(c.name)
    setEditClientAddresses(Array.isArray(c.addresses) ? c.addresses : [])
    setEditClientAddr('')
    setShowPhoneSug(false)
    setShowNameSug(false)
    setShowAddrDrop(false)
  }

  const openClientEdit = () => {
    setEditPhone(normalizePhone(order.client?.phone ?? ''))
    setEditName(order.client?.name ?? '')
    setEditClientAddr(order.client?.addr ?? '')
    setEditClientAddresses([])
    setShowPhoneSug(false)
    setShowNameSug(false)
    setShowAddrDrop(false)
    setIsEditingClient(true)
  }

  const handleSaveClient = () => {
    const newClient = {
      name:  editName.trim(),
      phone: editPhone.trim(),
      addr:  editClientAddr.trim(),
    }
    onUpdate(order.id, { client: newClient })
    if (newClient.phone) {
      registerClientFromOrder(newClient, 'PDV')
    }
    setIsEditingClient(false)
  }

  /* Reset local state when a different order is selected */
  useEffect(() => {
    setCharges(initCharges(order))
    setDiscountMode(order.discountMode ?? '%')
    setDiscountVal(order.discountVal   ?? 0)
    setComments(order.comments         ?? '')
    setSchedEdit(false)
    setSchedDay('today')
    setSchedCustomDate('')
    setSchedTime(order.scheduledAt
      ? (() => { const d = new Date(order.scheduledAt); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` })()
      : '')
    setTypeEdit(false)
    setEditType(order.type)
    setEditSched(order.scheduledAt ? 'scheduled' : 'immediate')
    setEditSchedDay('today')
    setEditSchedDate('')
    setEditSchedTime(order.scheduledAt
      ? (() => { const d = new Date(order.scheduledAt); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` })()
      : '')
    setEditAddr(order.client?.addr ?? '')
    setEditingItemIdx(null)
    setEditingProduct(null)
    setEditingInitValues(null)
  }, [order.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { subtotal, discountAmt, subtotalNet, tipAmt, deliveryAmt, servicioAmt, empaqueAmt, total } =
    computeAmounts(order.items, charges, discountMode, discountVal)

  /* Push charges/discount changes to parent so OrderRow total stays in sync */
  const pushCharges = (newCharges, newDiscMode, newDiscVal) => {
    const { total: newTotal } = computeAmounts(order.items, newCharges, newDiscMode, newDiscVal)
    onUpdate(order.id, {
      charges:      newCharges,
      discountMode: newDiscMode,
      discountVal:  newDiscVal,
      total:        newTotal,
    })
  }

  const updateCharge = (key, val) => {
    if (charges[key] === val) return
    const next = { ...charges, [key]: val }
    setCharges(next)
    pushCharges(next, discountMode, discountVal)
  }

  /* ── Delivery Pricing dynamic calc ── */
  const computeDeliveryCost = useCallback(async (addr) => {
    if (!addr.trim()) return null
    return await calculateDeliveryPrice(addr.trim(), deliveryZones)
  }, [deliveryZones])

  useEffect(() => {
    let active = true

    if (editType !== 'delivery') {
      setTimeout(() => { if (active) updateCharge('delivery', 0) }, 0)
      return () => { active = false }
    }

    if (!editAddr.trim()) {
      setTimeout(() => { if (active) updateCharge('delivery', 0) }, 0)
      return () => { active = false }
    }

    const timer = setTimeout(async () => {
      const price = await computeDeliveryCost(editAddr)
      if (active) {
        updateCharge('delivery', price !== null ? price : 0)
      }
    }, 800)

    return () => {
      active = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editType, editAddr, computeDeliveryCost])

  const updateDiscountMode = (mode) => {
    setDiscountMode(mode)
    pushCharges(charges, mode, discountVal)
  }

  const updateDiscountVal = (val) => {
    setDiscountVal(val)
    pushCharges(charges, discountMode, val)
  }

  const handleCommentsBlur = () => {
    onUpdate(order.id, { comments })
  }

  const saveSchedEdit = () => {
    if (!schedTime) { setSchedEdit(false); return }
    const today    = new Date()
    const tomorrow = new Date(today.getTime() + 86400000)
    let base
    if (schedDay === 'today')    base = new Date(today)
    else if (schedDay === 'tomorrow') base = new Date(tomorrow)
    else base = schedCustomDate ? new Date(schedCustomDate) : new Date(today)
    const [h, m] = schedTime.split(':').map(Number)
    base.setHours(h, m, 0, 0)
    onUpdate(order.id, { scheduledAt: base })
    setSchedEdit(false)
  }

  const handleDelete = () => {
    if (window.confirm(`¿Eliminar el pedido #${order.num}?`)) {
      onDelete(order.id)
      onClose()
    }
  }

  const openTypeEdit = () => {
    setEditType(order.type)
    setEditSched(order.scheduledAt ? 'scheduled' : 'immediate')
    setEditSchedDay('today')
    setEditSchedDate('')
    setEditSchedTime(order.scheduledAt
      ? (() => { const d = new Date(order.scheduledAt); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` })()
      : '')
    setEditAddr(order.client?.addr ?? '')
    setTypeEdit(true)
  }

  const saveTypeEdit = () => {
    const changes = { type: editType }
    if (editSched === 'immediate') {
      changes.scheduledAt = null
    } else if (editSchedTime) {
      const today    = new Date()
      const tomorrow = new Date(today.getTime() + 86400000)
      let base
      if (editSchedDay === 'today')    base = new Date(today)
      else if (editSchedDay === 'tomorrow') base = new Date(tomorrow)
      else base = editSchedDate ? new Date(editSchedDate) : new Date(today)
      const [h, m] = editSchedTime.split(':').map(Number)
      base.setHours(h, m, 0, 0)
      changes.scheduledAt = base
    }
    if (editType === 'delivery' && editAddr.trim()) {
      changes.client = { ...(order.client ?? {}), addr: editAddr.trim() }
    }
    onTypeChange(order.id, changes)
    setTypeEdit(false)
  }

  const handleRemoveItem = (idx) => {
    const newItems = order.items.filter((_, i) => i !== idx)
    const { total: newTotal } = computeAmounts(newItems, charges, discountMode, discountVal)
    onUpdate(order.id, { items: newItems, total: newTotal })
  }

  const handleOpenEditItem = (idx) => {
    const item = order.items[idx]

    // Flat list of all products across all categories
    const allProducts = (categories ?? []).flatMap(c => c.products ?? [])

    // 1. Exact match by productId (new items) or id (seed/legacy items)
    let product = allProducts.find(p => p.id === (item.productId ?? item.id))

    // 2. Fallback: match by name (handles ID mismatch edge cases)
    if (!product) product = allProducts.find(p => p.name === item.name)

    if (!product) {
      window.alert('No se puede editar este ítem: producto no encontrado en el menú.')
      return
    }

    const itemModGroups = (product.modifierGroupIds ?? [])
      .map(id => (modifierGroups ?? []).find(mg => mg.id === id))
      .filter(mg => mg && mg.is_active !== false)

    const reconstructedMods = {}
    const hasModifiers = item.modifiers?.length > 0

    itemModGroups.forEach((modGroup, mi) => {
      if (hasModifiers) {
        // New items: modifiers is [{name, price}] — use directly
        if (!modGroup.multiple) {
          const match = item.modifiers.find(m =>
            (modGroup.options ?? []).some(o => o.name === m.name)
          )
          if (match) reconstructedMods[mi] = { name: match.name, price: match.price ?? 0 }
        } else {
          const matches = item.modifiers.filter(m =>
            (modGroup.options ?? []).some(o => o.name === m.name)
          )
          if (matches.length > 0)
            reconstructedMods[mi] = matches.map(m => ({ name: m.name, price: m.price ?? 0 }))
        }
      } else {
        // Legacy/seed items: mods is string[] — look up prices from the group definition
        if (!modGroup.multiple) {
          const match = (modGroup.options ?? []).find(o => (item.mods ?? []).includes(o.name))
          if (match) reconstructedMods[mi] = { name: match.name, price: match.price ?? 0 }
        } else {
          const matches = (modGroup.options ?? []).filter(o => (item.mods ?? []).includes(o.name))
          if (matches.length > 0)
            reconstructedMods[mi] = matches.map(o => ({ name: o.name, price: o.price ?? 0 }))
        }
      }
    })

    const variantIdx = item.variant
      ? (product.variants ?? []).findIndex(v => v.name === item.variant)
      : null

    setEditingItemIdx(idx)
    setEditingProduct(product)
    setEditingInitValues({
      qty:          item.qty,
      note:         item.note ?? '',
      variantIdx:   variantIdx !== -1 ? variantIdx : null,
      selectedMods: reconstructedMods,
    })
  }

  const handleEditItemConfirm = (newItemData) => {
    const flatMods = newItemData.modifiers ?? []
    const newItems = order.items.map((item, i) => {
      if (i !== editingItemIdx) return item
      return {
        ...item,
        name:      newItemData.name,
        variant:   newItemData.variant ?? null,
        qty:       newItemData.qty,
        price:     newItemData.price,
        modifiers: flatMods,
        mods:      flatMods.map(m => m.name),
        total:     newItemData.price * newItemData.qty,
        note:      newItemData.note ?? null,
      }
    })
    const { total: newTotal } = computeAmounts(newItems, charges, discountMode, discountVal)
    onUpdate(order.id, { items: newItems, total: newTotal })
    setEditingItemIdx(null)
    setEditingProduct(null)
    setEditingInitValues(null)
  }

  /* ── Derived ── */
  const tc          = TYPE_CONFIG[order.type]    ?? { icon: '📋', label: order.type }
  const state       = ORDER_STATES[order.status] ?? ORDER_STATES.pend
  const isDone      = order.status === 'finalizado' || order.status === 'cancelado'
  const canEditType = order.status === 'pend' || order.status === 'preparacion'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={onClose} />
      <aside className="detail-panel !fixed !top-0 !right-0 !h-screen !w-[450px] !bg-white !shadow-2xl !z-50 overflow-y-auto">
      {/* ── Header ── */}
      <div
        className="dp-header"
        style={{ background: state.headerBg, borderBottomColor: state.headerBorder }}
      >
        <div className="dp-header-top">
          <div className="dp-header-left">
            <span className="dp-order-num !text-xl !font-extrabold">#{order.num}</span>
            <span className={`dp-badge ${state.badgeCls} !text-xs !font-bold`}>{state.label}</span>
            {!order.scheduledAt && !schedEdit && (
              <button
                className="dp-sched-badge dp-sched-badge--empty"
                onClick={() => setSchedEdit(true)}
                title="Programar pedido"
              >
                📅 Programar
              </button>
            )}
            {order.scheduledAt && !schedEdit && (
              <button
                className="dp-sched-badge"
                onClick={() => setSchedEdit(true)}
                title="Editar hora programada"
              >
                {fmtSchedLabel(order.scheduledAt)}
              </button>
            )}
          </div>
          <div className="dp-header-actions">
            {/* ── Print button + popover ── */}
            <div className="dp-print-wrap" ref={printPopoverRef}>
              <button
                className="dp-print-btn"
                title="Imprimir ticket"
                onClick={() => setPrintOpen(v => !v)}
              >
                <IconPrinter />
              </button>
              {printOpen && (
                <div className="dp-print-popover" role="menu">
                  <button
                    className="dp-print-option"
                    role="menuitem"
                    onClick={() => { setPrintOpen(false); setPrintMode('cocina') }}
                  >
                    🍕 Ticket de cocina
                  </button>
                  <button
                    className="dp-print-option"
                    role="menuitem"
                    onClick={() => { setPrintOpen(false); setPrintMode('cliente') }}
                  >
                    🧾 Ticket de cliente
                  </button>
                </div>
              )}
            </div>
            <button className="dp-close" onClick={onClose} title="Cerrar">
              <IconX />
            </button>
          </div>
        </div>
        {schedEdit && (
          <div className="dp-sched-inline">
            <div className="dp-sched-day-time-row">
              <span className="dp-sched-label">Día</span>
              <select
                className="dp-sched-sel"
                value={schedDay}
                onChange={e => setSchedDay(e.target.value)}
              >
                <option value="today">Hoy</option>
                <option value="tomorrow">Mañana</option>
                <option value="custom">Fecha…</option>
              </select>
              <span className="dp-sched-label">Hora</span>
              <input
                type="time"
                className="dp-sched-inp dp-sched-time"
                value={schedTime}
                onChange={e => setSchedTime(e.target.value)}
              />
              <button className="dp-sched-save" onClick={saveSchedEdit}>✓</button>
              <button className="dp-sched-cancel" onClick={() => setSchedEdit(false)}>✕</button>
            </div>
            {schedDay === 'custom' && (
              <input
                type="date"
                className="dp-sched-inp dp-sched-date-inp"
                value={schedCustomDate}
                onChange={e => setSchedCustomDate(e.target.value)}
              />
            )}
          </div>
        )}
        <div className="dp-header-sub">
          <span className="dp-type-row !text-sm !font-semibold">
            <span>{tc.icon}</span>
            <span>{tc.label}</span>
            {canEditType && !typeEdit && (
              <button
                className="dp-type-edit-btn"
                onClick={openTypeEdit}
                title="Editar tipo de pedido"
              >
                ✏️
              </button>
            )}
          </span>
          <span className="dp-header-meta">
            {agoText(order.createdAt)} · {order.origin ?? 'PDV'}
          </span>
        </div>
      </div>

      {/* ── Inline type editor ── */}
      {typeEdit && (
        <div className="dp-type-editor">
          <div className="dp-te-title">Editar pedido</div>

          <div className="dp-te-row">
            <label className="dp-te-label">Tipo de servicio</label>
            <select
              className="dp-te-select"
              value={editType}
              onChange={e => setEditType(e.target.value)}
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {editType === 'delivery' && (
            <div className="dp-te-row">
              <label className="dp-te-label">Dirección</label>
              <input
                className="dp-te-input"
                placeholder="Calle, número, piso…"
                value={editAddr}
                onChange={e => setEditAddr(e.target.value)}
              />
            </div>
          )}

          <div className="dp-te-row">
            <label className="dp-te-label">Fecha de entrega</label>
            <div className="dp-te-radios">
              <label className="dp-te-radio">
                <input
                  type="radio"
                  value="immediate"
                  checked={editSched === 'immediate'}
                  onChange={() => setEditSched('immediate')}
                />
                <span>Lo antes posible</span>
              </label>
              <label className="dp-te-radio">
                <input
                  type="radio"
                  value="scheduled"
                  checked={editSched === 'scheduled'}
                  onChange={() => setEditSched('scheduled')}
                />
                <span>Programar para después</span>
              </label>
            </div>
          </div>

          {editSched === 'scheduled' && (
            <div className="dp-te-sched-fields">
              <div className="dp-te-day-time-row">
                <span className="dp-te-sched-lbl">Día</span>
                <select
                  className="dp-te-select dp-te-select--day"
                  value={editSchedDay}
                  onChange={e => setEditSchedDay(e.target.value)}
                >
                  <option value="today">Hoy</option>
                  <option value="tomorrow">Mañana</option>
                  <option value="custom">Fecha…</option>
                </select>
                <span className="dp-te-sched-lbl">Hora</span>
                <input
                  type="time"
                  className="dp-te-input dp-te-input--time"
                  value={editSchedTime}
                  onChange={e => setEditSchedTime(e.target.value)}
                />
              </div>
              {editSchedDay === 'custom' && (
                <input
                  type="date"
                  className="dp-te-input"
                  value={editSchedDate}
                  onChange={e => setEditSchedDate(e.target.value)}
                />
              )}
            </div>
          )}

          <div className="dp-te-actions">
            <button className="dp-te-btn dp-te-btn--cancel" onClick={() => setTypeEdit(false)}>
              Cancelar
            </button>
            <button className="dp-te-btn dp-te-btn--save" onClick={saveTypeEdit}>
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div className="dp-body">

        {/* ── Client ── */}
        <div className="dp-section dp-client-block">
          {!isEditingClient ? (
            /* ── Static view ── */
            <div className="dp-client-row">
              <IconUser />
              <div style={{ flex: 1 }}>
                <span className="dp-client-name !text-base !font-semibold">{order.client?.name || '—'}</span>
                {order.client?.phone && (
                  <span className="dp-client-phone !text-sm">{fmtPhone(order.client.phone)}</span>
                )}
                {order.client?.addr && (
                  <span className="dp-client-addr !text-sm">{order.client.addr}</span>
                )}
              </div>
              {!isDone && (
                <button
                  className="dp-client-edit-btn"
                  onClick={openClientEdit}
                  title="Editar cliente"
                >
                  ✏️
                </button>
              )}
            </div>
          ) : (
            /* ── Inline editor ── */
            <div className="dp-client-editor">
              {/* Phone */}
              <div className="dp-ce-field" style={{ position: 'relative' }}>
                <div className="dp-ce-phone-row">
                  <span className="dp-ce-prefix">🇨🇱 +56</span>
                  <input
                    className="dp-ce-input"
                    placeholder="912345678"
                    maxLength={9}
                    value={editPhone}
                    onChange={e => { setEditPhone(e.target.value.replace(/\D/g,'')); setShowPhoneSug(true); setEditClientAddresses([]) }}
                    onFocus={() => setShowPhoneSug(true)}
                    onBlur={() => setTimeout(() => setShowPhoneSug(false), 150)}
                    autoComplete="off"
                  />
                </div>
                {showPhoneSug && editPhone.length > 0 && (
                  <div className="dp-ce-suggestions">
                    <div className="dp-ce-sug-new" onMouseDown={() => { setShowPhoneSug(false); setEditClientAddresses([]) }}>
                      👤 &ldquo;{editPhone}&rdquo;
                      <span className="dp-ce-sug-new-lbl">Nuevo</span>
                    </div>
                    {phoneSuggestions.length > 0 && <div className="dp-ce-sug-sep">({phoneSuggestions.length}) Resultados</div>}
                    {phoneSuggestions.map(c => (
                      <div key={c.id} className="dp-ce-sug-item" onMouseDown={() => handleSelectSuggestion(c)}>
                        <div className="dp-ce-sug-name">{c.name}</div>
                        <div className="dp-ce-sug-meta">{c.phone} · {c.segment}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="dp-ce-field" style={{ position: 'relative' }}>
                <input
                  className="dp-ce-input"
                  placeholder="Nombre del cliente"
                  value={editName}
                  onChange={e => { setEditName(e.target.value); setShowNameSug(true); setEditClientAddresses([]) }}
                  onFocus={() => setShowNameSug(true)}
                  onBlur={() => setTimeout(() => setShowNameSug(false), 150)}
                  autoComplete="off"
                />
                {showNameSug && editName.length >= 2 && (
                  <div className="dp-ce-suggestions">
                    <div className="dp-ce-sug-new" onMouseDown={() => { setShowNameSug(false); setEditClientAddresses([]) }}>
                      👤 &ldquo;{editName}&rdquo;
                      <span className="dp-ce-sug-new-lbl">Nuevo</span>
                    </div>
                    {nameSuggestions.length > 0 && <div className="dp-ce-sug-sep">({nameSuggestions.length}) Resultados</div>}
                    {nameSuggestions.map(c => (
                      <div key={c.id} className="dp-ce-sug-item" onMouseDown={() => handleSelectSuggestion(c)}>
                        <div className="dp-ce-sug-name">{c.name}</div>
                        <div className="dp-ce-sug-meta">{c.phone} · {c.segment}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Address (delivery only) */}
              {order.type === 'delivery' && (
                <div className="dp-ce-field" style={{ position: 'relative' }}>
                  {editClientAddresses.length > 0 ? (
                    <>
                      <button type="button" className="dp-ce-addr-btn" onClick={() => setShowAddrDrop(v => !v)}>
                        <span>{editClientAddr || 'Seleccionar dirección…'}</span>
                        <span>{showAddrDrop ? '▲' : '▼'}</span>
                      </button>
                      {showAddrDrop && (
                        <div className="dp-ce-suggestions">
                          <div className="dp-ce-sug-new" onMouseDown={() => { setEditClientAddr(''); setShowAddrDrop(false) }}>✏️ Agregar dirección</div>
                          {editClientAddresses.map((a, i) => (
                            <div key={i} className={`dp-ce-sug-item${editClientAddr === a ? ' dp-ce-sug-item--sel' : ''}`} onMouseDown={() => { setEditClientAddr(a); setShowAddrDrop(false) }}>
                              📍 {a}
                            </div>
                          ))}
                        </div>
                      )}
                      {(!editClientAddr || !editClientAddresses.includes(editClientAddr)) && (
                        <input className="dp-ce-input" placeholder="Dirección de entrega" value={editClientAddr} onChange={e => setEditClientAddr(e.target.value)} />
                      )}
                    </>
                  ) : (
                    <input className="dp-ce-input" placeholder="Dirección de entrega" value={editClientAddr} onChange={e => setEditClientAddr(e.target.value)} />
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="dp-ce-actions">
                <button className="dp-ce-btn dp-ce-btn--cancel" onClick={() => setIsEditingClient(false)}>Cancelar</button>
                <button className="dp-ce-btn dp-ce-btn--save" onClick={handleSaveClient}>Guardar cliente</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Products ── */}
        <div className="dp-section dp-items-section">
          <div className="dp-section-head">
            <span className="dp-section-label">Productos</span>
            {!isDone && (
              <button
                className="dp-add-products-btn"
                onClick={() => onAddProducts(order.id)}
              >
                + Agregar
              </button>
            )}
          </div>
          {order.items.length === 0 ? (
            <p className="dp-no-items">Sin productos aún.</p>
          ) : (
            <div className="dp-items">
              {order.items.map((item, i) => (
                <div key={`${item.id}-${i}`} className="dp-item">
                  <div className="dp-item-qty !text-sm !font-bold">{item.qty}×</div>
                  <div className="dp-item-info">
                    <span className="dp-item-name !text-base !font-semibold">{item.name}</span>
                    {item.variant && <span className="dp-item-variant !text-sm">{item.variant}</span>}
                    {((item.mods?.length > 0) || (item.modifiers?.length > 0)) && (
                      <span className="dp-item-mods !text-xs">
                        <span className="dp-item-extra-lbl">Extra: </span>
                        {(item.mods?.length > 0
                          ? item.mods
                          : item.modifiers.map(m => m.name)
                        ).join(', ')}
                      </span>
                    )}
                    {item.note && (
                      <span className="dp-item-note !text-xs">📝 {item.note}</span>
                    )}
                  </div>
                  <span className="dp-item-price !text-base !font-bold">{fmt(item.total)}</span>
                  {!isDone && (
                    <div className="dp-item-actions">
                      <button
                        className="dp-item-action dp-item-action--edit"
                        onClick={() => handleOpenEditItem(i)}
                        title="Editar ítem"
                      >✏️</button>
                      <button
                        className="dp-item-action dp-item-action--remove"
                        onClick={() => handleRemoveItem(i)}
                        title="Eliminar ítem"
                      >×</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Comments ── */}
        <div className="dp-section dp-comments-section">
          <span className="dp-section-label">💬 Comentarios</span>
          <textarea
            className="dp-comments-input"
            rows={2}
            placeholder="Sin gluten, tocar el timbre…"
            value={comments}
            onChange={e => setComments(e.target.value)}
            onBlur={handleCommentsBlur}
            readOnly={isDone}
          />
        </div>

        {/* ── Cargos adicionales ── */}
        {!isDone && (
          <div className="dp-section dp-charges-section">
            <span className="dp-section-label">Cargos adicionales</span>

            {/* Delivery */}
            <div className="dp-charge-row">
              <span className="dp-charge-lbl">🛵 Delivery</span>
              <div className="dp-charge-input-wrap">
                <span className="dp-charge-pfx">$</span>
                <input
                  className="dp-charge-inp"
                  type="number" min="0"
                  value={charges.delivery}
                  onChange={e => updateCharge('delivery', Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Propina */}
            <div className="dp-charge-row">
              <span className="dp-charge-lbl">🎁 Propina</span>
              <div className="dp-charge-input-wrap dp-charge-input-wrap--tip">
                <ModeToggle mode={charges.tipMode} onMode={m => updateCharge('tipMode', m)} />
                <div className="dp-charge-input-wrap">
                  {charges.tipMode === '$' && <span className="dp-charge-pfx">$</span>}
                  <input
                    className={`dp-charge-inp${charges.tipMode === '$' ? ' dp-charge-inp--dollar' : ''}`}
                    type="number" min="0"
                    value={charges.tipVal}
                    onChange={e => updateCharge('tipVal', Number(e.target.value) || 0)}
                    placeholder={charges.tipMode === '%' ? '0' : '0'}
                  />
                  {charges.tipMode === '%' && <span className="dp-charge-sfx">%</span>}
                </div>
              </div>
            </div>

            {/* Servicio */}
            <div className="dp-charge-row">
              <span className="dp-charge-lbl">🍽️ Servicio</span>
              <div className="dp-charge-input-wrap">
                <span className="dp-charge-pfx">$</span>
                <input
                  className="dp-charge-inp"
                  type="number" min="0"
                  value={charges.servicio}
                  onChange={e => updateCharge('servicio', Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Empaque */}
            <div className="dp-charge-row">
              <span className="dp-charge-lbl">📦 Empaque</span>
              <div className="dp-charge-input-wrap">
                <span className="dp-charge-pfx">$</span>
                <input
                  className="dp-charge-inp"
                  type="number" min="0"
                  value={charges.empaque}
                  onChange={e => updateCharge('empaque', Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Descuento ── */}
        {!isDone && (
          <div className="dp-section dp-discount-section">
            <span className="dp-section-label">Descuento</span>
            <div className="dp-charge-row">
              <ModeToggle mode={discountMode} onMode={updateDiscountMode} />
              <div className="dp-charge-input-wrap">
                {discountMode === '$' && <span className="dp-charge-pfx">$</span>}
                <input
                  className={`dp-charge-inp${discountMode === '$' ? ' dp-charge-inp--dollar' : ''}`}
                  type="number" min="0"
                  value={discountVal}
                  onChange={e => updateDiscountVal(Number(e.target.value) || 0)}
                  placeholder="0"
                />
                {discountMode === '%' && <span className="dp-charge-sfx">%</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── Totals ── */}
        <div className="dp-section dp-totals-section">
          <div className="dp-total-row">
            <span>Subtotal productos</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {discountAmt > 0 && (
            <div className="dp-total-row dp-total-row--discount">
              <span>Descuento</span>
              <span>−{fmt(discountAmt)}</span>
            </div>
          )}
          <div className="dp-total-divider" />
          <div className="dp-total-row">
            <span>Subtotal neto</span>
            <span>{fmt(subtotalNet)}</span>
          </div>
          {deliveryAmt > 0 && (
            <div className="dp-total-row dp-total-row--charge">
              <span>Delivery</span>
              <span>{fmt(deliveryAmt)}</span>
            </div>
          )}
          {tipAmt > 0 && (
            <div className="dp-total-row dp-total-row--charge">
              <span>Propina</span>
              <span>{fmt(tipAmt)}</span>
            </div>
          )}
          {servicioAmt > 0 && (
            <div className="dp-total-row dp-total-row--charge">
              <span>Servicio</span>
              <span>{fmt(servicioAmt)}</span>
            </div>
          )}
          {empaqueAmt > 0 && (
            <div className="dp-total-row dp-total-row--charge">
              <span>Empaque</span>
              <span>{fmt(empaqueAmt)}</span>
            </div>
          )}
          <div className="dp-total-divider" />
          <div className="dp-total-row dp-total-row--final !text-lg !font-extrabold">
            <span>TOTAL</span>
            <span>{fmt(total)}</span>
          </div>

          {/* Payment method */}
          <div className="dp-payment-methods">
            {order.paid ? (
              <div className="dp-paid-row" onClick={() => onAction(order.id, 'pay')} style={{ cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = 0.8} onMouseOut={e => e.currentTarget.style.opacity = 1} title="Editar método de pago">
                <span className="dp-payment-method-label">
                  {PAYMENT_METHODS.find(m => m.id === order.paymentMethod)?.icon ?? '💳'}{' '}
                  {order.paymentMethod}
                </span>
                <span className="dp-paid-badge">✓ Cobrado ✏️</span>
              </div>
            ) : (
              <div className="dp-method-btns">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    className={`dp-method-chip${order.paymentMethod === m.id ? ' dp-method-chip--active' : ''}`}
                    onClick={() => onUpdate(order.id, { paymentMethod: m.id })}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>{/* end dp-body */}

      {/* ── Footer ── */}
      <div className="dp-footer" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          {(order.status === 'pend' || order.status === 'preparacion' || order.status === 'listo') && (
            <button className="dp-btn dp-btn--cancel !text-sm !font-bold" style={{ flex: 1 }} onClick={() => onAction(order.id, 'cancel')}>
              Cancelar
            </button>
          )}
          {(order.status === 'pend' || order.status === 'preparacion' || order.status === 'listo') && !order.paid && (
            <button className="dp-btn dp-btn--pay !text-sm !font-bold" style={{ flex: 1 }} onClick={() => onAction(order.id, 'pay')}>
              Cobrar
            </button>
          )}

          {(order.status === 'pend' || order.status === 'preparacion') && (
            <button className="dp-btn !text-sm !font-bold" style={{ flex: 1.5, background: '#2563eb', color: '#fff', border: 'none' }} onClick={() => onUpdate(order.id, { status: 'listo' })}>
              Listo!
            </button>
          )}
          {order.status === 'listo' && (
            <button className="dp-btn dp-btn--cancel !text-sm !font-bold" style={{ flex: 1.5, borderColor: '#2563eb', color: '#2563eb' }} onClick={() => onUpdate(order.id, { status: 'preparacion' })}>
              ← Preparación
            </button>
          )}
        </div>

        {(order.status === 'pend' || order.status === 'preparacion' || order.status === 'listo') && (
          <button 
            className="dp-btn !text-base !font-extrabold" 
            style={{ width: '100%', background: '#16a34a', color: '#fff', border: 'none', padding: '12px', marginTop: '8px', fontWeight: '700' }} 
            onClick={() => {
              onUpdate(order.id, { status: 'finalizado', closedAt: new Date() });
              onClose();
            }}
          >
            FINALIZAR PEDIDO
          </button>
        )}

        {order.status === 'finalizado' && !order.paid && (
          <button className="dp-btn dp-btn--pay" style={{ width: '100%' }} onClick={() => onAction(order.id, 'pay')}>
            Cobrar
          </button>
        )}

        {(order.status === 'finalizado' || order.status === 'cancelado') && (
          <button className="dp-btn dp-btn--delete" style={{ width: '100%', marginTop: order.status === 'finalizado' && !order.paid ? '8px' : '0' }} onClick={handleDelete}>
            Eliminar pedido
          </button>
        )}
      </div>

      {/* ── Edit item ProductModal ── */}
      {editingProduct && (
        <ProductModal
          product={editingProduct}
          modifierGroups={modifierGroups ?? []}
          editingItem={editingInitValues}
          onAdd={handleEditItemConfirm}
          onClose={() => {
            setEditingItemIdx(null)
            setEditingProduct(null)
            setEditingInitValues(null)
          }}
        />
      )}

      {/* ── Print template: siempre en el DOM cuando printMode activo ── */}
      {printMode && (
        <OrderPrintTemplate order={order} mode={printMode} />
      )}
      </aside>
    </>
  )
}

/* ── Icons ── */
function IconX() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6"  x2="6"  y2="18"/>
      <line x1="6"  y1="6"  x2="18" y2="18"/>
    </svg>
  )
}
function IconUser() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function IconPrinter() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
  )
}
