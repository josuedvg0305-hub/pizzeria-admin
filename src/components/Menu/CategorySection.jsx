import { useState, useRef } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMenu } from '../../context/MenuContext'
import ProductRow from './ProductRow'
import ProductModal from './ProductModal'
import './CategorySection.css'

export default function CategorySection({ category }) {
  const { updateCategory, deleteCategory, duplicateCategory, reorderProducts, handleToggleCategory } = useMenu()
  const [expanded, setExpanded]         = useState(false)
  const [renaming, setRenaming]         = useState(false)
  const [nameVal, setNameVal]           = useState(category.name)
  const [showProductModal, setShowPM]   = useState(false)
  const [editingProduct, setEditingProd]= useState(null)
  const nameInputRef = useRef(null)

  /* ── Sortable (this card in the outer category list) ── */
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: String(category.id) })

  const cardStyle = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 200ms ease',
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 500 : 'auto',
    position: 'relative',
  }

  /* ── Inner DnD for products ── */
  const productSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )
  const handleProductDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id)
      reorderProducts(category.id, active.id, over.id)
  }

  /* ── Inline rename ── */
  const startRename = () => {
    setRenaming(true)
    setTimeout(() => nameInputRef.current?.focus(), 30)
  }
  const commitRename = () => {
    const trimmed = nameVal.trim()
    if (trimmed && trimmed !== category.name)
      updateCategory(category.id, { name: trimmed })
    else
      setNameVal(category.name)
    setRenaming(false)
  }

  /* ── Product modal helpers ── */
  const openAddProduct = () => { setEditingProd(null); setShowPM(true) }
  const openEditProduct = (p) => { setEditingProd(p); setShowPM(true) }

  const handleDeleteCategory = () => {
    if (window.confirm(`¿Eliminar la categoría "${category.name}" y sus ${category.products.length} productos?`))
      deleteCategory(category.id)
  }

  const handleDuplicateLocal = async () => {
    await duplicateCategory(category.id)
  }

  const isActive = category.is_active === true

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      {...attributes}
      className={`cat-section ${!isActive ? 'cat-section--off' : ''}`}
    >
      {/* ── Category header ── */}
      <div className="cat-header">
        {/* Drag handle */}
        <button className="drag-handle" {...listeners} tabIndex={-1}>
          <DotGrid />
        </button>

        {/* Name (or input when renaming) */}
        {renaming ? (
          <input
            ref={nameInputRef}
            className="cat-name-input"
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setNameVal(category.name); setRenaming(false) }
            }}
          />
        ) : (
          <span className="cat-name" onDoubleClick={startRename} title="Doble clic para renombrar">
            {category?.name}
          </span>
        )}

        <span className="cat-count-badge">{category?.products?.length || 0}</span>

        <div className="cat-actions">
          <label className="toggle" title={isActive ? 'Desactivar' : 'Activar'}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={() => handleToggleCategory(category.id, category.is_active)}
            />
            <span className="toggle-track" />
          </label>

          <button className="btn btn-ghost btn-sm" onClick={startRename}>Renombrar</button>

          <button className="btn btn-ghost btn-sm" onClick={handleDuplicateLocal}>Duplicar</button>

          <button
            className="btn btn-ghost btn-sm cat-del-btn"
            onClick={handleDeleteCategory}
          >
            Eliminar
          </button>

          <button className="btn btn-primary btn-sm" onClick={openAddProduct}>
            + Producto
          </button>

          <button
            className="btn btn-icon btn-ghost collapse-btn"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* ── Products table ── */}
      {expanded && (
        <div className="cat-body">
          {category.products.length === 0 ? (
            <div className="cat-empty">
              Sin productos.{' '}
              <button className="inline-link" onClick={openAddProduct}>Agregar uno</button>
            </div>
          ) : (
            <DndContext
              sensors={productSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleProductDragEnd}
            >
              <SortableContext
                items={category.products.map(p => String(p.id))}
                strategy={verticalListSortingStrategy}
              >
                <table className="products-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th style={{ width: 52 }}></th>
                      <th>Producto</th>
                      <th>Precio</th>
                      <th>Stock</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.products.map(p => (
                      <ProductRow
                        key={p.id}
                        product={p}
                        categoryId={category.id}
                        onEdit={() => openEditProduct(p)}
                      />
                    ))}
                  </tbody>
                </table>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categoryId={category.id}
          onClose={() => { setShowPM(false); setEditingProd(null) }}
        />
      )}
    </div>
  )
}

function DotGrid() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
      <circle cx="2.5" cy="2.5" r="1.5"/>
      <circle cx="7.5" cy="2.5" r="1.5"/>
      <circle cx="2.5" cy="7"   r="1.5"/>
      <circle cx="7.5" cy="7"   r="1.5"/>
      <circle cx="2.5" cy="11.5" r="1.5"/>
      <circle cx="7.5" cy="11.5" r="1.5"/>
    </svg>
  )
}
