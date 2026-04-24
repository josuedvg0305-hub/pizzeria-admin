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
} from 'recharts'

// ─── Constantes ────────────────────────────────────────────────────────────

const fmt    = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`
const fmtK   = (v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`

const RANGE_OPTIONS = [
  { label: 'Hoy',             value: '0'     },
  { label: 'Últimos 7 días',  value: '7'     },
  { label: 'Últimos 30 días', value: '30'    },
  { label: 'Este mes',        value: 'month' },
  { label: 'Este año',        value: 'year'  },
]

const ORDER_TYPE_LABELS = {
  flash:    'Flash',
  local:    'Local',
  llevar:   'Para Llevar',
  delivery: 'Delivery',
  mesa:     'Mesa',
}

const PIE_COLORS = ['#C0392B', '#2563eb', '#f59e0b', '#16a34a', '#8b5cf6']

const DAY_NAMES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// ─── Rangos de fecha ───────────────────────────────────────────────────────

function getDateRange(rangeValue) {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  let start = new Date(now)

  if (rangeValue === '0')          { start.setHours(0, 0, 0, 0) }
  else if (rangeValue === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1) }
  else if (rangeValue === 'year')  { start = new Date(now.getFullYear(), 0, 1) }
  else {
    start.setDate(now.getDate() - parseInt(rangeValue, 10))
    start.setHours(0, 0, 0, 0)
  }
  return { start, end }
}

// ─── Agregaciones ──────────────────────────────────────────────────────────

function computeKPIs(orders) {
  const totalSales  = orders.reduce((s, o) => s + (o.total ?? 0), 0)
  const totalOrders = orders.length
  const avgTicket   = totalOrders > 0 ? totalSales / totalOrders : 0
  return { totalSales, totalOrders, avgTicket }
}

function computeDailySales(orders, rangeValue) {
  if (!orders.length) return []
  const map = {}
  orders.forEach(o => {
    const d   = new Date(o.created_at)
    const key = d.toISOString().split('T')[0]
    if (!map[key]) map[key] = { sales: 0, orders: 0, _date: d }
    map[key].sales  += o.total ?? 0
    map[key].orders += 1
  })
  const { start, end } = getDateRange(rangeValue)
  const filled = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  while (cursor <= end) {
    const key  = cursor.toISOString().split('T')[0]
    const data = map[key] ?? { sales: 0, orders: 0, _date: new Date(cursor) }
    const d    = data._date ?? cursor
    let label
    if (rangeValue === 'year')    label = MONTH_NAMES[d.getMonth()]
    else if (rangeValue === '0')  label = `${d.getHours()}h`
    else                          label = `${DAY_NAMES[d.getDay()]} ${d.getDate()}`
    filled.push({ date: label, sales: data.sales, orders: data.orders })
    rangeValue === 'year'
      ? cursor.setMonth(cursor.getMonth() + 1)
      : cursor.setDate(cursor.getDate() + 1)
  }
  return filled
}

/**
 * Calcula desglose por tipo con pedidos, ventas y ticket promedio.
 * Usado tanto en el PieChart (value) como en la tabla.
 */
function computeByType(orders) {
  const map = orders.reduce((acc, o) => {
    const key = o.type ?? 'local'
    if (!acc[key]) acc[key] = { type: key, name: ORDER_TYPE_LABELS[key] ?? key, count: 0, sales: 0 }
    acc[key].count += 1
    acc[key].sales += o.total ?? 0
    return acc
  }, {})
  return Object.values(map)
    .sort((a, b) => b.sales - a.sales)
    .map(r => ({ ...r, avg: r.count > 0 ? r.sales / r.count : 0, value: r.count }))
}

// ─── Componentes UI ────────────────────────────────────────────────────────

/** Skeleton pulsante para cards KPI */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3 animate-pulse">
      <div className="h-3 w-28 bg-gray-200 rounded" />
      <div className="h-9 w-36 bg-gray-200 rounded mt-1" />
      <div className="h-3 w-20 bg-gray-100 rounded" />
    </div>
  )
}

/** Skeleton pulsante genérico para gráficos */
function SkeletonBlock({ className = 'h-64' }) {
  return <div className={`bg-gray-100 animate-pulse rounded-lg ${className}`} />
}

/** Card de KPI — tipografía limpia en gris oscuro */
function KpiCard({ label, value, sub, icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="text-xl opacity-60">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 mt-2 leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-2">{sub}</p>}
    </div>
  )
}

/** Card contenedor de sección con título */
function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-6 ${className}`}>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">{title}</h2>
      {children}
    </div>
  )
}

/** Estado vacío reutilizable */
function EmptyState({ emoji = '📊', label = 'Sin datos para este rango de fechas' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
      <span className="text-4xl">{emoji}</span>
      <span className="text-sm">{label}</span>
    </div>
  )
}

/** Tooltip del LineChart */
function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.dataKey === 'sales' ? `Ventas: ${fmt(p.value)}` : `Pedidos: ${p.value}`}
        </p>
      ))}
    </div>
  )
}

/** Tooltip del PieChart */
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl px-4 py-3 text-sm">
      <p className="font-semibold" style={{ color: d.payload.fill }}>{d.name}</p>
      <p className="text-gray-600 mt-0.5">{d.value} pedidos</p>
    </div>
  )
}

/**
 * Label SVG en el centro del Donut.
 * Guard `if (!viewBox)` obligatorio — recharts pasa undefined en el primer ciclo.
 */
function DonutCenter({ viewBox, total }) {
  if (!viewBox) return null
  const { cx, cy } = viewBox
  return (
    <g>
      <text x={cx} y={cy - 5} textAnchor="middle" fill="#111827"
        style={{ fontSize: 24, fontWeight: 700, fontFamily: 'DM Sans, sans-serif' }}>
        {total}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#9ca3af"
        style={{ fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
        pedidos
      </text>
    </g>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────

export default function ReportesPage() {
  const [range,   setRange]   = useState('7')
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (rangeValue) => {
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
      console.error('[ReportesPage]', err)
      setError('No se pudieron cargar los datos. Verifica tu conexión.')
    } else {
      setOrders(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(range) }, [range, fetchData])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const kpis      = useMemo(() => computeKPIs(orders),              [orders])
  const dailyData = useMemo(() => computeDailySales(orders, range), [orders, range])
  const typeData  = useMemo(() => computeByType(orders),            [orders])

  const periodLabel = RANGE_OPTIONS.find(o => o.value === range)?.label ?? ''

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">

      {/* ── Topbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Reportes</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {periodLabel} · {loading ? '—' : `${orders.length} pedidos`}
          </p>
        </div>

        {/* Selector de rango */}
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                  range === opt.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchData(range)}
            title="Actualizar"
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors text-sm leading-none font-bold"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 p-8 flex flex-col gap-6">

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm font-medium flex items-center gap-3">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* ── FILA 1 · KPIs ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KpiCard
                icon="💰"
                label="Total de Ventas"
                value={fmt(kpis.totalSales)}
                sub={`${periodLabel} · pedidos no cancelados`}
              />
              <KpiCard
                icon="📦"
                label="Pedidos"
                value={kpis.totalOrders.toLocaleString('es-CL')}
                sub={periodLabel}
              />
              <KpiCard
                icon="🎯"
                label="Ticket Promedio"
                value={fmt(kpis.avgTicket)}
                sub="por pedido"
              />
            </>
          )}
        </div>

        {/* ── FILA 2 · Donut (1 col) + Tabla de desglose (2 cols) ──────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Donut: Pedidos por tipo ─────────────────────────────────── */}
          <SectionCard title="Análisis de pedidos">
            {loading ? (
              <SkeletonBlock className="h-64" />
            ) : typeData.length === 0 ? (
              <EmptyState emoji="🍕" />
            ) : (
              <div className="flex flex-col gap-4">
                {/* Donut */}
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeData.length > 0 ? typeData : []}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={84}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {typeData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                        <Label
                          content={<DonutCenter total={kpis.totalOrders} />}
                          position="center"
                        />
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Leyenda */}
                <div className="space-y-2">
                  {typeData.map((entry, i) => {
                    const pct = kpis.totalOrders > 0
                      ? Math.round((entry.count / kpis.totalOrders) * 100)
                      : 0
                    return (
                      <div key={entry.type} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="text-gray-600 font-medium">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{pct}%</span>
                          <span className="font-semibold text-gray-800 w-6 text-right">{entry.count}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </SectionCard>

          {/* ── Tabla de desglose por canal ────────────────────────────── */}
          <div className="lg:col-span-2">
            <SectionCard title="Desglose por tipo de servicio" className="h-full">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : typeData.length === 0 ? (
                <EmptyState emoji="📋" />
              ) : (
                <table className="table-auto w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4 uppercase tracking-wider">
                        Tipo de servicio
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-400 pb-3 px-4 uppercase tracking-wider">
                        Pedidos
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-400 pb-3 px-4 uppercase tracking-wider">
                        Ventas totales
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-400 pb-3 pl-4 uppercase tracking-wider">
                        Ticket promedio
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {typeData.map((row, i) => {
                      const pct = kpis.totalSales > 0
                        ? Math.round((row.sales / kpis.totalSales) * 100)
                        : 0
                      return (
                        <tr key={row.type} className="hover:bg-gray-50 transition-colors">
                          {/* Tipo */}
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                              />
                              <span className="font-medium text-gray-800">{row.name}</span>
                            </div>
                          </td>
                          {/* Pedidos */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-semibold text-gray-800">{row.count}</span>
                          </td>
                          {/* Ventas con barra de progreso */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="font-semibold text-gray-800">{fmt(row.sales)}</span>
                              <div className="w-24 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    background: PIE_COLORS[i % PIE_COLORS.length],
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          {/* Ticket promedio */}
                          <td className="py-3.5 pl-4 text-right">
                            <span className="text-gray-600">{fmt(row.avg)}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Totales */}
                  <tfoot>
                    <tr className="border-t-2 border-gray-100">
                      <td className="pt-4 pr-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Total
                      </td>
                      <td className="pt-4 px-4 text-right font-bold text-gray-900">
                        {kpis.totalOrders}
                      </td>
                      <td className="pt-4 px-4 text-right font-bold text-gray-900">
                        {fmt(kpis.totalSales)}
                      </td>
                      <td className="pt-4 pl-4 text-right font-bold text-gray-900">
                        {fmt(kpis.avgTicket)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </SectionCard>
          </div>
        </div>

        {/* ── FILA 3 · Line Chart full-width ───────────────────────────── */}
        <SectionCard title="Evolución de ventas">
          {loading ? (
            <SkeletonBlock className="h-80" />
          ) : dailyData.length === 0 ? (
            <EmptyState emoji="📉" label="Sin datos en este período" />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailyData}
                  margin={{ top: 5, right: 20, left: 5, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C0392B" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#C0392B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                    tickFormatter={fmtK}
                    width={52}
                  />
                  <YAxis
                    yAxisId="orders"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip content={<LineTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={v => v === 'sales' ? 'Ventas' : 'Pedidos'}
                    wrapperStyle={{ fontSize: 12, color: '#6b7280', paddingTop: 12 }}
                  />
                  <Line
                    yAxisId="sales"
                    type="monotone"
                    dataKey="sales"
                    stroke="#C0392B"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: '#C0392B', strokeWidth: 0 }}
                  />
                  <Line
                    yAxisId="orders"
                    type="monotone"
                    dataKey="orders"
                    stroke="#2563eb"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                    activeDot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        {/* Espaciado inferior */}
        <div className="h-2" />
      </div>
    </div>
  )
}
