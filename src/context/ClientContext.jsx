import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ClientContext = createContext(null)

/** Normalize a client so it always has `addresses: string[]` (never `address: string`) */
function normalizeClient(c) {
  if (Array.isArray(c.addresses)) return c
  const addr = c.address ?? ''
  const { address: _dropped, ...rest } = c
  return { ...rest, addresses: addr ? [addr] : [] }
}

export function ClientProvider({ children }) {
  const [clients, setClients] = useState([])

  /**
   * Normalize a phone to bare digits without country code for comparison.
   * Handles: '+56 9 1234 5678', '56912345678', '912345678', '9 1234 5678', etc.
   */
  const normalizePhone = (raw = '') => {
    const digits = raw.replace(/\D/g, '')           // keep only digits
    return digits.startsWith('56') && digits.length > 9
      ? digits.slice(2)                              // strip '56' country code
      : digits
  }

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('updated_at', { ascending: false })
    
    if (!error && data) {
      // Mapeamos los campos snake_case de DB a camelCase para la UI actual + normalización
      const mapped = data.map(c => normalizeClient({
        ...c,
        loyaltyPoints: c.loyalty_points,
        totalOrders: c.total_orders,
      }))
      setClients(mapped)
    } else if (error) {
      console.error("Error fetching clients:", error)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  /**
   * Register a client from an order (express creation).
   * Key: normalized phone (digits only, no country code).
   * - EXISTS  → increment totalOrders, push new address if unique.
   * - MISSING → create new entry.
   */
  const registerClientFromOrder = async (clientData, origin = 'PDV') => {
    const cleanPhone = normalizePhone(clientData?.phone ?? '')
    if (!cleanPhone) return

    const incomingAddr = (clientData.addr ?? '').trim()
    const existing = clients.find(c => normalizePhone(c.phone) === cleanPhone)

    let addresses = incomingAddr ? [incomingAddr] : []
    let totalOrders = 1

    if (existing) {
      addresses = Array.isArray(existing.addresses) ? [...existing.addresses] : []
      if (incomingAddr && !addresses.includes(incomingAddr)) {
        addresses.push(incomingAddr)
      }
      totalOrders = (existing.totalOrders ?? 0) + 1
    }

    const payload = {
      phone: cleanPhone,
      name: (clientData.name ?? '').trim() || (existing ? existing.name : 'Sin nombre'),
      addresses,
      total_orders: totalOrders,
    }

    // Si es nuevo cliente, definimos campos por defecto
    if (!existing) {
      payload.channel = origin
      payload.loyalty_points = 0
      payload.segment = 'Comprador'
      payload.status = 'Activo'
    } else {
      payload.id = existing.id // para asegurar que Supabase entienda que es este registro exacto (opcional por el UNIQUE phone, pero seguro)
    }

    const { error } = await supabase
      .from('clients')
      .upsert(payload, { onConflict: 'phone' })

    if (error) {
      console.error("Error upserting client:", error)
    } else {
      fetchClients()
    }
  }

  /**
   * Manual CRUD used by ClientsPage drawer.
   */
  const saveClient = async (data, existingId = null) => {
    const addresses = Array.isArray(data.addresses) ? data.addresses : []
    let errorObj = null

    if (existingId) {
      const { error } = await supabase
        .from('clients')
        .update({
          name: data.name,
          phone: normalizePhone(data.phone),
          addresses
        })
        .eq('id', existingId)
      errorObj = error
    } else {
      const { error } = await supabase
        .from('clients')
        .insert({
          name: data.name || 'Sin nombre',
          phone: normalizePhone(data.phone),
          addresses,
          channel: 'Directo',
          loyalty_points: 0,
          total_orders: 0,
          segment: 'Comprador',
          status: 'Activo'
        })
      errorObj = error
    }

    if (errorObj) {
      console.error("Error saving client:", errorObj)
      alert("Error al guardar cliente. Revisa si el teléfono ya existe.")
    } else {
      fetchClients()
    }
  }

  /**
   * Bulk import clients from parsed CSV array.
   */
  const importBulkClients = async (importedArray) => {
    for (const incoming of importedArray) {
      const cleanPhone = normalizePhone(incoming.phone ?? '')
      if (!cleanPhone) continue
      
      const existing = clients.find(c => normalizePhone(c.phone) === cleanPhone)
      
      let addresses = incoming.addresses || []
      if (existing) {
        const mergedAddresses = [...(existing.addresses ?? [])]
        for (const addr of addresses) {
          if (addr && !mergedAddresses.includes(addr)) mergedAddresses.push(addr)
        }
        addresses = mergedAddresses
      }

      const payload = {
        phone: cleanPhone,
        name: incoming.name || (existing ? existing.name : 'Sin nombre'),
        addresses,
        channel: incoming.channel || (existing ? existing.channel : 'Importado'),
        segment: incoming.segment || (existing ? existing.segment : 'Comprador'),
        status: incoming.status || (existing ? existing.status : 'Activo'),
        loyalty_points: incoming.loyaltyPoints ?? (existing ? existing.loyaltyPoints : 0),
        total_orders: incoming.totalOrders ?? (existing ? existing.totalOrders : 0)
      }

      if (existing) payload.id = existing.id

      await supabase.from('clients').upsert(payload, { onConflict: 'phone' })
    }
    
    fetchClients()
  }

  return (
    <ClientContext.Provider value={{ clients, fetchClients, registerClientFromOrder, saveClient, importBulkClients }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClients() {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClients must be used inside <ClientProvider>')
  return ctx
}

