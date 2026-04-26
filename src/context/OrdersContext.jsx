import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const OrdersContext = createContext(null)

// Mapper: DB -> Frontend
// Canonical frontend field: `paymentMethod` (maps to DB column `payment_method`)
// The legacy alias `payMethod` is intentionally NOT propagated here to prevent
// dual-field confusion in the local state.
function mapOrderFromDB(o) {
  return {
    ...o,
    client:        o.client_snapshot,
    discountMode:  o.discount_mode,
    discountVal:   o.discount_val,
    paymentMethod: o.payment_method,   // single canonical field
    createdAt:     new Date(o.created_at),
    closedAt:      o.closed_at   ? new Date(o.closed_at)   : null,
    scheduledAt:   o.scheduled_at ? new Date(o.scheduled_at) : null,
  }
}

// Mapper: Frontend -> DB
// Only `paymentMethod` is the canonical frontend field; it maps to `payment_method`.
// Any accidental `payMethod` key in the payload is stripped before hitting Supabase.
function mapOrderToDB(o) {
  const dbData = { ...o }

  if (o.client         !== undefined) { dbData.client_snapshot = o.client;        delete dbData.client }
  if (o.discountMode   !== undefined) { dbData.discount_mode   = o.discountMode;  delete dbData.discountMode }
  if (o.discountVal    !== undefined) { dbData.discount_val    = o.discountVal;   delete dbData.discountVal }
  if (o.paymentMethod  !== undefined) { dbData.payment_method  = o.paymentMethod; delete dbData.paymentMethod }

  // Strip all legacy / frontend-only fields that must never reach the DB
  delete dbData.payMethod      // legacy alias — canonical is payment_method
  delete dbData.createdAt      // created_at is a DB default
  delete dbData.closedAt
  delete dbData.scheduledAt

  // Date fields: only include in payload when explicitly supplied
  if (o.closedAt    !== undefined) dbData.closed_at    = o.closedAt    instanceof Date ? o.closedAt.toISOString()    : o.closedAt
  if (o.scheduledAt !== undefined) dbData.scheduled_at = o.scheduledAt instanceof Date ? o.scheduledAt.toISOString() : o.scheduledAt

  return dbData
}

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState([])
  const ordersRef = useRef(orders)

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  const fetchOrders = useCallback(async (start = null, end = null) => {
    let query = supabase
      .from('orders')
      .select('*')

    if (start) {
      // Si recibimos fecha inicio, aplicamos filtro
      query = query.gte('created_at', start.toISOString())
    }
    if (end) {
      // Si recibimos fecha fin, aplicamos filtro
      query = query.lte('created_at', end.toISOString())
    }

    // Siempre ordenamos descendente por creación
    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching orders:', error)
    } else if (data) {
      setOrders(data.map(mapOrderFromDB))
    }
  }, [])

  useEffect(() => {
    // Carga inicial por defecto: "Hoy" (desde 00:00:00 hasta 23:59:59)
    const now = new Date()
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)

    fetchOrders(start, end)

    // Realtime Subscription
    const ordersChannel = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => {
            // Deduplication inside the setOrders to avoid races from optimistic UI
            if (prev.some(o => o.id === payload.new.id)) return prev;
            // Sorting is slightly trickier with prev, but pushing it is safe if we prepend
            const newOrders = [mapOrderFromDB(payload.new), ...prev];
            // Enforce descending sort just in case
            return newOrders.sort((a,b) => b.createdAt - a.createdAt);
          })
        }
        else if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => 
            o.id === payload.new.id ? mapOrderFromDB(payload.new) : o
          ))
        }
        else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ordersChannel)
    }
  }, [])

  const addOrder = useCallback(async (order) => {
    // UI Optimistic insert
    setOrders(prev => [{ deleted: false, ...order, createdAt: new Date() }, ...prev])

    const dbPayload = mapOrderToDB(order)
    const { error } = await supabase.from('orders').insert(dbPayload)
    if (error) {
      console.error('Error adding order:', error)
    }
  }, [])

  const updateOrder = useCallback(async (orderId, changes) => {
    // UI Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...changes } : o))

    const dbPayload = mapOrderToDB(changes)
    const { error } = await supabase.from('orders').update(dbPayload).eq('id', orderId)
    if (error) {
      console.error('Error updating order:', error)
    }
  }, [])

  const deleteOrder = useCallback(async (orderId) => {
    // UI Optimistic soft-delete
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, deleted: true } : o))

    const { error } = await supabase.from('orders').update({ deleted: true }).eq('id', orderId)
    if (error) {
      console.error('Error deleting order:', error)
    }
  }, [])

  const getNextNum = useCallback(() => {
    // Se extrae del estado actual, fallback 1001
    const maxNum = ordersRef.current.length > 0 ? Math.max(...ordersRef.current.map(o => o.num)) : 1000
    return maxNum + 1
  }, [])

  return (
    <OrdersContext.Provider value={{ orders, addOrder, updateOrder, deleteOrder, getNextNum, fetchOrders }}>
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error('useOrders must be used within OrdersProvider')
  return ctx
}
