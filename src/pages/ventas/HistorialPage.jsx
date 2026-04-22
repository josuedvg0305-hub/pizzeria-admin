import { useState, useMemo, useEffect } from 'react'
import { useOrders } from '../../context/OrdersContext'
import SalesFilterDrawer, {
  INIT_SALES_FILTERS,
  countSalesFilters,
} from '../../components/ventas/SalesFilterDrawer'
import HistoryDetailDrawer from './HistoryDetailDrawer'
import './HistorialPage.css'

const fmt = (n) => `$${Number(n).toLocaleString('es-CL')}`

const STATUS_LABEL = {
  pend:        'Pendiente',
  preparacion: 'Preparación',
  listo:       'Listo',
  finalizado:  'Finalizado',
  cancelado:   'Cancelado',
}

const TYPE_LABEL = {
  flash:    'Flash',
  local:    'En local',
  llevar:   'Para llevar',
  delivery: 'Delivery',
  mesa:     'Mesa',
}

function fmtDate(d) {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function HistorialPage() {
  const { orders, updateOrder, fetchOrders } = useOrders()

  const [quickFilter,   setQuickFilter]   = useState('today')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')
  const [salesFilters,  setSalesFilters]  = useState(INIT_SALES_FILTERS)
  const [showDrawer,    setShowDrawer]    = useState(false)
  const [originFilter,  setOriginFilter]  = useState('all')
  const [selectedOrder, setSelectedOrder] = useState(null)

  // Cuando cambia el filtro rápido, calculamos fechas y cargamos de Supabase
  useEffect(() => {
    if (quickFilter === 'custom') return;

    const now = new Date()
    let startD = new Date(now)
    let endD = new Date(now)

    if (quickFilter === 'today') {
      startD.setHours(0, 0, 0, 0)
      endD.setHours(23, 59, 59, 999)
    } else if (quickFilter === 'yesterday') {
      startD.setDate(now.getDate() - 1); startD.setHours(0, 0, 0, 0)
      endD.setDate(now.getDate() - 1); endD.setHours(23, 59, 59, 999)
    } else if (quickFilter === '7days') {
      startD.setDate(now.getDate() - 6); startD.setHours(0, 0, 0, 0)
      endD.setHours(23, 59, 59, 999)
    } else if (quickFilter === '14days') {
      startD.setDate(now.getDate() - 13); startD.setHours(0, 0, 0, 0)
      endD.setHours(23, 59, 59, 999)
    } else if (quickFilter === '30days') {
      startD.setDate(now.getDate() - 29); startD.setHours(0, 0, 0, 0)
      endD.setHours(23, 59, 59, 999)
    }

    const fmtYMD = (d) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    // Actualizamos inputs locales pero de forma invisible si no es custom
    setDateFrom(fmtYMD(startD))
    setDateTo(fmtYMD(endD))

    // Disparamos fetch a Supabase usando startD y endD
    fetchOrders(startD, endD)
  }, [quickFilter, fetchOrders])

  const handleCustomSearch = () => {
    if (!dateFrom || !dateTo) {
      alert("Debes seleccionar ambas fechas"); return;
    }
    const start = new Date(dateFrom + 'T00:00:00')
    const end = new Date(dateTo + 'T23:59:59.999')
    fetchOrders(start, end)
  }

  const handleUpdateOrder = (id, changes) => {
    updateOrder(id, changes);
    if (selectedOrder?.id === id) {
      setSelectedOrder(prev => ({ ...prev, ...changes }));
    }
  };

  const filterCount = countSalesFilters(salesFilters)

  /* Apply all filters */
  const displayed = useMemo(() => {
    let result = [...orders]

    /* Date range */
    if (dateFrom) {
      const from = new Date(dateFrom + 'T00:00:00')
      result = result.filter(o => {
        const d = o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)
        return d >= from
      })
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59.999')
      result = result.filter(o => {
        const d = o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)
        return d <= to
      })
    }

    /* Origin pill quick filter */
    if (originFilter !== 'all') {
      if (originFilter === 'PDV / WEB') {
        result = result.filter(o => ['PDV', 'Web'].includes(o.origin ?? 'PDV'))
      } else if (originFilter === 'Aplicaciones') {
        result = result.filter(o => !['PDV', 'Web'].includes(o.origin ?? 'PDV'))
      } else {
        result = result.filter(o => (o.origin ?? 'PDV') === originFilter)
      }
    }

    /* Drawer filters */
    if (salesFilters.origins.length > 0)
      result = result.filter(o => salesFilters.origins.includes(o.origin ?? 'PDV'))
    if (salesFilters.types.length > 0)
      result = result.filter(o => salesFilters.types.includes(o.type))
    if (salesFilters.statuses.length > 0)
      result = result.filter(o => salesFilters.statuses.includes(o.status))
    if (salesFilters.paid.length > 0)
      result = result.filter(o =>
        (salesFilters.paid.includes('paid')   && o.paid) ||
        (salesFilters.paid.includes('unpaid') && !o.paid)
      )
    if (salesFilters.payMethod.length > 0)
      result = result.filter(o => salesFilters.payMethod.includes(o.paymentMethod ?? o.payMethod))

    /* Sort by newest */
    result.sort((a, b) => {
      const da = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
      const db = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)
      return db - da
    })

    return result
  }, [orders, dateFrom, dateTo, salesFilters, originFilter])

  /* Summary — exclude deleted and cancelled */
  const summary = useMemo(() => {
    const valid = displayed.filter(o => !o.deleted && o.status !== 'cancelado')
    return {
      count: valid.length,
      total: valid.reduce((s, o) => s + o.total, 0),
    }
  }, [displayed])

  /* Exportation to CSV (Excel) */
  const handleExportExcel = () => {
    if (displayed.length === 0) {
      alert('No hay pedidos para exportar.');
      return;
    }

    const escapeCSV = (value) => {
      if (value == null) return '';
      let str = String(value);
      if (str.includes('"') || str.includes(';') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatItems = (items) => {
      if (!items || items.length === 0) return '';
      return items.map(i => {
        let text = `${i.qty}x ${i.name}`;
        const mods = i.modifiers?.length ? i.modifiers.map(m => typeof m === 'string' ? m : m.name) : (i.mods || []);
        if (mods.length > 0) {
          text += ` (+${mods.join(', ')})`;
        }
        return text;
      }).join(' | ');
    };

    const formatDate = (dateObj) => {
      if (!dateObj) return '';
      const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hrs = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hrs}:${mins}`;
    };

    const headers = [
      'Nº Pedido', 'Origen', 'Fecha Creación', 'Fecha Cierre', 'Estado', 'Tipo', 'Cliente', 
      'Teléfono', 'Dirección', 'Detalle Ítems', 'Notas y Comentarios', 'Subtotal Ítems',
      'Tipo Descuento', 'Valor Ingresado Dcto', 'Monto Descontado Real', 'Delivery', 
      'Propina', 'Servicio', 'Empaque', 'Total Final', 'Estado Pago', 'Método Pago'
    ];

    let csvContent = '\uFEFF'; // BOM para asegurar codificación en Excel
    csvContent += headers.map(escapeCSV).join(';') + '\n';

    displayed.forEach(order => {
      const itemsStr = formatItems(order.items);
      
      const notes = [order.note, order.comments].filter(Boolean).join(' - ');
      const subtotalItems = (order.items || []).reduce((s, i) => s + (i.total || (i.price * i.qty) || 0), 0);
      
      let tipStr = '';
      if (order.charges?.tipMode && order.charges?.tipVal) {
        tipStr = order.charges.tipMode === '%' ? `${order.charges.tipVal}%` : `$${order.charges.tipVal}`;
      } else if (order.tip) {
        tipStr = `$${order.tip}`; // Fallback legacy
      }

      const row = [
        order.num,
        order.origin || 'PDV',
        formatDate(order.createdAt),
        formatDate(order.closedAt),
        STATUS_LABEL[order.status] || order.status,
        TYPE_LABEL[order.type] || order.type,
        order.client?.name || 'Sin nombre',
        order.client?.phone || '',
        order.client?.addr || '',
        itemsStr,
        notes,
        subtotalItems,
        order.discountMode || '',
        order.discountVal || 0,
        order.discount || 0,
        order.charges?.delivery || 0,
        tipStr,
        order.charges?.servicio || 0,
        order.charges?.empaque || 0,
        order.total,
        order.paid ? 'Pagado' : 'Pendiente',
        order.paymentMethod || order.payMethod || '-'
      ];

      csvContent += row.map(escapeCSV).join(';') + '\n';
    });

    const d = new Date();
    const currentDay = String(d.getDate()).padStart(2, '0');
    const currentMonth = String(d.getMonth() + 1).padStart(2, '0');
    const currentYear = d.getFullYear();
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const filename = `ventas_filtradas_${currentYear}${currentMonth}${currentDay}_${hrs}${mins}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  return (

    <div className="hp-page">
      {/* ── Top Toolbar ── */}
      <div className="hp-top-toolbar">
        <div className="hp-tt-left">
          {/* Quick Date Filters Dropdown */}
          <select 
            className="hp-select-input"
            style={{ fontWeight: 600, color: 'var(--text-main)', marginRight: '8px' }}
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
          >
            <option value="today">Hoy</option>
            <option value="yesterday">Ayer</option>
            <option value="7days">Últimos 7 días</option>
            <option value="14days">Últimos 14 días</option>
            <option value="30days">Últimos 30 días</option>
            <option value="custom">Personalizado</option>
          </select>

          {/* Solo se muestran los inputs si el filtro es 'Personalizado' */}
          {quickFilter === 'custom' && (
            <>
              <input
                type="date"
                className="hp-date-input"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
              <span className="hp-tt-sep">-</span>
              <input
                type="date"
                className="hp-date-input"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </>
          )}

          <select className="hp-select-input" defaultValue="all_day" style={{ marginLeft: quickFilter === 'custom' ? '8px' : '0' }}>
            <option value="all_day">Día entero</option>
          </select>
          <select className="hp-select-input" defaultValue="creation">
            <option value="creation">Creación</option>
          </select>
        </div>

        <div className="hp-tt-right">
          <button className="btn btn-ghost btn-icon" title="Recargar" onClick={() => fetchOrders()}>↻</button>
          
          {quickFilter === 'custom' && (
            <button className="btn btn-secondary" title="Buscar fechas personalizadas" onClick={handleCustomSearch}>Buscar</button>
          )}
          
          <button className="btn btn-ghost btn-icon" title="Buscar" style={{ display: quickFilter === 'custom' ? 'none' : 'inline-block' }}>🔍</button>
          <button className="btn btn-secondary">Reporte WhatsApp</button>
          <button className="btn btn-success" onClick={handleExportExcel}>Excel</button>
          <button className="btn btn-primary">Exportar</button>
        </div>
      </div>

      {/* ── Sub-Toolbar ── */}
      <div className="hp-sub-toolbar">
        <div className="hp-st-filters">
          <IconFilter onClick={() => setShowDrawer(true)} className={`hp-icon-filter ${filterCount > 0 ? 'active' : ''}`} />
          {['all', 'PDV / WEB', 'Aplicaciones'].map(o => (
            <button
              key={o}
              className={`hp-pill ${originFilter === o ? 'hp-pill--active' : ''}`}
              onClick={() => setOriginFilter(o)}
            >
              {o === 'all' ? 'Todo' : o}
            </button>
          ))}
          {filterCount > 0 && (
            <button className="hp-pill hp-pill--active" onClick={() => setShowDrawer(true)}>
              Avanzados ({filterCount})
            </button>
          )}
        </div>

        <div className="hp-st-spacer"></div>

        <button className="btn btn-blue hp-resumen-btn">Resumen de caja ▾</button>

        <div className="hp-st-summary">
          <span>Pedidos: {summary.count}</span>
          <span className="hp-st-total">Total: {fmt(summary.total)}</span>
          <IconEye />
        </div>
      </div>

      {/* ── Main content (Data Grid) ── */}
      <div className="hp-content">
        <div className="hp-grid-container">
          <div className="hp-grid-header">
            <div>ID / ESTADO</div>
            <div>ORIGEN</div>
            <div>FECHAS</div>
            <div>CLIENTE</div>
            <div>PAGO</div>
            <div className="hp-col-right">TOTAL</div>
          </div>

          <div className="hp-grid-body">
            {displayed.length === 0 ? (
              <div className="hp-empty">Sin pedidos para los filtros aplicados</div>
            ) : (
              displayed.map(order => {
                const isCancelled = order.status === 'cancelado'
                const isDeleted = order.deleted
                
                return (
                  <div
                    key={order.id}
                    className={`hp-grid-row ${isDeleted ? 'hp-row--deleted' : ''} ${isCancelled ? 'hp-row--cancelled' : ''}`}
                    onClick={() => setSelectedOrder(order)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* ID / ESTADO */}
                    <div className="hp-cell-col">
                      <span className="hp-row-num">#{order.num}</span>
                      <span className={`hp-status-badge hp-status--${order.status}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>

                    {/* ORIGEN */}
                    <div className="hp-cell-col">
                      <span className="hp-text-main">{order.origin ?? 'PDV'}</span>
                      <span className="hp-text-muted">{TYPE_LABEL[order.type] ?? order.type}</span>
                    </div>

                    {/* FECHAS */}
                    <div className="hp-cell-col">
                      <span className="hp-text-main">
                         📅 {fmtDate(order.createdAt)}
                      </span>
                      {order.closedAt && (
                        <span className="hp-text-muted">
                          🏁 {fmtDate(order.closedAt)}
                        </span>
                      )}
                    </div>

                    {/* CLIENTE */}
                    <div className="hp-cell-col">
                      {order.client?.name || order.client?.phone ? (
                        <>
                          {order.client.name && <span className="hp-text-main">{order.client.name}</span>}
                          {order.client.phone && <span className="hp-text-muted">+56 {order.client.phone}</span>}
                        </>
                      ) : (
                        <span className="hp-text-muted">Sin cliente</span>
                      )}
                    </div>

                    {/* PAGO / MÉTODO */}
                    <div className="hp-cell-col">
                      <span className={`hp-paid-status ${order.paid ? 'is-paid' : 'is-unpaid'}`}>
                        {order.paid ? '✓ Pagado' : 'Pendiente'}
                      </span>
                      {order.paymentMethod || order.payMethod ? (
                        <span className="hp-text-muted">{order.paymentMethod ?? order.payMethod}</span>
                      ) : (
                        <span className="hp-text-muted">—</span>
                      )}
                    </div>

                    {/* TOTAL */}
                    <div className="hp-cell-col hp-col-right hp-text-bold">
                      {fmt(order.total)}
                      {isDeleted && <div className="hp-text-muted" style={{fontSize: '11px'}}>Eliminado</div>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="hp-footer">
        <div className="hp-footer-left">
          <span>Elementos por página:</span>
          <select className="hp-select-sm" defaultValue="20">
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        <div className="hp-footer-right">
          <span>1 - {Math.min(20, displayed.length)} de {displayed.length}</span>
          <button className="hp-page-btn" disabled>←</button>
          <button className="hp-page-btn" disabled={displayed.length <= 20}>→</button>
        </div>
      </div>

      {/* Filter drawer */}
      {showDrawer && (
        <SalesFilterDrawer
          filters={salesFilters}
          onChange={setSalesFilters}
          onClose={() => setShowDrawer(false)}
        />
      )}

      {/* Detail Drawer */}
      {selectedOrder && (
        <HistoryDetailDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateOrder={handleUpdateOrder}
        />
      )}
    </div>
  )
}

function IconFilter({ onClick, className }) {
  return (
    <svg onClick={onClick} className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ cursor: 'pointer', flexShrink: 0 }}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  )
}

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--muted)', cursor: 'pointer' }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  )
}
