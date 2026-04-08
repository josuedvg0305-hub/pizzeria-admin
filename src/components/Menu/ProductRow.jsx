import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMenu } from '../../context/MenuContext'
import './ProductRow.css'

const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`

function discount(orig, promo) {
  return Math.round((1 - promo / orig) * 100)
}

function StockBadge({ stock }) {
  if (!stock?.enabled) return null
  if (stock.quantity === 0)
    return <span className="stock-badge stock-badge--out">Agotado</span>
  if (stock.quantity < stock.alertAt)
    return <span className="stock-badge stock-badge--low">Poco ({stock.quantity})</span>
  return <span className="stock-badge stock-badge--in">Stock {stock.quantity}</span>
}

export default function ProductRow({ product, categoryId, onEdit }) {
  const { updateProduct, deleteProduct, handleToggleProduct } = useMenu()

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: product.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 200ms ease',
    opacity: isDragging ? 0.45 : 1,
  }

  const handleDelete = () => {
    if (window.confirm(`¿Eliminar "${product.name}"?`))
      deleteProduct(categoryId, product.id)
  }

  /* ── Price display helpers ── */
  let priceNode
  if (product.priceType === 'simple') {
    const activePrice = product.variants?.length > 0 ? product.variants[0].price : 0
    const activePromo = product.variants?.length > 0 ? product.variants[0].promoPrice : null
    const hasPromo = activePromo !== null && activePromo > 0

    priceNode = (
      <div className="price-col">
        {hasPromo ? (
          <>
            <span className="price-orig">{fmt(activePrice)}</span>
            <span className="price-promo">{fmt(activePromo)}</span>
            <span className="price-disc">-{discount(activePrice, activePromo)}%</span>
          </>
        ) : (
          <span className="price-normal">{fmt(activePrice)}</span>
        )}
      </div>
    )
  } else {
    const min = product.variants.reduce((m, v) => Math.min(m, v.price), Infinity)
    const hasPromo = product.variants.some(v => v.promoPrice !== null && v.promoPrice > 0)
    const minPromo = hasPromo
      ? product.variants.filter(v => v.promoPrice).reduce((m, v) => Math.min(m, v.promoPrice), Infinity)
      : null
    priceNode = (
      <div className="price-col">
        {hasPromo ? (
          <>
            <span className="price-orig">Desde {fmt(min)}</span>
            <span className="price-promo">{fmt(minPromo)}</span>
            <span className="price-disc">-{discount(min, minPromo)}%</span>
          </>
        ) : (
          <>
            <span className="price-normal price-from">Desde {fmt(min)}</span>
          </>
        )}
        <span className="variants-pill">{product.variants.length} tallas</span>
      </div>
    )
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`product-row ${!product.active ? 'product-row--off' : ''}`}
    >
      {/* drag handle */}
      <td className="td-drag">
        <button className="drag-handle" {...listeners} tabIndex={-1}>
          <DotGrid />
        </button>
      </td>

      {/* thumbnail */}
      <td className="td-thumb">
        <div className="product-thumb">
          {(product.images?.[0] ?? product.image)
            ? <img src={product.images?.[0] ?? product.image} alt={product.name} />
            : <span className="product-thumb-empty">🍕</span>
          }
          {(product.promoPrice || product.variants.some(v => v.promoPrice)) && (
            <span className="thumb-promo-dot" title="En promoción" />
          )}
        </div>
      </td>

      {/* name */}
      <td className="td-name">
        <span className="product-name">{product.name}</span>
        {product.description && (
          <span className="product-desc">{product.description}</span>
        )}
      </td>

      {/* price */}
      <td>{priceNode}</td>

      {/* stock */}
      <td><StockBadge stock={product.stock} /></td>

      {/* active toggle */}
      <td>
        <label className="toggle">
          <input
            type="checkbox"
            checked={product.is_active === true}
            onChange={() => handleToggleProduct(categoryId, product.id, product.is_active)}
          />
          <span className="toggle-track" />
        </label>
      </td>

      {/* actions */}
      <td>
        <div className="pr-actions">
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>Editar</button>
          <button className="btn btn-sm pr-del-btn" onClick={handleDelete}>✕</button>
        </div>
      </td>
    </tr>
  )
}

function DotGrid() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
      <circle cx="2.5" cy="2.5"  r="1.5"/>
      <circle cx="7.5" cy="2.5"  r="1.5"/>
      <circle cx="2.5" cy="7"    r="1.5"/>
      <circle cx="7.5" cy="7"    r="1.5"/>
      <circle cx="2.5" cy="11.5" r="1.5"/>
      <circle cx="7.5" cy="11.5" r="1.5"/>
    </svg>
  )
}
