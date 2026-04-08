import OrderRow from './OrderRow'
import './OrderList.css'

export default function OrderList({ orders, selectedId, onSelect, onAction, onNewOrder }) {
  if (orders.length === 0) {
    return (
      <div className="order-list-empty">
        <span className="ol-empty-icon"><IconPlate /></span>
        <p className="ol-empty-text">Crea pedidos para cada tipo de servicio</p>
        <button className="btn btn-blue ol-empty-btn" onClick={onNewOrder}>
          + Nuevo pedido
        </button>
      </div>
    )
  }

  return (
    <div className="order-list">
      {/* Header row */}
      <div className="ol-header-row">
        <div className="ol-th">FECHA / TIPO</div>
        <div className="ol-th">ESTADO</div>
        <div className="ol-th">TOTAL</div>
        <div className="ol-th">CLIENTE</div>
        <div className="ol-th ol-th--right">ACCIONES</div>
      </div>

      {/* Data rows */}
      <div className="ol-body">
        {orders.map(order => (
          <OrderRow
            key={order.id}
            order={order}
            selected={order.id === selectedId}
            onClick={() => onSelect(order.id)}
            onAction={(action) => onAction(order.id, action)}
          />
        ))}
      </div>
    </div>
  )
}

function IconPlate() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  )
}
