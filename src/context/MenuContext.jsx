import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)

// Helper: frontend generateId for integers
const generateId = () => Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 10000)

export function MenuProvider({ children }) {
  const [categories, setCategories] = useState([])
  const [modifierGroups, setModGroups] = useState([])
  const [logo, setLogoState] = useState(() => localStorage.getItem('pizzeria-logo') || null)

  const fetchMenuData = async () => {
    const [catsRes, modsRes, prodsRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('modifier_groups').select('*').order('sort_order'),
      supabase.from('products').select('*').order('sort_order')
    ])

    if (!modsRes.error && modsRes.data) {
      setModGroups(modsRes.data.map(m => ({
        ...m,
        sortOrder: m.sort_order,
      })))
    }

    if (!catsRes.error && !prodsRes.error && catsRes.data && prodsRes.data) {
       const prodsMap = {}
       for (const p of prodsRes.data) {
         if (!prodsMap[p.category_id]) prodsMap[p.category_id] = []
         
         prodsMap[p.category_id].push({
           ...p,
           categoryId: p.category_id,
           promoPrice: p.promo_price,
           priceType: p.price_type,
           modifierGroupIds: p.modifier_group_ids,
           sortOrder: p.sort_order,
         })
       }

       const mappedCats = catsRes.data.map(c => ({
         ...c,
         sortOrder: c.sort_order,
         products: prodsMap[c.id] || []
       }))

       setCategories(mappedCats)
    }
  }

  useEffect(() => {
    fetchMenuData()
  }, [])

  // ── Logo ──────────────────────────────────────────────────────────────────
  const setLogo = useCallback((base64) => {
    if (base64) localStorage.setItem('pizzeria-logo', base64)
    else         localStorage.removeItem('pizzeria-logo')
    setLogoState(base64 || null)
  }, [])

  // ── Mappers Data a DB DB ──────────────────────────────────────────────────
  const mapProductToDB = (data) => {
    const o = { ...data }
    if (o.categoryId !== undefined) { o.category_id = o.categoryId; delete o.categoryId }
    if (o.promoPrice !== undefined) { o.promo_price = o.promoPrice; delete o.promoPrice }
    if (o.priceType !== undefined) { o.price_type = o.priceType; delete o.priceType }
    if (o.modifierGroupIds !== undefined) { o.modifier_group_ids = o.modifierGroupIds; delete o.modifierGroupIds }
    if (o.sortOrder !== undefined) { o.sort_order = o.sortOrder; delete o.sortOrder }
    // Clean react specific
    delete o.products
    return o
  }

  const mapCategoryToDB = (data) => {
    const o = {}
    if (data.name !== undefined) o.name = data.name
    if (data.sortOrder !== undefined) o.sort_order = data.sortOrder
    if (data.active !== undefined) o.is_active = Boolean(data.active)
    return o
  }

  const mapModGroupToDB = (data) => {
    const o = { ...data }
    if (o.sortOrder !== undefined) { o.sort_order = o.sortOrder; delete o.sortOrder }
    return o
  }

  // ── Categories ────────────────────────────────────────────────────────────
  const addCategory = useCallback(async (data) => {
    const newId = generateId()
    setCategories(p => [...p, { id: newId, products: [], active: true, ...data }])
    
    await supabase.from('categories').insert({
      id: newId,
      name: data.name,
      sort_order: categories.length
    })
    fetchMenuData()
  }, [categories])

  const updateCategory = useCallback(async (id, data) => {
    // Optimistic UI update
    setCategories(p => p.map(c => c.id === id ? { ...c, ...data } : c))
    
    try {
      const { error } = await supabase
        .from('categories')
        .update(mapCategoryToDB(data))
        .eq('id', Number(id))

      if (error) {
        console.error("Error Supabase Toggle:", error)
        alert(`Error al actualizar la categoría: ${error.message}`)
      }
    } catch (err) {
      console.error("Error inesperado en updateCategory:", err)
      alert(`Error inesperado: ${err.message}`)
    }

    fetchMenuData()
  }, [])

  const deleteCategory = useCallback(async (id) => {
    setCategories(p => p.filter(c => c.id !== id))
    await supabase.from('categories').delete().eq('id', id)
    fetchMenuData()
  }, [])

  const reorderCategories = useCallback(async (activeId, overId) => {
    setCategories(p => {
      const oi = p.findIndex(c => c.id === activeId)
      const ni = p.findIndex(c => c.id === overId)
      const reordered = arrayMove(p, oi, ni)
      
      // Update DB sort_orders
      const updates = reordered.map((cat, idx) => ({ id: cat.id, sort_order: idx }))
      supabase.from('categories').upsert(updates).then(() => fetchMenuData())
      
      return reordered
    })
  }, [])

  // ── Products ──────────────────────────────────────────────────────────────
  const addProduct = useCallback(async (catId, data) => {
    const newId = generateId()
    setCategories(p => p.map(c =>
      c.id === catId ? { ...c, products: [...c.products, { id: newId, categoryId: catId, ...data }] } : c
    ))

    const dbPayload = mapProductToDB({ id: newId, categoryId: catId, ...data })
    await supabase.from('products').insert(dbPayload)
    fetchMenuData()
  }, [])

  const updateProduct = useCallback(async (catId, prodId, data) => {
    setCategories(p => p.map(c =>
      c.id === catId
        ? { ...c, products: c.products.map(pr => pr.id === prodId ? { ...pr, ...data } : pr) }
        : c
    ))

    const dbPayload = mapProductToDB(data)
    await supabase.from('products').update(dbPayload).eq('id', prodId)
    // No fetchMenuData immediately if it's rapid updates (like UI toggles), but for safety we refresh:
    fetchMenuData()
  }, [])

  const deleteProduct = useCallback(async (catId, prodId) => {
    setCategories(p => p.map(c =>
      c.id === catId ? { ...c, products: c.products.filter(pr => pr.id !== prodId) } : c
    ))
    
    await supabase.from('products').delete().eq('id', prodId)
    fetchMenuData()
  }, [])

  const reorderProducts = useCallback(async (catId, activeId, overId) => {
    setCategories(p => p.map(c => {
      if (c.id !== catId) return c
      const oi = c.products.findIndex(pr => pr.id === activeId)
      const ni = c.products.findIndex(pr => pr.id === overId)
      const reordered = arrayMove(c.products, oi, ni)

      // Update DB
      const updates = reordered.map((pr, idx) => ({ id: pr.id, category_id: c.id, sort_order: idx }))
      supabase.from('products').upsert(updates).then(() => fetchMenuData())

      return { ...c, products: reordered }
    }))
  }, [])

  // ── Modifier groups ───────────────────────────────────────────────────────
  const reorderModGroups = useCallback(async (activeId, overId) => {
    setModGroups(p => {
      const oi = p.findIndex(g => g.id === activeId)
      const ni = p.findIndex(g => g.id === overId)
      const reordered = arrayMove(p, oi, ni)

      const updates = reordered.map((mg, idx) => ({ id: mg.id, sort_order: idx }))
      supabase.from('modifier_groups').upsert(updates).then(() => fetchMenuData())

      return reordered
    })
  }, [])

  const addModGroup = useCallback(async (data) => {
    const newId = generateId()
    setModGroups(p => [...p, { id: newId, options: [], min: 0, max: null, ...data }])
    
    await supabase.from('modifier_groups').insert({
      id: newId,
      name: data.name,
      required: data.required || false,
      multiple: data.multiple || false,
      min: data.min || 0,
      max: data.max,
      options: data.options || [],
      sort_order: modifierGroups.length
    })
    fetchMenuData()
  }, [modifierGroups])

  const updateModGroup = useCallback(async (id, data) => {
    setModGroups(p => p.map(g => g.id === id ? { ...g, ...data } : g))
    await supabase.from('modifier_groups').update(mapModGroupToDB(data)).eq('id', id)
    fetchMenuData()
  }, [])

  const deleteModGroup = useCallback(async (id) => {
    // Delete from state and update nested products
    setModGroups(p => p.filter(g => g.id !== id))
    setCategories(p => p.map(c => ({
      ...c,
      products: c.products.map(pr => ({
        ...pr,
        modifierGroupIds: pr.modifierGroupIds.filter(gid => gid !== id),
      })),
    })))

    await supabase.from('modifier_groups').delete().eq('id', id)
    
    // Al borrar grupo, también debemos actualizar los productos que lo tenían asignado en DB
    // Supabase jsonb no permite fácilmente array_remove de valores en múltiples filas con update simple
    // Por simplicidad en este MVP, las referencias huérfanas en modGroupIds de products no romperán frontend ya que el modGroup per se no existe
    // Pero forzamos sincronía.
    fetchMenuData()
  }, [])

  /* Assign / unassign a modifier group to a list of products in bulk */
  const bulkUpdateModGroupAssignments = useCallback(async (groupId, assignedProductIds) => {
    const assignedSet = new Set(assignedProductIds)
    const updates = []

    setCategories(p => p.map(c => ({
      ...c,
      products: c.products.map(pr => {
        const has    = pr.modifierGroupIds.includes(groupId)
        const wants  = assignedSet.has(pr.id)
        if (has === wants) return pr
        
        const nextIds = wants
          ? [...pr.modifierGroupIds, groupId]
          : pr.modifierGroupIds.filter(id => id !== groupId)
          
        updates.push({ id: pr.id, modifier_group_ids: nextIds })
          
        return {
          ...pr,
          modifierGroupIds: nextIds,
        }
      }),
    })))

    if (updates.length > 0) {
      await supabase.from('products').upsert(updates)
      fetchMenuData()
    }
  }, [])

  // ── Stock — ready to connect to inventory module ─────────────────────────
  const updateStock = useCallback(async (catId, prodId, quantity) => {
    let targetProduct = null;
    setCategories(p => p.map(c =>
      c.id === catId
        ? { ...c, products: c.products.map(pr => {
              if (pr.id === prodId) {
                targetProduct = pr;
                return { ...pr, stock: { ...pr.stock, quantity } }
              }
              return pr;
            })}
        : c
    ))

    if (targetProduct) {
      const parentStock = targetProduct.stock || { enabled: false, alertAt: 5 }
      await supabase.from('products').update({
        stock: { ...parentStock, quantity }
      }).eq('id', prodId)
      fetchMenuData()
    }
  }, [])

  return (
    <Ctx.Provider value={{
      categories, modifierGroups, logo,
      setLogo, fetchMenuData,
      addCategory, updateCategory, deleteCategory, reorderCategories,
      addProduct, updateProduct, deleteProduct, reorderProducts,
      addModGroup, updateModGroup, deleteModGroup, reorderModGroups,
      bulkUpdateModGroupAssignments,
      updateStock,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useMenu = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMenu requires <MenuProvider>')
  return ctx
}
