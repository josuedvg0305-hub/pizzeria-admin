import './ChannelBar.css'

const CHANNELS = [
  { id: 'todos',     label: 'TODOS',       Icon: IconAll },
  { id: 'mostrador', label: 'Mostrador',   Icon: IconMonitor },
  { id: 'domicilio', label: 'A domicilio', Icon: IconClock  },
  { id: 'mesas',     label: 'Mesas',       Icon: IconTable  },
]

export default function ChannelBar({ active, counts, onSelect, onNewOrder }) {
  return (
    <div className="channel-bar">
      <div className="channel-tabs">
        {CHANNELS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`channel-tab ${active === id ? 'active' : ''}`}
            onClick={() => onSelect(id)}
          >
            <Icon />
            <span>{label}</span>
            <span className="channel-count">{counts[id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="channel-actions">
        <button className="cb-icon-btn" title="Buscar pedido">
          <IconSearch />
        </button>
        <button className="cb-icon-btn" title="Actualizar">
          <IconRefresh />
        </button>
        <button className="btn btn-blue" onClick={onNewOrder}>
          + Nuevo pedido
        </button>
        <button className="cb-icon-btn cb-icon-btn--more" title="Más opciones">
          <IconMore />
        </button>
      </div>
    </div>
  )
}

/* ── Icons ── */
function IconMonitor() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}
function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function IconTable() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="4" rx="1"/><line x1="5" y1="7" x2="5" y2="21"/><line x1="19" y1="7" x2="19" y2="21"/><line x1="3" y1="14" x2="21" y2="14"/>
    </svg>
  )
}
function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}
function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  )
}
function IconMore() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5"  r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
    </svg>
  )
}

function IconAll() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  )
}
