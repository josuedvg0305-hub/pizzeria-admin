import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  Label,
  BarChart,
  Bar,
} from 'recharts'

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`

const RANGE_OPTIONS = [
  { label: 'Hoy',            value: '0' },
  { label: 'Últimos 7 días', value: '7' },
  { label: 'Últimos 30 días',value: '30' },
  { label: 'Este mes',       value: 'month' },
  { label: 'Este año',       value: 'year' },
]

const ORDER_TYPE_LABELS = {
  flash:    'Flash',
  local:    'Local',
  llevar:   'Para Llevar',
  delivery: 'Delivery',
  mesa:     'Mesa',
}

const PIE_COLORS = ['#C0392B', '#2563eb', '#f59e0b', '#16a34a', '#8b5cf6']

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// ─── Función de rango de fechas ────────────────────────────────────────────

function getDateRange(rangeValue) {
  const now   = new Date()
  const end   = new Date(now)
  end.setHours(23, 59, 59, 999)

  let start = new Date(now)

  if (rangeValue === '0') {
    start.setHours(0, 0, 0, 0)
  } else if (rangeValue === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  } else if (rangeValue === 'year') {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
  } else {
    const days = parseInt(rangeValue, 10)
    start.setDate(now.getDate() - days)
    start.setHours(0, 0, 0, 0)
  }

  return { start, end }
}

// ─── Agregaciones ─────────────────────────────────────────────────────────

function computeKPIs(orders) {
  const totalSales   = orders.reduce((acc, o) => acc + (o.total ?? 0), 0)
  const totalOrders  = orders.length
  const avgTicket    = totalOrders > 0 ? totalSales / totalOrders : 0
  return { totalSales, totalOrders, avgTicket }
}

function computeDailySales(orders, rangeValue) {
  if (orders.length === 0) return []

  // Construir un mapa de fecha → { sales, orders }
  const map = {}

  orders.forEach(o => {
    const d     = new Date(o.created_at)
    const key   = d.toISOString().split('T')[0]           // 'YYYY-MM-DD'
    if (!map[key]) map[key] = { sales: 0, orders: 0, _date: d }
    map[key].sales  += o.total ?? 0
    map[key].orders += 1
  })

  // Rellenar días faltantes del rango
  const { start, end } = getDateRange(rangeValue)
  const filled = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)

  while (cursor <= end) {
    const key  = cursor.toISOString().split('T')[0]
    const data = map[key] ?? { sales: 0, orders: 0, _date: new Date(cursor) }
    const d    = data._date ?? cursor

    let label
    if (rangeValue === 'year') {
      label = MONTH_NAMES[d.getMonth()]
    } else if (rangeValue === '0') {
      label = `${d.getHours()}h`
    } else {
      label = `${DAY_NAMES[d.getDay()]} ${d.getDate()}`
    }

    filled.push({ date: label, sales: data.sales, orders: data.orders })

    if (rangeValue === 'year') {
      cursor.setMonth(cursor.getMonth() + 1)
    } else {
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return filled
}

function computeByType(orders) {
  const map = orders.reduce((acc, o) => {
    const type = o.type ?? 'local'
    acc[type]  = (acc[type] ?? 0) + 1
    return acc
  }, {})

  return Object.entries(map).map(([type, count]) => ({
    name:  ORDER_TYPE_LABELS[type] ?? type,
    value: count,
  }))
}

function computeTopProducts(orders) {
  const map = {}

  orders.forEach(o => {
    const items = Array.isArray(o.items) ? o.items : []
    items.forEach(item => {
      const name = item.name ?? 'Producto'
      if (!map[name]) map[name] = { name, qty: 0, revenue: 0 }
      map[name].qty     += item.qty ?? 1
      map[name].revenue += item.total ?? 0
    })
  })

  return Object.values(map)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
}

// ─── Componentes de UI auxiliares ─────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color = 'text-red-700' }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <span className={`text-2xl ${color}`}>{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${color} leading-none`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">{children}</h2>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 animate-pulse">
      <div className="h-3 w-24 bg-gray-200 rounded" />
      <div className="h-8 w-32 bg-gray-200 rounded" />
      <div className="h-3 w-16 bg-gray-200 rounded" />
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse flex flex-col gap-4">
      <div className="h-3 w-32 bg-gray-200 rounded" />
      <div className="flex-1 bg-gray-100 rounded-xl min-h-[180px]" />
    </div>
  )
}

// ─── Custom Tooltip para gráfico de línea ─────────────────────────────────

function CustomLineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-4 py-3 text-sm">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name === 'sales'
            ? `Ventas: ${fmt(p.value)}`
            : `Pedidos: ${p.value}`}
        </p>
      ))}
    </div>
  )
}

// ─── Custom Tooltip para Pie ───────────────────────────────────────────────

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-4 py-3 text-sm">
      <p className="font-bold" style={{ color: d.payload.fill }}>{d.name}</p>
      <p className="text-gray-600">{d.value} pedidos</p>
    </div>
  )
}

// ─── Custom label en el centro del Donut ──────────────────────────────────
// Renderizado vía prop content= en <Label> de recharts (patrón correcto).
// El guard `if (!viewBox)` previene el crash cuando recharts pasa undefined
// durante el primer ciclo de layout.
function DonutCenterLabel({ viewBox, total }) {
  if (!viewBox) return null
  const { cx, cy } = viewBox
  return (
    <g>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fill="#111827"
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'DM Sans, sans-serif' }}
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fill="#9ca3af"
        style={{ fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
      >
        pedidos
      </text>
    </g>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────

export default function ReportesPage() {
  const [range,   setRange]   = useState('7')
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Fetch de Supabase ───────────────────────────────────────────────────────
  const fetchReportData = useCallback(async (rangeValue) => {
    setLoading(true)
    setError(null)

    const { start, end } = getDateRange(rangeValue)

    const { data, error: err } = await supabase
      .from('orders')
      .select('id, num, type, status, total, items, created_at')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .neq('status', 'cancelado')
      .eq('deleted', false)
      .order('created_at', { ascending: true })

    if (err) {
      console.error('[ReportesPage] Error fetching orders:', err)
      setError('No se pudieron cargar los datos. Verifica tu conexión.')
    } else {
      setOrders(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchReportData(range)
  }, [range, fetchReportData])

  // Agregaciones computadas ─────────────────────────────────────────────────
  const kpis        = useMemo(() => computeKPIs(orders),             [orders])
  const dailyData   = useMemo(() => computeDailySales(orders, range), [orders, range])
  const typeData    = useMemo(() => computeByType(orders),            [orders])
  const topProducts = useMemo(() => computeTopProducts(orders),       [orders])

  const selectedLabel = RANGE_OPTIONS.find(o => o.value === range)?.label ?? ''

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard de Reportes</h1>
          <p className="text-sm text-gray-400 mt-0.5">{selectedLabel} · {orders.length} pedidos analizados</p>
        </div>

        {/* Selector de rango */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide hidden sm:block">Período</span>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                  ${range === opt.value
                    ? 'bg-white text-red-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchReportData(range)}
            className="ml-2 p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors text-base leading-none"
            title="Recargar datos"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Contenido ──────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-5 space-y-6">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm font-medium flex items-center gap-3">
            <span className="text-xl">⚠️</span> {error}
          </div>
        )}

        {/* ── KPIs ─────────────────────────────────────────────────────── */}
        <div>
          <SectionTitle>Resumen del período</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {loading ? (
              <>
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </>
            ) : (
              <>
                <KpiCard
                  icon="💰"
                  label="Total de Ventas"
                  value={fmt(kpis.totalSales)}
                  sub="pedidos no cancelados"
                  color="text-red-700"
                />
                <KpiCard
                  icon="📦"
                  label="Cantidad de Pedidos"
                  value={kpis.totalOrders.toLocaleString('es-CL')}
                  sub={`${selectedLabel}`}
                  color="text-blue-700"
                />
                <KpiCard
                  icon="🎯"
                  label="Ticket Promedio"
                  value={fmt(kpis.avgTicket)}
                  sub="por pedido"
                  color="text-amber-600"
                />
              </>
            )}
          </div>
        </div>

        {/* ── Gráfico de línea + Donut ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LineChart — Evolución diaria */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <SectionTitle>Evolución de ventas</SectionTitle>
            {loading ? (
              <div className="h-56 bg-gray-100 animate-pulse rounded-xl" />
            ) : dailyData.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                <span className="text-4xl">📉</span>
                Sin datos en este período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="sales"
                    orientation="left"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    yAxisId="orders"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomLineTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => v === 'sales' ? 'Ventas' : 'Pedidos'}
                    wrapperStyle={{ fontSize: 12, color: '#6b7280' }}
                  />
                  <Line
                    yAxisId="sales"
                    type="monotone"
                    dataKey="sales"
                    stroke="#C0392B"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#C0392B' }}
                  />
                  <Line
                    yAxisId="orders"
                    type="monotone"
                    dataKey="orders"
                    stroke="#2563eb"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                    activeDot={{ r: 4, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* PieChart Donut — Por tipo de pedido */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <SectionTitle>Pedidos por tipo</SectionTitle>
            {loading ? (
              <div className="h-56 bg-gray-100 animate-pulse rounded-xl" />
            ) : typeData.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                <span className="text-4xl">🍕</span>
                Sin datos
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={typeData.length > 0 ? typeData : []}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {typeData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                      <Label
                        content={<DonutCenterLabel total={kpis.totalOrders} />}
                        position="center"
                      />
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Leyenda manual */}
                <div className="mt-2 space-y-1.5">
                  {typeData.map((entry, idx) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        <span className="text-gray-600">{entry.name}</span>
                      </div>
                      <span className="font-semibold text-gray-800">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Top productos + Barras de ingresos ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top 5 productos por ingresos */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <SectionTitle>Top 5 productos por ingreso</SectionTitle>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 bg-gray-100 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : topProducts.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                <span className="text-3xl">🍽️</span>
                Sin datos
              </div>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, idx) => {
                  const maxRevenue = topProducts[0]?.revenue ?? 1
                  const pct = Math.round((p.revenue / maxRevenue) * 100)
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-gray-700 truncate">{p.name}</span>
                        </div>
                        <div className="flex gap-3 flex-shrink-0 ml-2">
                          <span className="text-gray-400">{p.qty}u</span>
                          <span className="font-semibold text-gray-800">{fmt(p.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* BarChart — Comparativa de tipos */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <SectionTitle>Distribución por canal</SectionTitle>
            {loading ? (
              <div className="h-44 bg-gray-100 animate-pulse rounded-xl" />
            ) : typeData.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                <span className="text-3xl">📊</span>
                Sin datos
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={typeData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  barSize={28}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f9fafb' }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-4 py-2.5 text-sm">
                          <p className="font-bold text-gray-700">{label}</p>
                          <p className="text-blue-600">{payload[0].value} pedidos</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {typeData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Footer spacing */}
        <div className="h-4" />
      </div>
    </div>
  )
}
