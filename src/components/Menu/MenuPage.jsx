import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useMenu } from '../../context/MenuContext'
import CategorySection from './CategorySection'
import CategoryModal from './CategoryModal'
import ModifiersPanel from './ModifiersPanel'
import './MenuPage.css'

export default function MenuPage() {
  const { categories, reorderCategories } = useMenu()
  const [tab, setTab]       = useState('carta')
  const [showAddCat, setShowAddCat] = useState(false)
  const [activeId, setActiveId]     = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const totalProducts = categories.reduce((n, c) => n + c.products.length, 0)
  const activeProds   = categories.reduce(
    (n, c) => n + c.products.filter(p => p.active).length, 0
  )

  const handleDragStart = ({ active }) => setActiveId(active.id)
  const handleDragEnd   = ({ active, over }) => {
    setActiveId(null)
    if (over && active.id !== over.id) reorderCategories(active.id, over.id)
  }

  const draggingCat = categories.find(c => String(c.id) === String(activeId))

  return (
    <div className="menu-page h-full flex-1 overflow-y-auto pb-32">
      {/* ── Page header ── */}
      <header className="mp-header">
        <div>
          <h1 className="mp-title">Carta / Menú</h1>
          <p className="mp-sub">Gestiona categorías, productos, precios y modificadores</p>
        </div>
        {tab === 'carta' && (
          <button className="btn btn-primary" onClick={() => setShowAddCat(true)}>
            + Nueva categoría
          </button>
        )}
      </header>

      {/* ── Tabs ── */}
      <div className="mp-tabs-bar">
        {[['carta', '🍕 Carta'], ['modificadores', '🔧 Modificadores']].map(([id, label]) => (
          <button
            key={id}
            className={`mp-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Carta tab ── */}
      {tab === 'carta' && (
        <>
          <div className="mp-stats">
            <div className="mp-stat"><span className="mp-stat-n">{categories.length}</span><span>Categorías</span></div>
            <div className="mp-stat"><span className="mp-stat-n">{totalProducts}</span><span>Productos</span></div>
            <div className="mp-stat"><span className="mp-stat-n">{activeProds}</span><span>Activos</span></div>
            <div className="mp-stat"><span className="mp-stat-n">{totalProducts - activeProds}</span><span>Inactivos</span></div>
          </div>

          {categories.length === 0 ? (
            <div className="mp-empty">
              <span>🍽️</span>
              <p>No hay categorías aún.</p>
              <button className="btn btn-primary" onClick={() => setShowAddCat(true)}>
                Crear primera categoría
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={categories.map(c => String(c.id))}
                strategy={verticalListSortingStrategy}
              >
                <div className="mp-categories">
                  {categories.map(cat => (
                    <CategorySection key={cat.id} category={cat} />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {draggingCat && (
                  <div className="category-drag-ghost">
                    <span>{draggingCat.name}</span>
                    <span className="cat-count-badge">{draggingCat.products.length}</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      {tab === 'modificadores' && <ModifiersPanel />}

      {showAddCat && (
        <CategoryModal onClose={() => setShowAddCat(false)} />
      )}
    </div>
  )
}
