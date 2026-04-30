import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, Label,
} from 'recharts'

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmt  = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`
const fmtK = (v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`

/**
 * Convierte un Date al string YYYY-MM-DD usando la HORA LOCAL del navegador.
 * NUNCA usar .toISOString() para agrupar días: eso usa UTC y mueve
 * pedidos de las 21-23h (hora local UTC-4) al día siguiente.
 */
function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Suma N días calendario a un Date (respeta DST). */
function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const RANGE_OPTIONS = [
  { label: 'Hoy',             value: '0'      },
  { label: 'Ayer',            value: 'ayer'   },
  { label: 'Últimos 7 días',  value: '7'      },
  { label: 'Últimos 30 días', value: '30'     },
  { label: 'Este mes',        value: 'month'  },
  { label: 'Este año',        value: 'year'   },
  { label: 'Personalizado',   value: 'custom' },
]

const TYPE_LABELS = { flash:'Flash', local:'Local', llevar:'Para Llevar', delivery:'Delivery', mesa:'Mesa' }
const PIE_COLORS  = ['#C0392B','#2563eb','#f59e0b','#16a34a','#8b5cf6']
const DAY_NAMES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ─── Rangos ────────────────────────────────────────────────────────────────
function getRange(value, customStart, customEnd) {
  const now = new Date()
  if (value === 'custom') {
    // Forzar hora local explícita para evitar desfase TZ en Safari/Chrome
    const s = new Date(customStart + 'T00:00:00')
    const e = new Date(customEnd   + 'T23:59:59.999')
    return { start: s, end: e }
  }
  if (value === '0') {
    // HOY: desde medianoche local hasta ahora (nunca proyectar al futuro)
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    const end   = new Date(now) // momento exacto actual
    return { start, end }
  }
  if (value === 'ayer') {
    const start = new Date(now); start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0)
    const end   = new Date(now); end.setDate(now.getDate() - 1);   end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if (value === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    // Fin = ayer (no proyectar días futuros dentro del mes)
    const end   = new Date(now); end.setDate(now.getDate() - 1); end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if (value === 'year') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    // Fin = ayer (no proyectar meses/días futuros)
    const end   = new Date(now); end.setDate(now.getDate() - 1); end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  // Numérico ('7', '30'): D-N hasta D-1 (ayer) — nunca incluir hoy para evitar slots vacíos
  const days  = parseInt(value, 10)
  const start = new Date(now); start.setDate(now.getDate() - days); start.setHours(0, 0, 0, 0)
  const end   = new Date(now); end.setDate(now.getDate() - 1);      end.setHours(23, 59, 59, 999)
  return { start, end }
}

function getPrevRange(value, customStart, customEnd) {
  const { start: cs, end: ce } = getRange(value, customStart, customEnd)

  if (value === 'year') {
    const y = new Date().getFullYear() - 1
    return { start: new Date(y, 0, 1, 0, 0, 0, 0), end: new Date(y, 11, 31, 23, 59, 59, 999) }
  }

  // Contar días calendario exactos (sin usar ms para evitar drift de DST)
  const msPerDay = 86_400_000
  const spanDays = Math.round((ce - cs) / msPerDay) + 1 // días inclusivos

  // Período anterior: termina el día antes del inicio del período actual
  const pe = new Date(cs); pe.setDate(pe.getDate() - 1); pe.setHours(23, 59, 59, 999)
  const ps = addDays(pe, -(spanDays - 1)); ps.setHours(0, 0, 0, 0)
  return { start: ps, end: pe }
}

// ─── Agregaciones ──────────────────────────────────────────────────────────
const computeKPIs = (rows) => {
  const totalSales  = rows.reduce((s,o) => s + (o.total??0), 0)
  const totalOrders = rows.length
  return { totalSales, totalOrders, avgTicket: totalOrders > 0 ? totalSales/totalOrders : 0 }
}

const pct = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : null) : ((curr - prev)/prev)*100

function computeByType(curr, prev) {
  const build = (rows) => rows.reduce((acc, o) => {
    const k = o.type ?? 'local'
    if (!acc[k]) acc[k] = { type:k, name: TYPE_LABELS[k]??k, count:0, sales:0 }
    acc[k].count++; acc[k].sales += o.total??0; return acc
  }, {})
  const cm = build(curr), pm = build(prev)
  return Object.values(cm).sort((a,b) => b.sales - a.sales).map((r,i) => ({
    ...r, value: r.count,
    avg: r.count > 0 ? r.sales/r.count : 0,
    prevSales : pm[r.type]?.sales  ?? 0,
    prevCount : pm[r.type]?.count  ?? 0,
    deltaSales: pct(r.sales,  pm[r.type]?.sales  ?? 0),
    deltaCount: pct(r.count,  pm[r.type]?.count  ?? 0),
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))
}

/**
 * Agrupa pedidos por fecha LOCAL (no UTC).
 * Retorna: { 'YYYY-MM-DD': ventasAcumuladas }
 * USA localDateStr para que un pedido a las 23:00 hora local
 * no salte al día siguiente por el offset UTC.
 */
function buildDailyMap(orders) {
  return orders.reduce((acc, o) => {
    const key = localDateStr(new Date(o.created_at))
    acc[key] = (acc[key] ?? 0) + (o.total ?? 0)
    return acc
  }, {})
}

/**
 * Agrupa pedidos por mes (para 'year'): clave 'YYYY-MM'.
 */
function buildMonthlyMap(orders) {
  return orders.reduce((acc, o) => {
    const d   = new Date(o.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    acc[key] = (acc[key] ?? 0) + (o.total ?? 0)
    return acc
  }, {})
}

/**
 * Construye los slots del PERÍODO ACTUAL iterando día a día (hora a hora
 * para 'hoy') y empareja cada slot con su contraparte en el período
 * anterior mediante OFFSET DE DÍAS EXACTO (no índice posicional).
 *
 * Correcciones aplicadas:
 *  1. Zona horaria: se agrupa con localDateStr (hora local, no UTC).
 *  2. Sin proyección futura: getRange ya termina en ayer / ahora mismo.
 *  3. Cruce por fecha real: se calcula offset = currDay − currStart (días
 *     calendario) y se busca prevStart + offset en prevMap.
 *     Esto es matemáticamente exacto incluso si los meses tienen
 *     distintas longitudes (28 vs 31 días).
 */
function computeComparativeData(currOrders, prevOrders, value, cStart, cEnd) {
  if (!currOrders.length && !prevOrders.length) return []

  const { start: cs, end: ce } = getRange(value, cStart, cEnd)
  const { start: ps }          = getPrevRange(value, cStart, cEnd)

  // ── MODE: año → agrupar por mes ─────────────────────────────────────────
  if (value === 'year') {
    const currMap = buildMonthlyMap(currOrders)
    const prevMap = buildMonthlyMap(prevOrders)
    const result  = []
    // Iterar los meses del período actual (desde cs hasta ce)
    const cur = new Date(cs.getFullYear(), cs.getMonth(), 1)
    while (cur.getFullYear() < ce.getFullYear() ||
           (cur.getFullYear() === ce.getFullYear() && cur.getMonth() <= ce.getMonth())) {
      const ym      = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
      const ymPrev  = `${ps.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
      result.push({
        date:           MONTH_NAMES[cur.getMonth()],
        ventasActual:   currMap[ym]   ?? 0,
        ventasAnterior: prevMap[ymPrev] ?? 0,
      })
      cur.setMonth(cur.getMonth() + 1)
    }
    return result
  }

  // ── MODE: hoy → agrupar por hora ────────────────────────────────────────
  if (value === '0') {
    const currMap = {}
    currOrders.forEach(o => {
      const h = new Date(o.created_at).getHours()
      currMap[h] = (currMap[h] ?? 0) + (o.total ?? 0)
    })
    const prevMap = {}
    prevOrders.forEach(o => {
      const h = new Date(o.created_at).getHours()
      prevMap[h] = (prevMap[h] ?? 0) + (o.total ?? 0)
    })
    const nowHour = new Date().getHours()
    return Array.from({ length: nowHour + 1 }, (_, h) => ({
      date:           `${h}h`,
      ventasActual:   currMap[h]  ?? 0,
      ventasAnterior: prevMap[h]  ?? 0,
    }))
  }

  // ── MODE: diario (7, 30, ayer, mes, custom) ──────────────────────────────
  const currMap = buildDailyMap(currOrders)
  const prevMap = buildDailyMap(prevOrders)
  const result  = []

  const cur = new Date(cs); cur.setHours(0, 0, 0, 0)
  const psDay = new Date(ps); psDay.setHours(0, 0, 0, 0)

  while (cur <= ce) {
    const currKey  = localDateStr(cur)
    // Offset exacto en días calendario desde el inicio del período actual
    const offsetMs  = cur.getTime() - new Date(cs.getFullYear(), cs.getMonth(), cs.getDate()).getTime()
    const offsetDays = Math.round(offsetMs / 86_400_000)
    // Fecha equivalente en el período anterior
    const prevDay  = addDays(psDay, offsetDays)
    const prevKey  = localDateStr(prevDay)

    result.push({
      date:           `${DAY_NAMES[cur.getDay()]} ${cur.getDate()}`,
      ventasActual:   currMap[currKey] ?? 0,
      ventasAnterior: prevMap[prevKey] ?? 0,
    })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

// ─── Sub-components ────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
    <div className="h-3 w-28 bg-gray-200 rounded mb-4" />
    <div className="h-9 w-36 bg-gray-200 rounded mb-3" />
    <div className="h-5 w-24 bg-gray-100 rounded" />
  </div>
)

const SkeletonBlock = ({ h='h-64' }) => (
  <div className={`bg-gray-100 animate-pulse rounded-xl ${h}`} />
)

function Delta({ val, size='sm' }) {
  if (val === null || val === undefined)
    return <span className="text-xs text-gray-400 italic">Sin comparativa</span>
  const pos  = val > 0, zero = val === 0
  const cls  = zero ? 'text-gray-500 bg-gray-100'
    : pos ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
  const arrow = zero ? '→' : pos ? '↑' : '↓'
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-full ${size === 'xs' ? 'text-[11px]' : 'text-xs'} ${cls}`}>
      {arrow} {Math.abs(val).toFixed(1)}%
    </span>
  )
}

function KpiCard({ label, icon, value, delta }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="text-xl opacity-40">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
      <div className="flex items-center gap-2">
        <Delta val={delta} />
        {delta !== null && delta !== undefined && (
          <span className="text-xs text-gray-400">vs período anterior</span>
        )}
      </div>
    </div>
  )
}

function SectionCard({ title, children, className='' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
      {title && <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">{title}</h2>}
      {children}
    </div>
  )
}

const EmptyState = ({ emoji='📊', label='Sin datos para este período' }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-400">
    <span className="text-4xl">{emoji}</span>
    <span className="text-sm">{label}</span>
  </div>
)

function ComparativeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const actual   = payload.find(p => p.dataKey === 'ventasActual')
  const anterior = payload.find(p => p.dataKey === 'ventasAnterior')
  const diff     = (actual?.value ?? 0) - (anterior?.value ?? 0)
  const diffPct  = anterior?.value > 0
    ? (diff / anterior.value) * 100
    : actual?.value > 0 ? 100 : null
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl px-4 py-3.5 text-sm min-w-[180px]">
      <p className="font-semibold text-gray-600 mb-2 text-xs uppercase tracking-wide">{label}</p>
      {actual && (
        <div className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2 h-2 rounded-full bg-[#C0392B] inline-block" />
            Actual
          </span>
          <span className="font-bold text-gray-900">{fmt(actual.value)}</span>
        </div>
      )}
      {anterior && (
        <div className="flex items-center justify-between gap-4 mb-2">
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="w-2 h-2 rounded-full bg-[#94a3b8] inline-block" />
            Anterior
          </span>
          <span className="font-semibold text-gray-500">{fmt(anterior.value)}</span>
        </div>
      )}
      {diffPct !== null && (
        <div className={`text-xs font-semibold px-2 py-1 rounded-full text-center mt-1 ${
          diff > 0 ? 'bg-emerald-50 text-emerald-600' :
          diff < 0 ? 'bg-red-50 text-red-600' :
          'bg-gray-100 text-gray-500'
        }`}>
          {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'} {Math.abs(diffPct).toFixed(1)}% vs anterior
        </div>
      )}
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
      <text x={cx} y={cy-5} textAnchor="middle" fill="#111827"
        style={{ fontSize:24, fontWeight:700, fontFamily:'DM Sans,sans-serif' }}>{total}</text>
      <text x={cx} y={cy+16} textAnchor="middle" fill="#9ca3af"
        style={{ fontSize:11, fontFamily:'DM Sans,sans-serif' }}>pedidos</text>
    </g>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function ReportesPage() {
  const today = localDateStr(new Date())

  const [range,       setRange]       = useState('7')
  const [customStart, setCustomStart] = useState(today)
  const [customEnd,   setCustomEnd]   = useState(today)
  const [applied,     setApplied]     = useState({ s: today, e: today })
  const [orders,      setOrders]      = useState([])
  const [prevOrders,  setPrevOrders]  = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  const fetchData = useCallback(async (rv, cs, ce) => {
    setLoading(true); setError(null)
    const { start, end }         = getRange(rv, cs, ce)
    const { start: ps, end: pe } = getPrevRange(rv, cs, ce)

    const q = (s, e) =>
      supabase.from('orders')
        .select('id, num, type, status, total, items, created_at, payments')
        .neq('status', 'cancelado')
        .eq('deleted', false)
        .gte('created_at', s.toISOString())
        .lte('created_at', e.toISOString())
        .order('created_at', { ascending: true })

    const [curr, prev] = await Promise.all([q(start, end), q(ps, pe)])
    if (curr.error || prev.error) {
      setError('No se pudieron cargar los datos.')
    } else {
      setOrders(curr.data ?? [])
      setPrevOrders(prev.data ?? [])
    }
    setLoading(false)
  }, [])

  // Re-fetch cuando cambia range (excepto custom — espera botón Aplicar)
  useEffect(() => {
    if (range !== 'custom') fetchData(range, customStart, customEnd)
  }, [range, fetchData])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const kpis     = useMemo(() => computeKPIs(orders),     [orders])
  const prevKpis = useMemo(() => computeKPIs(prevOrders), [prevOrders])
  const typeData  = useMemo(() => computeByType(orders, prevOrders), [orders, prevOrders])
  const dailyData = useMemo(
    () => computeComparativeData(orders, prevOrders, range, applied.s, applied.e),
    [orders, prevOrders, range, applied]
  )

  const dOrders = useMemo(() => pct(kpis.totalOrders, prevKpis.totalOrders), [kpis, prevKpis])
  const dSales  = useMemo(() => pct(kpis.totalSales,  prevKpis.totalSales),  [kpis, prevKpis])
  const dTicket = useMemo(() => pct(kpis.avgTicket,   prevKpis.avgTicket),   [kpis, prevKpis])

  const periodLabel = RANGE_OPTIONS.find(o => o.value === range)?.label ?? ''

  const handleApply = () => {
    setApplied({ s: customStart, e: customEnd })
    fetchData('custom', customStart, customEnd)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 py-8 pr-8 pl-[280px]">
      <div className="w-full bg-white rounded-[2rem] shadow-xl border border-slate-200 p-8 flex flex-col gap-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {range === 'custom'
                ? `${applied.s} → ${applied.e}`
                : periodLabel}
              {!loading && ` · ${orders.length} pedidos`}
            </p>
          </div>

          {/* Controles de fecha */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Dropdown */}
            <div className="relative">
              <select
                value={range}
                onChange={e => setRange(e.target.value)}
                className="appearance-none bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl pl-4 pr-8 py-2.5 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 hover:border-gray-300 transition-colors"
              >
                {RANGE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
            </div>

            {/* Inputs personalizados */}
            {range === 'custom' && (
              <>
                <input
                  type="date" value={customStart} max={customEnd}
                  onChange={e => setCustomStart(e.target.value)}
                  className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 hover:border-gray-300 transition-colors"
                />
                <span className="text-gray-400 text-sm font-medium">→</span>
                <input
                  type="date" value={customEnd} min={customStart} max={today}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 hover:border-gray-300 transition-colors"
                />
                <button
                  onClick={handleApply}
                  className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
                >
                  Aplicar
                </button>
              </>
            )}

            {/* Recargar */}
            <button
              onClick={() => range === 'custom' ? handleApply() : fetchData(range, customStart, customEnd)}
              title="Actualizar"
              className={`p-2.5 rounded-xl border border-gray-200 bg-white shadow-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all text-sm font-bold leading-none ${loading ? 'opacity-40 pointer-events-none' : ''}`}
            >
              ↻
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm font-medium flex items-center gap-3">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* ── FILA 1 · KPIs ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {loading ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KpiCard icon="📦" label="Cantidad de Pedidos"
                value={kpis.totalOrders.toLocaleString('es-CL')} delta={dOrders} />
              <KpiCard icon="💰" label="Ventas Totales"
                value={fmt(kpis.totalSales)} delta={dSales} />
              <KpiCard icon="🎯" label="Ticket Promedio"
                value={fmt(kpis.avgTicket)} delta={dTicket} />
            </>
          )}
        </div>

        {/* ── FILA 2 · Donut + Tabla comparativa ─────────────────────────── */}
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
                      <Pie data={typeData} cx="50%" cy="50%"
                        innerRadius={58} outerRadius={84}
                        paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {typeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        <Label content={<DonutCenter total={kpis.totalOrders} />} position="center" />
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2.5">
                  {typeData.map(entry => {
                    const p = kpis.totalOrders > 0 ? Math.round((entry.count/kpis.totalOrders)*100) : 0
                    return (
                      <div key={entry.type} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                          <span className="text-gray-600 font-medium">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-gray-400">{p}%</span>
                          <span className="font-bold text-gray-800 w-6 text-right">{entry.count}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Tabla con comparativas */}
          <div className="lg:col-span-2">
            <SectionCard className="h-full">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_,i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}
                </div>
              ) : typeData.length === 0 ? <EmptyState emoji="📋" /> : (
                <table className="table-auto w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[
                        { label: 'Tipo',            align: 'left'  },
                        { label: 'Ventas ($)',       align: 'right' },
                        { label: 'Var. Ventas',      align: 'right' },
                        { label: 'Pedidos',          align: 'right' },
                        { label: 'Var. Pedidos',     align: 'right' },
                      ].map(({ label, align }) => (
                        <th key={label}
                          className={`text-xs font-semibold text-gray-400 pb-3 uppercase tracking-wider ${align === 'left' ? 'text-left pr-4' : 'text-right px-2'}`}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {typeData.map(row => (
                      <tr key={row.type} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.color }} />
                            <span className="font-medium text-gray-800">{row.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-2 text-right font-semibold text-gray-800">
                          {fmt(row.sales)}
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <Delta val={row.deltaSales} size="xs" />
                        </td>
                        <td className="py-3.5 px-2 text-right font-semibold text-gray-800">
                          {row.count}
                        </td>
                        <td className="py-3.5 pl-2 text-right">
                          <Delta val={row.deltaCount} size="xs" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-100">
                      <td className="pt-4 pr-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Total</td>
                      <td className="pt-4 px-2 text-right font-bold text-gray-900">{fmt(kpis.totalSales)}</td>
                      <td className="pt-4 px-2 text-right"><Delta val={dSales} size="xs" /></td>
                      <td className="pt-4 px-2 text-right font-bold text-gray-900">{kpis.totalOrders}</td>
                      <td className="pt-4 pl-2 text-right"><Delta val={dOrders} size="xs" /></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </SectionCard>
          </div>
        </div>

        {/* ── FILA 3 · Comparative AreaChart full-width ─────────────────── */}
        <SectionCard title="Evolución de ventas">
          {/* Leyenda manual encima del gráfico */}
          {!loading && dailyData.length > 0 && (
            <div className="flex items-center gap-5 mb-4">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <span className="w-3 h-0.5 bg-[#C0392B] inline-block rounded" />
                Período actual
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <span className="w-3 h-0.5 bg-[#94a3b8] inline-block rounded border-dashed" />
                Período anterior
              </span>
            </div>
          )}
          {loading ? <SkeletonBlock h="h-80" /> : dailyData.length === 0 ? (
            <EmptyState emoji="📉" label="Sin datos en este período" />
          ) : (
            <div className="h-80 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top:5, right:10, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#C0392B" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#C0392B" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="gradAnterior" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.10} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize:11, fill:'#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize:11, fill:'#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={fmtK}
                    width={52}
                  />
                  <Tooltip content={<ComparativeTooltip />} />
                  {/* Período anterior — debajo, suave, punteado */}
                  <Area
                    type="linear"
                    dataKey="ventasAnterior"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    fill="url(#gradAnterior)"
                    dot={false}
                    activeDot={{ r:4, fill:'#94a3b8', strokeWidth:0 }}
                  />
                  {/* Período actual — encima, prominente, rojo brand */}
                  <Area
                    type="linear"
                    dataKey="ventasActual"
                    stroke="#C0392B"
                    strokeWidth={2.5}
                    fill="url(#gradActual)"
                    dot={false}
                    activeDot={{ r:5, fill:'#C0392B', strokeWidth:0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <div className="h-2" />
      </div>
    </div>
  )
}
