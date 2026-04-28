import { useState, useMemo, useEffect } from 'react'
import { useMenu } from '../../context/MenuContext'
import { useOrders } from '../../context/OrdersContext'
import { useClients } from '../../context/ClientContext'
import ChannelBar        from '../../components/pdv/ChannelBar'
import FilterBar         from '../../components/pdv/FilterBar'
import OrderList         from '../../components/pdv/OrderList'
import DetailPanel       from '../../components/pdv/DetailPanel'
import OrderTypeModal    from '../../components/pdv/modals/OrderTypeModal'
import OrderBuilderModal from '../../components/pdv/modals/OrderBuilderModal'
import PaymentModal      from '../../components/pdv/modals/PaymentModal'
import { INIT_ADV_FILTERS } from '../../components/pdv/FilterDrawer'
import './PedidosPDV.css'

/* ── Channel → order type mapping ── */
const CHANNEL_TYPES = {
  mostrador: ['local', 'llevar', 'flash'],
  domicilio: ['delivery'],
  mesas:     ['mesa'],
}

const TYPE_TO_CHANNEL = {
  flash:    'mostrador',
  local:    'mostrador',
  llevar:   'mostrador',
  delivery: 'domicilio',
  mesa:     'mesas',
}

export default function PedidosPDV() {
  const { categories, modifierGroups } = useMenu()
  const { orders, addOrder, updateOrder, deleteOrder } = useOrders()
  const { registerClientFromOrder } = useClients()

  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [activeChannel,   setActiveChannel]   = useState('todos')
  const [activeFilter,    setActiveFilter]    = useState('all')
  const [advFilters,      setAdvFilters]      = useState(INIT_ADV_FILTERS)

  /* ── Modal machine ── */
  const [modal,        setModal]        = useState(null)
  const [pendingOrder, setPendingOrder] = useState(null)
  const [payingOrder,  setPayingOrder]  = useState(null)

  /* ── Global Escape handler ── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return
      if (modal) { setModal(null); setPendingOrder(null); setPayingOrder(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modal])

  /* ── Active (non-deleted) orders ── */
  const activeOrders = useMemo(
    () => orders.filter(o => !o.deleted),
    [orders]
  )

  /* ── Derived ── */
  const channelOrders = useMemo(
    () => activeOrders.filter(o => activeChannel === 'todos' || CHANNEL_TYPES[activeChannel]?.includes(o.type)),
    [activeOrders, activeChannel]
  )

  const filteredOrders = useMemo(() => {
    let result = channelOrders

    /* Live PDV flow: implicitly hide finalized and cancelled orders unless requested by advanced filters */
    if (advFilters.statuses.length === 0) {
      result = result.filter(o => o.status !== 'finalizado' && o.status !== 'cancelado')
    }

    if (activeFilter === 'pend')  result = result.filter(o => o.status === 'pend')
    if (activeFilter === 'curso') result = result.filter(o => o.status === 'preparacion' || o.status === 'listo')

    if (advFilters.origins.length  > 0)
      result = result.filter(o => advFilters.origins.includes(o.origin ?? 'PDV'))
    if (advFilters.types.length    > 0)
      result = result.filter(o => advFilters.types.includes(o.type))
    if (advFilters.statuses.length > 0)
      result = result.filter(o => advFilters.statuses.includes(o.status))
    if (advFilters.paid.length     > 0)
      result = result.filter(o =>
        (advFilters.paid.includes('paid')   && o.paid) ||
        (advFilters.paid.includes('unpaid') && !o.paid)
      )
    if (advFilters.scheduled.length > 0)
      result = result.filter(o =>
        (advFilters.scheduled.includes('scheduled') && !!o.scheduledAt) ||
        (advFilters.scheduled.includes('immediate') && !o.scheduledAt)
      )

    return result
  }, [channelOrders, activeFilter, advFilters])

  const channelCounts = useMemo(() => {
    const valid = activeOrders.filter(o => o.status !== 'finalizado' && o.status !== 'cancelado')
    return {
      todos:     valid.length,
      mostrador: valid.filter(o => CHANNEL_TYPES.mostrador.includes(o.type)).length,
      domicilio: valid.filter(o => CHANNEL_TYPES.domicilio.includes(o.type)).length,
      mesas:     valid.filter(o => CHANNEL_TYPES.mesas.includes(o.type)).length,
    }
  }, [activeOrders])

  const filterCounts = useMemo(() => ({
    all:    channelOrders.length,
    pend:   channelOrders.filter(o => o.status === 'pend').length,
    curso:  channelOrders.filter(o => o.status === 'preparacion' || o.status === 'listo').length,
    pdvweb: 0,
  }), [channelOrders])

  const visibleTotal = useMemo(
    () => filteredOrders.reduce((s, o) => s + o.total, 0),
    [filteredOrders]
  )

  const selectedOrder = activeOrders.find(o => o.id === selectedOrderId) ?? null

  /* ── Actions ── */
  const handleOrderAction = (orderId, action) => {
    if (action === 'advance') {
      // Always read from the live `orders` array to avoid stale closures
      // when Supabase realtime events arrive between renders.
      const order = orders.find(o => o.id === orderId && !o.deleted)
      if (!order) return

      if (order.status === 'pend') {
        updateOrder(orderId, { status: 'preparacion' })
      } else if (order.status === 'preparacion') {
        updateOrder(orderId, { status: 'listo' })
      } else if (order.status === 'listo') {
        // Carry forward payment fields so a concurrent realtime event
        // cannot race and wipe them from the local optimistic state.
        updateOrder(orderId, {
          status:        'finalizado',
          closedAt:      new Date(),
          // Preserve payment data that may have been set before this transition
          paid:          order.paid          ?? false,
          paymentMethod: order.paymentMethod ?? null,
        })
        if (selectedOrderId === orderId) setSelectedOrderId(null)
      }
    } else if (action === 'cancel') {
      const order = orders.find(o => o.id === orderId && !o.deleted)
      updateOrder(orderId, {
        status:        'cancelado',
        closedAt:      new Date(),
        paid:          order?.paid          ?? false,
        paymentMethod: order?.paymentMethod ?? null,
      })
    } else if (action === 'pay') {
      const order = orders.find(o => o.id === orderId && !o.deleted)
      if (order) { setPayingOrder(order); setModal('pay') }
    }
  }

  const handleUpdateOrder = (orderId, changes) => updateOrder(orderId, changes)

  const handleAddProducts = (orderId) => {
    const order = activeOrders.find(o => o.id === orderId)
    if (order) { setPendingOrder(order); setModal('builder') }
  }

  const handleDeleteOrder = (orderId) => {
    deleteOrder(orderId)
    if (selectedOrderId === orderId) setSelectedOrderId(null)
  }

  const handleSelectOrder = (id) =>
    setSelectedOrderId(prev => prev === id ? null : id)

  const handleChannelSwitch = (ch) => {
    setActiveChannel(ch)
    setActiveFilter('all')
    const stillVisible = activeOrders
      .filter(o => ch === 'todos' || CHANNEL_TYPES[ch]?.includes(o.type))
      .some(o => o.id === selectedOrderId)
    if (!stillVisible) setSelectedOrderId(null)
  }

  /* ── New order flow ── */
  const handleNewOrder = () => setModal('type')

  const handleTypeChange = (orderId, changes) => {
    updateOrder(orderId, changes)
    if (changes.type) setActiveChannel(TYPE_TO_CHANNEL[changes.type] ?? 'mostrador')
  }

  const handleSelectType = (orderType) => {
    const newOrder = {
      id:          crypto.randomUUID(),
      num:         '---',
      type:        orderType,
      status:      'pend',
      paid:        false,
      items:       [],
      total:       0,
      client:      null,
      createdAt:   new Date(),
      closedAt:    null,
      scheduledAt: null,
      origin:      'PDV',
    }
    setPendingOrder(newOrder)
    setModal('builder')
  }

  const handleBuilderConfirm = (data) => {
    const base = pendingOrder ?? {
      id:        crypto.randomUUID(),
      num:       '---',
      type:      'local',
      status:    'pend',
      paid:      false,
      createdAt: new Date(),
      closedAt:  null,
      origin:    'PDV',
    }

    const newItems = data.items.map(i => ({
      id:        i.id ?? String(i._key),
      productId: i.productId ?? null,
      name:      i.name,
      variant:   i.variant ?? null,
      qty:       i.qty,
      basePrice: i.price,
      modifiers: i.modifiers ?? [],
      mods:      i.mods ?? (i.modifiers ?? []).map(m => typeof m === 'string' ? m : m.name),
      total:     i.price * i.qty,
      note:      i.note ?? null,
    }))

    const isExisting = orders.some(o => o.id === base.id && !o.deleted)

    if (isExisting) {
      const existingOrder = orders.find(o => o.id === base.id)
      const merged = [...existingOrder.items, ...newItems]
      const itemsTotal = merged.reduce((s, i) => s + i.total, 0)
      updateOrder(base.id, { items: merged, total: itemsTotal })
    } else {
      const finalOrder = {
        ...base,
        items:       newItems,
        total:       data.total,
        client:      data.customer
                       ? { name: data.customer.name, phone: data.customer.phone ?? '', addr: data.customer.address ?? '' }
                       : { name: '', phone: '', addr: '' },
        comments:    data.comments ?? null,
        scheduledAt: data.scheduledAt ?? null,
        charges:     data.charges ?? {},
      }
      const targetChannel = TYPE_TO_CHANNEL[finalOrder.type] ?? 'mostrador'
      addOrder(finalOrder)
      // Express client registration: create/update client from order data
      if (finalOrder.client?.phone) {
        registerClientFromOrder(finalOrder.client, 'PDV')
      }
      setSelectedOrderId(finalOrder.id)
      setActiveChannel(targetChannel)
    }

    setModal(null)
    setPendingOrder(null)
  }

  // NOTE: only `paymentMethod` is the canonical field (payMethod was a legacy alias).
  // We capture the order ID at call-time instead of relying on the `payingOrder`
  // closure which could be stale if a realtime event updated the order meanwhile.
  const handlePaymentConfirm = ({ paymentMethod, discount, tip, total: finalTotal }) => {
    const orderId = payingOrder?.id
    if (!orderId) return
    updateOrder(orderId, {
      paid:          true,
      paymentMethod,   // single canonical field → maps to payment_method in DB
      discount,
      tip,
      total:         finalTotal,
    })
    setModal(null)
    setPayingOrder(null)
  }

  return (
    <div className="pdv-page">
      <ChannelBar
        active={activeChannel}
        counts={channelCounts}
        onSelect={handleChannelSwitch}
        onNewOrder={handleNewOrder}
      />

      <FilterBar
        active={activeFilter}
        counts={filterCounts}
        total={visibleTotal}
        onSelect={setActiveFilter}
        advFilters={advFilters}
        onAdvFilter={setAdvFilters}
      />

      <div className="pdv-content">
        <div className="pdv-list-area">
          <OrderList
            orders={filteredOrders}
            selectedId={selectedOrderId}
            onSelect={handleSelectOrder}
            onAction={handleOrderAction}
            onNewOrder={handleNewOrder}
          />
        </div>
      </div>

      {selectedOrder && (
        <DetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrderId(null)}
          onAction={handleOrderAction}
          onDelete={handleDeleteOrder}
          onUpdate={handleUpdateOrder}
          onAddProducts={handleAddProducts}
          onTypeChange={handleTypeChange}
          categories={categories}
          modifierGroups={modifierGroups}
        />
      )}

      {modal === 'type' && (
        <OrderTypeModal
          onSelect={handleSelectType}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'builder' && pendingOrder && (
        <OrderBuilderModal
          mode={orders.some(o => o.id === pendingOrder.id && !o.deleted) ? 'edit' : 'create'}
          orderType={pendingOrder.type}
          orderNum={pendingOrder.num}
          categories={categories}
          modifierGroups={modifierGroups}
          onConfirm={handleBuilderConfirm}
          onClose={() => { setModal(null); setPendingOrder(null) }}
        />
      )}

      {modal === 'pay' && payingOrder && (
        <PaymentModal
          order={payingOrder}
          onConfirm={handlePaymentConfirm}
          onClose={() => { setModal(null); setPayingOrder(null) }}
        />
      )}
    </div>
  )
}
