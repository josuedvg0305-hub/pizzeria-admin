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
      supabase.from('modifier_groups').select('*').order('sort_order', { ascending: true }),
      supabase.from('products').select('*').order('sort_order')
    ])

    if (!modsRes.error && modsRes.data) {
      setModGroups(modsRes.data.map(m => ({
        ...m,
        sortOrder: m.sort_order,
      })))
    }

    if (!catsRes.error && !prodsRes.error && catsRes.data && prodsRes.data) {
       console.log("Productos cargados en Contexto/PDV:", prodsRes.data)
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
    const o = {}
    if (data.name !== undefined) o.name = data.name
    if (data.description !== undefined) o.description = data.description
    // User requested explicit is_active payload
    if (data.active !== undefined) o.is_active = Boolean(data.active)
    if (data.images !== undefined) o.images = data.images
    if (data.priceType !== undefined) o.price_type = data.priceType
    if (data.price !== undefined) o.price = data.price
    if (data.promoPrice !== undefined) o.promo_price = data.promoPrice
    if (data.cost !== undefined) o.cost = data.cost
    if (data.variants !== undefined) o.variants = data.variants
    if (data.modifierGroupIds !== undefined) o.modifier_group_ids = data.modifierGroupIds
    if (data.stock !== undefined) o.stock = data.stock
    if (data.sortOrder !== undefined) o.sort_order = data.sortOrder
    if (data.categoryId !== undefined) o.category_id = data.categoryId
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
    // Clean id just in case
    delete o.id
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
      const payload = mapCategoryToDB(data)
      // Only process network request if payload is not empty
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', Number(id))

        if (error) {
          console.error("Error Supabase Toggle Categoria:", error)
          alert(`Error al actualizar la categoría: ${error.message}`)
        }
      }
    } catch (err) {
      console.error("Error inesperado en updateCategory:", err)
      alert(`Error inesperado: ${err.message}`)
    }

    fetchMenuData()
  }, [])

  const handleToggleCategory = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    console.log("Toggle intentado:", id, newStatus);

    // Optimistic UI update
    setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: newStatus } : c));

    const { error } = await supabase.from('categories').update({ is_active: newStatus }).eq('id', id);

    if (error) {
      console.error("Error Supabase:", error);
      // Rollback on error
      setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: currentStatus } : c));
    }
  };

  const deleteCategory = useCallback(async (id) => {
    setCategories(p => p.filter(c => c.id !== id))
    await supabase.from('categories').delete().eq('id', id)
    fetchMenuData()
  }, [])

  const duplicateCategory = useCallback(async (id) => {
    const originalCat = categories.find(c => c.id === id);
    if (!originalCat) return;

    try {
      const newCatId = generateId();
      
      const { error: catError } = await supabase.from('categories').insert({
        id: newCatId,
        name: `${originalCat.name} (Copia)`,
        sort_order: categories.length,
        is_active: originalCat.is_active
      });

      if (catError) throw catError;

      if (originalCat.products && originalCat.products.length > 0) {
        const duplicatedProducts = originalCat.products.map((p, idx) => {
          const newProdId = generateId() + idx; 
          const payload = mapProductToDB(p);
          payload.id = newProdId;
          payload.category_id = newCatId;
          return payload;
        });

        const { error: prodError } = await supabase.from('products').insert(duplicatedProducts);
        if (prodError) throw prodError;
      }
      
      await fetchMenuData();
    } catch (err) {
      console.error("Error al duplicar categoría:", err);
      alert(`Error al duplicar categoría: ${err.message}`);
    }
  }, [categories]);

  const reorderCategories = useCallback(async (activeId, overId) => {
    let reordered = []
    setCategories(p => {
      const oi = p.findIndex(c => String(c.id) === String(activeId))
      const ni = p.findIndex(c => String(c.id) === String(overId))
      if (oi === -1 || ni === -1) return p
      reordered = arrayMove(p, oi, ni)
      return reordered
    })
    
    if (reordered.length > 0) {
      try {
        await Promise.all(
          reordered.map((cat, idx) => 
            supabase.from('categories').update({ sort_order: idx }).eq('id', cat.id)
          )
        )
        fetchMenuData()
      } catch (err) {
        console.error('Error al reordenar categorias:', err)
        fetchMenuData()
      }
    }
  }, [])

  // ── Products ──────────────────────────────────────────────────────────────
  const addProduct = useCallback(async (catId, data) => {
    const newId = generateId()
    setCategories(p => p.map(c =>
      c.id === catId ? { ...c, products: [...c.products, { id: newId, categoryId: catId, ...data }] } : c
    ))

    const dbPayload = mapProductToDB({ categoryId: catId, ...data })
    dbPayload.id = newId // Required for insert
    await supabase.from('products').insert(dbPayload)
    fetchMenuData()
  }, [])

  const updateProduct = useCallback(async (catId, prodId, data) => {
    setCategories(p => p.map(c =>
      c.id === catId
        ? { ...c, products: c.products.map(pr => pr.id === prodId ? { ...pr, ...data } : pr) }
        : c
    ))

    try {
      const dbPayload = mapProductToDB(data)
      if (Object.keys(dbPayload).length > 0) {
        const { error } = await supabase
          .from('products')
          .update(dbPayload)
          .eq('id', Number(prodId))

        if (error) {
          console.error("Error Supabase Toggle Producto:", error)
          alert(`Error al actualizar el producto: ${error.message}`)
        }
      }
    } catch (err) {
      console.error("Error inesperado en updateProduct:", err)
      alert(`Error inesperado: ${err.message}`)
    }

    fetchMenuData()
  }, [])

  const handleToggleProduct = async (catId, prodId, currentStatus) => {
    const newStatus = !currentStatus;
    console.log("Toggle intentado:", prodId, newStatus);

    // Optimistic UI update
    setCategories(prev => prev.map(c =>
      c.id === catId
        ? { ...c, products: c.products.map(pr => pr.id === prodId ? { ...pr, is_active: newStatus } : pr) }
        : c
    ));

    const { error } = await supabase.from('products').update({ is_active: newStatus }).eq('id', prodId);

    if (error) {
      console.error("Error Supabase:", error);
      // Rollback on error
      setCategories(prev => prev.map(c =>
        c.id === catId
          ? { ...c, products: c.products.map(pr => pr.id === prodId ? { ...pr, is_active: currentStatus } : pr) }
          : c
      ));
    }
  };

  const deleteProduct = useCallback(async (catId, prodId) => {
    setCategories(p => p.map(c =>
      c.id === catId ? { ...c, products: c.products.filter(pr => pr.id !== prodId) } : c
    ))
    
    await supabase.from('products').delete().eq('id', prodId)
    fetchMenuData()
  }, [])

  const reorderProducts = useCallback(async (catId, activeId, overId) => {
    let updatesFound = false
    let reordered = []
    setCategories(p => p.map(c => {
      if (String(c.id) !== String(catId)) return c
      const oi = c.products.findIndex(pr => String(pr.id) === String(activeId))
      const ni = c.products.findIndex(pr => String(pr.id) === String(overId))
      if (oi === -1 || ni === -1) return c
      reordered = arrayMove(c.products, oi, ni)
      updatesFound = true
      return { ...c, products: reordered }
    }))

    if (updatesFound && reordered.length > 0) {
      try {
        await Promise.all(
          reordered.map((pr, idx) =>
            supabase.from('products').update({ sort_order: idx }).eq('id', pr.id)
          )
        )
        fetchMenuData()
      } catch (err) {
        console.error('Error al reordenar productos:', err)
        fetchMenuData()
      }
    }
  }, [])

  // ── Modifier groups ───────────────────────────────────────────────────────
  const reorderModGroups = useCallback(async (activeId, overId) => {
    let reordered = []
    setModGroups(p => {
      const oi = p.findIndex(g => String(g.id) === String(activeId))
      const ni = p.findIndex(g => String(g.id) === String(overId))
      if (oi === -1 || ni === -1) return p
      reordered = arrayMove(p, oi, ni)
      return reordered
    })

    if (reordered.length > 0) {
      try {
        await Promise.all(
          reordered.map((mg, idx) =>
            supabase.from('modifier_groups').update({ sort_order: idx }).eq('id', mg.id)
          )
        )
        fetchMenuData()
      } catch (err) {
        console.error('Error al actualizar orden de modificadores:', err)
        fetchMenuData() // Re-fetch on error to revert to DB state
      }
    }
  }, [])

  const addModGroup = useCallback(async (data) => {
    // Usamos estrictamente data.id (stableGroupId generado en el modal)
    // para que el estado local y Supabase compartan el mismo ID que
    // bulkUpdateModGroupAssignments usará al asignar el grupo a los productos.
    const groupId = data.id
    setModGroups(p => [...p, { options: [], min: 0, max: null, ...data, id: groupId }])

    await supabase.from('modifier_groups').insert({
      id: groupId,
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

  const duplicateModGroup = useCallback(async (id) => {
    const originalGroup = modifierGroups.find(g => g.id === id);
    if (!originalGroup) return;

    try {
      const newId = generateId();
      
      const duplicatedOptions = (originalGroup.options || []).map(opt => ({
        ...opt,
        id: crypto.randomUUID()
      }));

      const { error } = await supabase.from('modifier_groups').insert({
        id: newId,
        name: `${originalGroup.name} (Copia)`,
        required: originalGroup.required,
        multiple: originalGroup.multiple,
        min: originalGroup.min || 0,
        max: originalGroup.max,
        options: duplicatedOptions,
        sort_order: modifierGroups.length,
        is_active: originalGroup.is_active
      });

      if (error) throw error;
      
      await fetchMenuData();
    } catch (err) {
      console.error("Error al duplicar grupo de modificadores:", err);
      alert(`Error al duplicar grupo: ${err.message}`);
    }
  }, [modifierGroups]);

  const handleToggleModGroup = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    console.log("Toggle ModGroup intentado:", id, newStatus);

    setModGroups(prev => prev.map(g => g.id === id ? { ...g, is_active: newStatus } : g));

    const { error } = await supabase.from('modifier_groups').update({ is_active: newStatus }).eq('id', id);

    if (error) {
      console.error("Error Supabase toggle ModGroup:", error);
      setModGroups(prev => prev.map(g => g.id === id ? { ...g, is_active: currentStatus } : g));
    }
  };

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
      addCategory, updateCategory, deleteCategory, duplicateCategory, reorderCategories,
      addProduct, updateProduct, deleteProduct, reorderProducts,
      addModGroup, updateModGroup, deleteModGroup, duplicateModGroup, reorderModGroups,
      bulkUpdateModGroupAssignments,
      updateStock, handleToggleCategory, handleToggleProduct, handleToggleModGroup,
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
