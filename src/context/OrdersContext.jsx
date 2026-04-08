import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const OrdersContext = createContext(null)

// Mapper: DB -> Frontend
function mapOrderFromDB(o) {
  return {
    ...o,
    client: o.client_snapshot,
    discountMode: o.discount_mode,
    discountVal: o.discount_val,
    paymentMethod: o.payment_method,
    payMethod: o.payment_method, // legacy UI compatibility
    createdAt: new Date(o.created_at),
    closedAt: o.closed_at ? new Date(o.closed_at) : null,
    scheduledAt: o.scheduled_at ? new Date(o.scheduled_at) : null,
  }
}

// Mapper: Frontend -> DB
function mapOrderToDB(o) {
  const dbData = { ...o }
  
  if (o.client !== undefined) { dbData.client_snapshot = o.client; delete dbData.client }
  if (o.discountMode !== undefined) { dbData.discount_mode = o.discountMode; delete dbData.discountMode }
  if (o.discountVal !== undefined) { dbData.discount_val = o.discountVal; delete dbData.discountVal }
  if (o.paymentMethod !== undefined) { dbData.payment_method = o.paymentMethod; delete dbData.paymentMethod }
  if (o.payMethod !== undefined && dbData.payment_method === undefined) { dbData.payment_method = o.payMethod }
  // delete legacy dupes explicitly
  delete dbData.payMethod
  delete dbData.createdAt  // created_at defaults in DB
  delete dbData.closedAt
  delete dbData.scheduledAt

  // For Dates: mapping specifically in payload if sent explicitly
  if (o.closedAt !== undefined) dbData.closed_at = o.closedAt instanceof Date ? o.closedAt.toISOString() : o.closedAt
  if (o.scheduledAt !== undefined) dbData.scheduled_at = o.scheduledAt instanceof Date ? o.scheduledAt.toISOString() : o.scheduledAt

  return dbData
}

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState([])
  const ordersRef = useRef(orders)

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching orders:', error)
    } else if (data) {
      setOrders(data.map(mapOrderFromDB))
    }
  }

  useEffect(() => {
    fetchOrders()

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
    <OrdersContext.Provider value={{ orders, addOrder, updateOrder, deleteOrder, getNextNum }}>
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error('useOrders must be used within OrdersProvider')
  return ctx
}
