import React, { useState } from 'react';
import './HistoryDetailDrawer.css';

const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`;

function fmtDate(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const TYPE_LABEL = {
  flash:    'Flash',
  local:    'En local',
  llevar:   'Para llevar',
  delivery: 'Delivery',
  mesa:     'Mesa',
};

const STATUS_LABEL = {
  pend:        'Pendiente',
  preparacion: 'Preparación',
  listo:       'Listo',
  finalizado:  'Finalizado',
  cancelado:   'Cancelado',
};

export default function HistoryDetailDrawer({ order, onClose, onUpdateOrder }) {
  const [view, setView] = useState('detail');
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);

  if (!order) return null;

  const displayMods = (item) => {
    if (item.mods && item.mods.length > 0) return item.mods;
    if (item.modifiers && item.modifiers.length > 0) return item.modifiers.map(m => m.name);
    return [];
  };

  const getSubtotal = () => {
    return (order.items || []).reduce((sum, item) => sum + item.total, 0);
  };

  const getPriceBreakdown = () => {
    const subtotal = getSubtotal();
    const charges = order.charges || {};

    const computedDiscount = order.discountMode === '%'
      ? Math.round(subtotal * (Number(order.discountVal) || 0) / 100)
      : (Number(order.discountVal) || 0);

    const discount = Number(order.discount) || computedDiscount;
    const subtotalNet = Math.max(0, subtotal - discount);

    const delivery = Number(charges.delivery ?? order.delivery ?? order.deliveryFee) || 0;
    const tip = charges.tipMode === '%'
      ? Math.round(subtotalNet * (Number(charges.tipVal) || 0) / 100)
      : (Number(charges.tipVal) || Number(order.tip) || 0);
    const servicio = Number(charges.servicio) || 0;
    const empaque = Number(charges.empaque) || 0;

    return { subtotal, discount, delivery, tip, servicio, empaque };
  };

  const breakdown = getPriceBreakdown();
  const hasExtras =
    breakdown.discount > 0 ||
    breakdown.delivery > 0 ||
    breakdown.tip > 0 ||
    breakdown.servicio > 0 ||
    breakdown.empaque > 0;

  const hasPayment = !!(order.paymentMethod || order.payMethod);

  const handleDeletePayment = () => {
    onUpdateOrder(order.id, { paymentMethod: null, payMethod: null, paid: false });
    setShowPaymentMenu(false);
  };

  const handleAddPayment = (method) => {
    onUpdateOrder(order.id, { paymentMethod: method, paid: true });
    setView('payment');
  };

  return (
    <div className="hdd-overlay" onClick={onClose}>
      <div className="hdd-drawer" onClick={(e) => e.stopPropagation()}>
        
        {view === 'detail' && (
          <>
            {/* Header Superior */}
            <div className="hdd-header">
              <div className="hdd-header-left">
                <span className="hdd-header-num">#{order.num}</span>
                <span className="hdd-badge-type">{TYPE_LABEL[order.type] ?? order.type}</span>
                <span className="hdd-badge-status">{STATUS_LABEL[order.status] ?? order.status}</span>
              </div>
              <button className="hdd-close-btn" onClick={onClose}>✕</button>
            </div>

            {/* Sub-Header */}
            <div className="hdd-subheader">
              <span>{order.origin || 'POS'}</span>
              <span className="hdd-sh-div">|</span>
              <span>🗓️ {fmtDate(order.createdAt)}</span>
              {order.closedAt && (
                <>
                  <span className="hdd-sh-div">|</span>
                  <span>🗓️ {fmtDate(order.closedAt)}</span>
                </>
              )}
            </div>

            <div className="hdd-body">
              {/* Info Cliente */}
              <div className="hdd-client-card">
                <div className="hdd-client-icon">👤</div>
                <div className="hdd-client-info">
                  <div className="hdd-client-name">{order.client?.name || 'Sin cliente'}</div>
                  {order.client?.phone && <div className="hdd-client-phone">+56 {order.client.phone}</div>}
                  {order.type === 'delivery' && order.client?.addr && (
                    <div className="hdd-client-addr">📍 {order.client.addr}</div>
                  )}
                </div>
              </div>

              {/* Sección Productos */}
              <div className="hdd-items-section">
                <div className="hdd-items-header">
                  <span>Productos</span>
                  <button className="hdd-kitchen-btn">🖨️ Cocina</button>
                </div>
                
                <div className="hdd-items-list">
                  {(order.items || []).map((item, i) => {
                    const mods = displayMods(item);
                    return (
                      <div key={item.id || i} className="hdd-item">
                        <div className="hdd-item-main">
                          <div className="hdd-item-left">
                            <span className="hdd-item-qty">{item.qty}×</span>
                            <span className="hdd-item-name">{item.name}</span>
                          </div>
                          <span className="hdd-item-total">{fmt(item.total)}</span>
                        </div>
                        {item.variant || mods.length > 0 ? (
                          <div className="hdd-item-meta">
                            {item.variant && <span className="hdd-item-variant">({item.variant})</span>}
                            {mods.length > 0 && <span className="hdd-item-mods">{mods.join(', ')}</span>}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="hdd-footer">
              <div className="hdd-footer-subtotal">
                <span>Subtotal</span>
                <span>{fmt(breakdown.subtotal)}</span>
              </div>
              
              {hasExtras && (
                <div className="hdd-footer-extras">
                  {breakdown.discount > 0 && (
                    <div className="hdd-footer-extra-row">
                      <span>Descuento</span>
                      <span>-{fmt(breakdown.discount)}</span>
                    </div>
                  )}
                  {breakdown.delivery > 0 && (
                    <div className="hdd-footer-extra-row">
                      <span>Delivery</span>
                      <span>{fmt(breakdown.delivery)}</span>
                    </div>
                  )}
                  {breakdown.tip > 0 && (
                    <div className="hdd-footer-extra-row">
                      <span>Propina</span>
                      <span>{fmt(breakdown.tip)}</span>
                    </div>
                  )}
                  {breakdown.servicio > 0 && (
                    <div className="hdd-footer-extra-row">
                      <span>Servicio</span>
                      <span>{fmt(breakdown.servicio)}</span>
                    </div>
                  )}
                  {breakdown.empaque > 0 && (
                    <div className="hdd-footer-extra-row">
                      <span>Empaque</span>
                      <span>{fmt(breakdown.empaque)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className={`hdd-footer-total-row${hasExtras ? ' hdd-footer-total-row--with-divider' : ''}`}>
                {order.paid ? (
                  <span className="hdd-paid-badge hdd-paid-badge--yes">✓ Pagado</span>
                ) : (
                  <span className="hdd-paid-badge hdd-paid-badge--no">Pendiente</span>
                )}
                <span className="hdd-total-val">{fmt(order.total)}</span>
              </div>
              
              <div className="hdd-footer-method">
                💳 {order.paymentMethod || order.payMethod || 'Sin método'}
              </div>

              <div className="hdd-footer-actions">
                <button className="hdd-btn hdd-btn-secondary" onClick={() => setView('payment')}>Pago</button>
                <button className="hdd-btn hdd-btn-primary">Facturación electrónica</button>
              </div>
            </div>
          </>
        )}

        {view === 'payment' && (
          <>
            {/* VISTA PAGOS */}
            <div className="hdd-header">
              <div className="hdd-header-left" style={{ cursor: 'pointer' }} onClick={() => setView('detail')}>
                <span className="hdd-header-num">← Registrar pago</span>
              </div>
              <button className="hdd-close-btn" onClick={onClose}>✕</button>
            </div>

            <div className="hdd-subheader hdd-subheader--payment">
              <div className="hdd-sh-total-wrap">
                <span className="hdd-sh-total-lbl">TOTAL</span>
                <span className="hdd-sh-total-val">{fmt(order.total)}</span>
              </div>
              {order.paid ? (
                <span className="hdd-paid-badge hdd-paid-badge--sm hdd-paid-badge--yes">Pagado</span>
              ) : (
                <span className="hdd-paid-badge hdd-paid-badge--sm" style={{ background: 'var(--surface3)', color: 'var(--muted)', borderColor: 'var(--border)' }}>Pendiente</span>
              )}
            </div>

            <div className="hdd-body">
              {hasPayment ? (
                <div className="hdd-payment-card">
                  <div className="hdd-payment-card-left">
                    <span className="hdd-payment-method">
                      💳 {order.paymentMethod || order.payMethod}
                    </span>
                    <span className="hdd-payment-date">
                      {order.closedAt ? fmtDate(order.closedAt) : fmtDate(order.createdAt)}
                    </span>
                  </div>
                  <div className="hdd-payment-card-right">
                    <span className="hdd-payment-amount">{fmt(order.total)}</span>
                    <div className="hdd-payment-actions">
                      <button className="hdd-payment-actions-btn" onClick={() => setShowPaymentMenu(true)} title="Opciones">⋮</button>
                      
                      {showPaymentMenu && (
                        <>
                          <div className="hdd-payment-menu-overlay" onClick={(e) => { e.stopPropagation(); setShowPaymentMenu(false); }} />
                          <div className="hdd-payment-menu">
                            <button className="hdd-payment-menu-btn" onClick={(e) => { e.stopPropagation(); handleDeletePayment(); }}>Anular</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
                  No hay pagos registrados
                </div>
              )}
            </div>

            <div className="hdd-footer">
              <button className="hdd-add-payment-btn" onClick={() => setView('add-payment')}>+ Añadir otro pago</button>
            </div>
          </>
        )}

        {view === 'add-payment' && (
          <>
            {/* VISTA AÑADIR PAGO */}
            <div className="hdd-header">
              <div className="hdd-header-left" style={{ cursor: 'pointer' }} onClick={() => setView('payment')}>
                <span className="hdd-header-num">← Seleccionar método</span>
              </div>
              <button className="hdd-close-btn" onClick={onClose}>✕</button>
            </div>

            <div className="hdd-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['Efectivo', 'Débito', 'Transferencia'].map(method => (
                  <button
                    key={method}
                    style={{
                      padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                      background: 'var(--surface)', color: 'var(--text)', fontSize: '15px', fontWeight: '600',
                      textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'var(--surface)'}
                    onClick={() => handleAddPayment(method)}
                  >
                    💳 {method}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
