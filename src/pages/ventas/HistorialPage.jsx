import { useState, useMemo, useEffect } from 'react'
import { useOrders } from '../../context/OrdersContext'
import { supabase } from '../../lib/supabase'
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

function mapOrderFromDB(o) {
  return {
    ...o,
    client:        o.client_snapshot,
    discountMode:  o.discount_mode,
    discountVal:   o.discount_val,
    paymentMethod: o.payment_method,
    createdAt:     new Date(o.created_at),
    closedAt:      o.closed_at   ? new Date(o.closed_at)   : null,
    scheduledAt:   o.scheduled_at ? new Date(o.scheduled_at) : null,
  }
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
  const { updateOrder } = useOrders()

  const [quickFilter,   setQuickFilter]   = useState('today')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')
  const [salesFilters,  setSalesFilters]  = useState(INIT_SALES_FILTERS)
  const [showDrawer,    setShowDrawer]    = useState(false)
  const [originFilter,  setOriginFilter]  = useState('all')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [historicalOrders, setHistoricalOrders] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)

  const fetchHistoricalData = async (start = null, end = null) => {
    setLoadingHistory(true)
    try {
      let query = supabase.from('orders').select('*')
      if (start) query = query.gte('created_at', start.toISOString())
      if (end) query = query.lte('created_at', end.toISOString())
      
      query = query.order('created_at', { ascending: false })
      
      const { data, error } = await query
      if (error) {
        console.error('Error fetching historical orders:', error)
      } else if (data) {
        setHistoricalOrders(data.map(mapOrderFromDB))
      }
    } finally {
      setLoadingHistory(false)
    }
  }

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
    fetchHistoricalData(startD, endD)
  }, [quickFilter])

  // Auto-fetch for custom date range when both dates are set
  useEffect(() => {
    if (quickFilter !== 'custom') return
    if (!dateFrom || !dateTo) return
    const start = new Date(dateFrom + 'T00:00:00')
    const end   = new Date(dateTo   + 'T23:59:59.999')
    fetchHistoricalData(start, end)
  }, [quickFilter, dateFrom, dateTo])

  const handleReload = () => {
    if (dateFrom && dateTo) {
      const start = new Date(dateFrom + 'T00:00:00')
      const end = new Date(dateTo + 'T23:59:59.999')
      fetchHistoricalData(start, end)
    } else {
      fetchHistoricalData()
    }
  }

  const handleUpdateOrder = (id, changes) => {
    updateOrder(id, changes);
    setHistoricalOrders(prev => prev.map(o => o.id === id ? { ...o, ...changes } : o));
    if (selectedOrder?.id === id) {
      setSelectedOrder(prev => ({ ...prev, ...changes }));
    }
  };

  const filterCount = countSalesFilters(salesFilters)

  /* Apply all filters */
  const displayed = useMemo(() => {
    let result = [...historicalOrders]

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
    if (salesFilters.payMethod.length > 0) {
      // Normalize filter values to lowercase for case-insensitive comparison
      const filterNorm = salesFilters.payMethod.map(m => m.toLowerCase())
      result = result.filter(o => {
        const canonical = (o.paymentMethod ?? o.payMethod ?? '').toLowerCase()
        // For Mixto orders: check if any split payment matches the filter
        if (canonical === 'mixto' && Array.isArray(o.payments) && o.payments.length > 0) {
          // A filter for 'Mixto' directly matches
          if (filterNorm.includes('mixto')) return true
          // Or if any split method matches one of the active filters
          return o.payments.some(p => filterNorm.includes((p.method ?? '').toLowerCase()))
        }
        return filterNorm.includes(canonical)
      })
    }

    /* Live text search — by order num, client name, or phone */
    if (searchQuery.trim()) {
      const q = searchQuery.trim()
      const qDigits = q.replace(/\D/g, '')
      result = result.filter(o => {
        if (String(o.num).includes(q)) return true
        if (o.client?.name?.toLowerCase().includes(q.toLowerCase())) return true
        if (qDigits && o.client?.phone?.replace(/\D/g, '').includes(qDigits)) return true
        return false
      })
    }

    /* Sort by newest */
    result.sort((a, b) => {
      const da = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
      const db = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)
      return db - da
    })

    return result
  }, [historicalOrders, dateFrom, dateTo, salesFilters, originFilter, searchQuery])

  /* Summary — exclude deleted and cancelled */
  const summary = useMemo(() => {
    const valid = displayed.filter(o => !o.deleted && o.status !== 'cancelado')
    const payFilter = salesFilters.payMethod
    // Normalize for case-insensitive matching
    const filterNorm = payFilter.map(m => m.toLowerCase())

    /* Helper: amount attributable to the active payMethod filter for one order */
    const methodAmount = (o) => {
      if (payFilter.length === 0) return o.total   // no filter → full total

      const canonical = (o.paymentMethod ?? o.payMethod ?? '').toLowerCase()

      // New split-payment (Mixto) orders: sum only the matching fractions
      if (canonical === 'mixto' && Array.isArray(o.payments) && o.payments.length > 0) {
        // If filter explicitly includes 'Mixto', return the full total
        if (filterNorm.includes('mixto')) return o.total
        // Otherwise sum only the fractions that match the active method filters
        return o.payments
          .filter(p => filterNorm.includes((p.method ?? '').toLowerCase()))
          .reduce((s, p) => s + (Number(p.amount) || 0), 0)
      }

      // Legacy / single-method orders: all-or-nothing
      return filterNorm.includes(canonical) ? o.total : 0
    }

    return {
      count: valid.length,
      total: valid.reduce((s, o) => s + methodAmount(o), 0),
    }
  }, [displayed, salesFilters.payMethod])

  /* Cash Summary — financial breakdown of the currently displayed orders */
  const cashSummary = useMemo(() => {
    const valid = displayed.filter(o => !o.deleted && o.status !== 'cancelado')

    let totalDelivery  = 0
    let totalProductos = 0
    let totalGeneral   = 0
    const pedidosPorTipo      = {}
    const ingresosPorMetodo   = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 }

    valid.forEach(o => {
      const delivery = Number(o.charges?.delivery) || 0
      const total    = Number(o.total) || 0

      totalDelivery  += delivery
      totalProductos += total - delivery
      totalGeneral   += total

      // Volume by type
      const tipo = o.type ?? 'otro'
      pedidosPorTipo[tipo] = (pedidosPorTipo[tipo] || 0) + 1

      // Revenue by payment method — split-payment aware
      const canonical = (o.paymentMethod ?? o.payMethod ?? '').toLowerCase()
      if (canonical === 'mixto' && Array.isArray(o.payments) && o.payments.length > 0) {
        o.payments.forEach(p => {
          const key = p.method ?? ''
          if (key in ingresosPorMetodo) {
            ingresosPorMetodo[key] += Number(p.amount) || 0
          }
        })
      } else {
        const methodKey = Object.keys(ingresosPorMetodo).find(
          k => k.toLowerCase() === canonical
        )
        if (methodKey) ingresosPorMetodo[methodKey] += total
      }
    })

    return { totalDelivery, totalProductos, totalGeneral, pedidosPorTipo, ingresosPorMetodo, count: valid.length }
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {/* Quick Date Filters Dropdown */}
          <select 
            className="hp-select-input"
            style={{ fontWeight: 600, color: 'var(--text-main)' }}
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
            <div className="flex items-center gap-2">
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
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-icon" title="Recargar" onClick={handleReload} disabled={loadingHistory}>↻</button>

          {/* Live search input */}
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-[var(--muted)] pointer-events-none text-sm">🔍</span>
            <input
              type="text"
              placeholder="N°, Nombre o Teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input text-sm py-1.5 pl-8 pr-3 w-56 rounded-md border border-[var(--border)] focus:border-[var(--brand)] outline-none"
            />
          </div>

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

        <button
          className="btn btn-blue hp-resumen-btn flex items-center gap-1.5"
          onClick={() => setIsSummaryOpen(prev => !prev)}
        >
          Resumen de caja
          <span
            className="inline-block transition-transform duration-200"
            style={{ transform: isSummaryOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >▾</span>
        </button>

        <div className="hp-st-summary">
          <span className="!text-base">Pedidos: {summary.count}</span>
          <span className="hp-st-total !text-base !font-bold">Total: {fmt(summary.total)}</span>
          <IconEye />
        </div>
      </div>

      {/* ── Cash Summary Accordion ── */}
      {isSummaryOpen && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Col 1 — Ingresos */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ingresos</p>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-gray-500">Productos / Servicio</span>
                <span className="text-base font-bold text-gray-800">{fmt(cashSummary.totalProductos)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-gray-500">Delivery</span>
                <span className="text-base font-bold text-gray-800">{fmt(cashSummary.totalDelivery)}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-gray-100 pt-3">
                <span className="text-sm font-semibold text-gray-700">Gran Total</span>
                <span className="text-lg font-extrabold" style={{ color: 'var(--brand)' }}>{fmt(cashSummary.totalGeneral)}</span>
              </div>
            </div>
          </div>

          {/* Col 2 — Métodos de Pago */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Métodos de Pago</p>
            <div className="space-y-3">
              {Object.entries(cashSummary.ingresosPorMetodo).map(([method, amount]) => (
                <div key={method} className="flex justify-between items-baseline">
                  <span className="text-sm text-gray-500">{method}</span>
                  <span className={`text-base font-bold ${amount > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                    {fmt(amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Col 3 — Volumen de Pedidos */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Volumen</p>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold text-gray-700">Total Pedidos</span>
                <span className="text-lg font-extrabold text-gray-800">{cashSummary.count}</span>
              </div>
              {Object.entries(cashSummary.pedidosPorTipo)
                .sort((a, b) => b[1] - a[1])
                .map(([tipo, count]) => (
                  <div key={tipo} className="flex justify-between items-baseline">
                    <span className="text-sm text-gray-500">{TYPE_LABEL[tipo] ?? tipo}</span>
                    <span className="text-base font-bold text-gray-800">{count}</span>
                  </div>
                ))
              }
            </div>
          </div>

        </div>
      )}

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
            {loadingHistory ? (
              <div className="hp-empty">Cargando historial...</div>
            ) : displayed.length === 0 ? (
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
                      <span className="hp-row-num !text-base !font-bold">#{order.num}</span>
                      <span className={`hp-status-badge hp-status--${order.status} !text-xs`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>

                    {/* ORIGEN */}
                    <div className="hp-cell-col">
                      <span className="hp-text-main !text-sm">{order.origin ?? 'PDV'}</span>
                      <span className="hp-text-muted !text-xs">{TYPE_LABEL[order.type] ?? order.type}</span>
                    </div>

                    {/* FECHAS */}
                    <div className="hp-cell-col">
                      <span className="hp-text-main !text-sm">
                         📅 {fmtDate(order.createdAt)}
                      </span>
                      {order.closedAt && (
                        <span className="hp-text-muted !text-xs">
                          🏁 {fmtDate(order.closedAt)}
                        </span>
                      )}
                    </div>

                    {/* CLIENTE */}
                    <div className="hp-cell-col">
                      {order.client?.name || order.client?.phone ? (
                        <>
                          {order.client.name && <span className="hp-text-main !text-sm !font-semibold">{order.client.name}</span>}
                          {order.client.phone && <span className="hp-text-muted !text-xs">+56 {order.client.phone}</span>}
                        </>
                      ) : (
                        <span className="hp-text-muted !text-xs">Sin cliente</span>
                      )}
                    </div>

                    {/* PAGO / MÉTODO */}
                    <div className="hp-cell-col">
                      <span className={`hp-paid-status ${order.paid ? 'is-paid' : 'is-unpaid'} !text-sm !font-semibold`}>
                        {order.paid ? '✓ Pagado' : 'Pendiente'}
                      </span>
                      {order.paymentMethod || order.payMethod ? (
                        <span className="hp-text-muted !text-xs">{order.paymentMethod ?? order.payMethod}</span>
                      ) : (
                        <span className="hp-text-muted !text-xs">—</span>
                      )}
                    </div>

                    {/* TOTAL */}
                    <div className="hp-cell-col hp-col-right hp-text-bold !text-base !font-bold">
                      {fmt(order.total)}
                      {isDeleted && <div className="hp-text-muted !text-xs">Eliminado</div>}
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
