import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, Label,
} from 'recharts'

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmt  = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`
const fmtK = (v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`

const RANGE_OPTIONS = [
  { label: 'Hoy',             value: '0'     },
  { label: 'Últimos 7 días',  value: '7'     },
  { label: 'Últimos 30 días', value: '30'    },
  { label: 'Este mes',        value: 'month' },
  { label: 'Este año',        value: 'year'  },
]

const ORDER_TYPE_LABELS = {
  flash: 'Flash', local: 'Local', llevar: 'Para Llevar', delivery: 'Delivery', mesa: 'Mesa',
}

const PIE_COLORS   = ['#C0392B', '#2563eb', '#f59e0b', '#16a34a', '#8b5cf6']
const DAY_NAMES    = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_NAMES  = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// ─── Rangos: período actual y período anterior ─────────────────────────────
function getDateRange(rangeValue) {
  const now = new Date()
  const end = new Date(now); end.setHours(23, 59, 59, 999)
  let start = new Date(now)

  if      (rangeValue === '0')     { start.setHours(0, 0, 0, 0) }
  else if (rangeValue === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1) }
  else if (rangeValue === 'year')  { start = new Date(now.getFullYear(), 0, 1) }
  else {
    start.setDate(now.getDate() - parseInt(rangeValue, 10))
    start.setHours(0, 0, 0, 0)
  }
  return { start, end }
}

function getPrevDateRange(rangeValue) {
  const { start, end } = getDateRange(rangeValue)
  const spanMs = end - start

  if (rangeValue === 'month') {
    const now = new Date()
    const prevEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1, 0, 0, 0, 0)
    return { start: prevStart, end: prevEnd }
  }
  if (rangeValue === 'year') {
    const now = new Date()
    const prevEnd   = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
    const prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0)
    return { start: prevStart, end: prevEnd }
  }
  // Para rangos en días: shift hacia atrás el mismo span
  return { start: new Date(start - spanMs), end: new Date(start - 1) }
}

// ─── Agregaciones ──────────────────────────────────────────────────────────
function computeKPIs(orders) {
  const totalSales  = orders.reduce((s, o) => s + (o.total ?? 0), 0)
  const totalOrders = orders.length
  const avgTicket   = totalOrders > 0 ? totalSales / totalOrders : 0
  return { totalSales, totalOrders, avgTicket }
}

/** Variación % entre valor actual y anterior. Retorna null si no hay base. */
function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function computeDailySales(orders, rangeValue) {
  if (!orders.length) return []
  const map = {}
  orders.forEach(o => {
    const d = new Date(o.created_at), key = d.toISOString().split('T')[0]
    if (!map[key]) map[key] = { sales: 0, orders: 0, _date: d }
    map[key].sales += o.total ?? 0; map[key].orders += 1
  })
  const { start, end } = getDateRange(rangeValue)
  const filled = []; const cursor = new Date(start); cursor.setHours(0, 0, 0, 0)
  while (cursor <= end) {
    const key  = cursor.toISOString().split('T')[0]
    const data = map[key] ?? { sales: 0, orders: 0, _date: new Date(cursor) }
    const d    = data._date ?? cursor
    let label
    if      (rangeValue === 'year') label = MONTH_NAMES[d.getMonth()]
    else if (rangeValue === '0')    label = `${d.getHours()}h`
    else                            label = `${DAY_NAMES[d.getDay()]} ${d.getDate()}`
    filled.push({ date: label, sales: data.sales, orders: data.orders })
    rangeValue === 'year' ? cursor.setMonth(cursor.getMonth() + 1) : cursor.setDate(cursor.getDate() + 1)
  }
  return filled
}

function computeByType(orders) {
  const map = orders.reduce((acc, o) => {
    const key = o.type ?? 'local'
    if (!acc[key]) acc[key] = { type: key, name: ORDER_TYPE_LABELS[key] ?? key, count: 0, sales: 0 }
    acc[key].count += 1; acc[key].sales += o.total ?? 0
    return acc
  }, {})
  return Object.values(map).sort((a, b) => b.sales - a.sales)
    .map(r => ({ ...r, avg: r.count > 0 ? r.sales / r.count : 0, value: r.count }))
}

// ─── Componentes UI ────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
      <div className="h-3 w-28 bg-gray-200 rounded mb-4" />
      <div className="h-9 w-36 bg-gray-200 rounded mb-3" />
      <div className="h-5 w-20 bg-gray-100 rounded" />
    </div>
  )
}

function SkeletonBlock({ h = 'h-64' }) {
  return <div className={`bg-gray-100 animate-pulse rounded-xl ${h}`} />
}

/** Badge de variación porcentual para KPIs */
function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined) {
    return <span className="text-xs text-gray-400">Sin datos anteriores</span>
  }
  const isPos  = delta > 0
  const isZero = delta === 0
  const color  = isZero ? 'text-gray-500 bg-gray-100'
    : isPos ? 'text-emerald-600 bg-emerald-50'
    : 'text-red-500 bg-red-50'
  const arrow  = isZero ? '→' : isPos ? '↑' : '↓'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {arrow} {Math.abs(delta).toFixed(1)}%
      <span className="font-normal opacity-70">vs período anterior</span>
    </span>
  )
}

/** Tarjeta KPI con badge de tendencia */
function KpiCard({ label, value, icon, delta }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="text-xl opacity-50">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
      <DeltaBadge delta={delta} />
    </div>
  )
}

/** Contenedor de sección */
function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">{title}</h2>
      {children}
    </div>
  )
}

function EmptyState({ emoji = '📊', label = 'Sin datos para este período' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-400">
      <span className="text-4xl">{emoji}</span>
      <span className="text-sm">{label}</span>
    </div>
  )
}

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

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl px-4 py-3 text-sm">
      <p className="font-semibold" style={{ color: d.payload.fill }}>{d.name}</p>
      <p className="text-gray-500 mt-0.5">{d.value} pedidos</p>
    </div>
  )
}

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
  const [range,      setRange]      = useState('7')
  const [orders,     setOrders]     = useState([])
  const [prevOrders, setPrevOrders] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  // ── Fetch dual: período actual + período anterior ─────────────────────────
  const fetchData = useCallback(async (rangeValue) => {
    setLoading(true); setError(null)

    const { start, end }         = getDateRange(rangeValue)
    const { start: ps, end: pe } = getPrevDateRange(rangeValue)

    const baseQuery = () =>
      supabase.from('orders')
        .select('id, num, type, status, total, items, created_at')
        .neq('status', 'cancelado')
        .eq('deleted', false)
        .order('created_at', { ascending: true })

    const [curr, prev] = await Promise.all([
      baseQuery().gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
      baseQuery().gte('created_at', ps.toISOString()).lte('created_at', pe.toISOString()),
    ])

    if (curr.error || prev.error) {
      console.error('[ReportesPage]', curr.error ?? prev.error)
      setError('No se pudieron cargar los datos. Verifica tu conexión.')
    } else {
      setOrders(curr.data ?? [])
      setPrevOrders(prev.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(range) }, [range, fetchData])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const kpis     = useMemo(() => computeKPIs(orders),     [orders])
  const prevKpis = useMemo(() => computeKPIs(prevOrders), [prevOrders])

  const deltaOrders = useMemo(() => pctChange(kpis.totalOrders, prevKpis.totalOrders), [kpis, prevKpis])
  const deltaSales  = useMemo(() => pctChange(kpis.totalSales,  prevKpis.totalSales),  [kpis, prevKpis])
  const deltaTicket = useMemo(() => pctChange(kpis.avgTicket,   prevKpis.avgTicket),   [kpis, prevKpis])

  const dailyData = useMemo(() => computeDailySales(orders, range), [orders, range])
  const typeData  = useMemo(() => computeByType(orders),            [orders])

  const periodLabel = RANGE_OPTIONS.find(o => o.value === range)?.label ?? ''

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50/50">

      {/* ── Topbar ───────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Reportes</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {periodLabel}
              {!loading && ` · ${orders.length} pedidos`}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Dropdown nativo estilizado */}
            <div className="relative">
              <select
                value={range}
                onChange={e => setRange(e.target.value)}
                className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl pl-4 pr-9 py-2.5 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-200 hover:border-gray-300 transition-colors"
              >
                {RANGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {/* Chevron decorativo */}
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
            </div>

            {/* Botón recargar */}
            <button
              onClick={() => fetchData(range)}
              title="Actualizar datos"
              className={`p-2.5 rounded-xl border border-gray-200 bg-white shadow-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all text-sm font-bold leading-none ${loading ? 'animate-spin opacity-50 pointer-events-none' : ''}`}
            >
              ↻
            </button>
          </div>
        </div>
      </div>

      {/* ── Contenido principal ───────────────────────────────────────────── */}
      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm font-medium flex items-center gap-3">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* ── FILA 1 · KPIs reordenados: Pedidos → Ventas → Ticket ──────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {loading ? (
              <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
            ) : (
              <>
                <KpiCard
                  icon="📦"
                  label="Cantidad de Pedidos"
                  value={kpis.totalOrders.toLocaleString('es-CL')}
                  delta={deltaOrders}
                />
                <KpiCard
                  icon="💰"
                  label="Ventas Totales"
                  value={fmt(kpis.totalSales)}
                  delta={deltaSales}
                />
                <KpiCard
                  icon="🎯"
                  label="Ticket Promedio"
                  value={fmt(kpis.avgTicket)}
                  delta={deltaTicket}
                />
              </>
            )}
          </div>

          {/* ── FILA 2 · Donut (1 col) + Tabla desglose (2 cols) ─────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Donut */}
            <SectionCard title="Análisis de pedidos">
              {loading ? <SkeletonBlock h="h-72" /> : typeData.length === 0 ? (
                <EmptyState emoji="🍕" />
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={typeData.length > 0 ? typeData : []}
                          cx="50%" cy="50%"
                          innerRadius={58} outerRadius={84}
                          paddingAngle={3} dataKey="value" strokeWidth={0}
                        >
                          {typeData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                          <Label content={<DonutCenter total={kpis.totalOrders} />} position="center" />
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2.5">
                    {typeData.map((entry, i) => {
                      const pct = kpis.totalOrders > 0
                        ? Math.round((entry.count / kpis.totalOrders) * 100) : 0
                      return (
                        <div key={entry.type} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-gray-600 font-medium">{entry.name}</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-gray-400">{pct}%</span>
                            <span className="font-bold text-gray-800 w-6 text-right">{entry.count}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Tabla desglose */}
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
                        {['Tipo de servicio', 'Pedidos', 'Ventas totales', 'Ticket promedio'].map((h, i) => (
                          <th key={h} className={`text-xs font-semibold text-gray-400 pb-3 uppercase tracking-wider ${i === 0 ? 'text-left pr-4' : 'text-right px-4'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {typeData.map((row, i) => {
                        const pct = kpis.totalSales > 0
                          ? Math.round((row.sales / kpis.totalSales) * 100) : 0
                        return (
                          <tr key={row.type} className="hover:bg-gray-50/70 transition-colors">
                            <td className="py-3.5 pr-4">
                              <div className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="font-medium text-gray-800">{row.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-semibold text-gray-800">
                              {row.count}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                <span className="font-semibold text-gray-800">{fmt(row.sales)}</span>
                                <div className="w-20 h-1 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full"
                                    style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 pl-4 text-right text-gray-500">{fmt(row.avg)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-100">
                        <td className="pt-4 pr-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Total</td>
                        <td className="pt-4 px-4 text-right font-bold text-gray-900">{kpis.totalOrders}</td>
                        <td className="pt-4 px-4 text-right font-bold text-gray-900">{fmt(kpis.totalSales)}</td>
                        <td className="pt-4 pl-4 text-right font-bold text-gray-900">{fmt(kpis.avgTicket)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </SectionCard>
            </div>
          </div>

          {/* ── FILA 3 · LineChart full-width ─────────────────────────────── */}
          <SectionCard title="Evolución de ventas">
            {loading ? <SkeletonBlock h="h-80" /> : dailyData.length === 0 ? (
              <EmptyState emoji="📉" label="Sin datos en este período" />
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData} margin={{ top: 5, right: 20, left: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="sales" orientation="left" tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={false} axisLine={false} tickFormatter={fmtK} width={52} />
                    <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={false} axisLine={false} width={36} />
                    <Tooltip content={<LineTooltip />} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={v => v === 'sales' ? 'Ventas' : 'Pedidos'}
                      wrapperStyle={{ fontSize: 12, color: '#6b7280', paddingTop: 12 }} />
                    <Line yAxisId="sales" type="monotone" dataKey="sales"
                      stroke="#C0392B" strokeWidth={2.5} dot={false}
                      activeDot={{ r: 5, fill: '#C0392B', strokeWidth: 0 }} />
                    <Line yAxisId="orders" type="monotone" dataKey="orders"
                      stroke="#2563eb" strokeWidth={2} strokeDasharray="5 3" dot={false}
                      activeDot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <div className="h-2" />
        </div>
      </div>
    </div>
  )
}
