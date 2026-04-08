import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/* ── Context ── */
const SettingsContext = createContext(null)

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings debe usarse dentro de <SettingsProvider>')
  return ctx
}

/*
  Shape de zona de delivery desde Supabase:
  {
    id:      string (UUID),
    name:    string,
    price:   number,
    color:   string,
    polygon: Array<{ lat: number, lng: number }>,
    active:  boolean,
    sort_order: number,
    created_at: string
  }
*/
export function SettingsProvider({ children }) {
  const [deliveryZones, setDeliveryZones] = useState([])

  const fetchZones = async () => {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching delivery zones:', error)
    } else if (data) {
      setDeliveryZones(data)
    }
  }

  useEffect(() => {
    fetchZones()
  }, [])

  const addZone = useCallback(async (zoneData) => {
    const { data, error } = await supabase
      .from('delivery_zones')
      .insert({
        name: zoneData.name,
        price: zoneData.price,
        color: zoneData.color,
        polygon: zoneData.polygon,
        sort_order: deliveryZones.length
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding delivery zone:', error)
      return null
    } else {
      fetchZones()
      return data
    }
  }, [deliveryZones])

  const updateZone = useCallback(async (id, changes) => {
    const { error } = await supabase
      .from('delivery_zones')
      .update(changes)
      .eq('id', id)

    if (error) {
      console.error('Error updating delivery zone:', error)
    } else {
      fetchZones()
    }
  }, [])

  const deleteZone = useCallback(async (id) => {
    const { error } = await supabase
      .from('delivery_zones')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting delivery zone:', error)
    } else {
      fetchZones()
    }
  }, [])

  return (
    <SettingsContext.Provider value={{ deliveryZones, addZone, updateZone, deleteZone }}>
      {children}
    </SettingsContext.Provider>
  )
}
