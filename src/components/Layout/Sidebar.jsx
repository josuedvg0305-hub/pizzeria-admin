import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMenu } from '../../context/MenuContext'
import './Sidebar.css'

const NAV_SECTIONS = [
  {
    label: 'OPERACIONES',
    items: [
      { id: 'pdv',     path: '/pdv',             Icon: IconPDV,     label: 'Pedidos PDV' },
      {
        id: 'ventas',
        path: '/ventas',
        Icon: IconVentas,
        label: 'Ventas',
        collapsible: true,
        children: [
          { id: 'historial', path: '/ventas/historial', label: 'Historial de pedidos' },
          { id: 'reportes',  path: '/ventas/reportes',  label: 'Reportes' },
        ],
      },
      { id: 'menu',    path: '/menu',            Icon: IconMenu,    label: 'Menú'    },
      { id: 'kitchen', path: '/cocina',          Icon: IconKitchen, label: 'Cocina'  },
    ],
  },
  {
    label: 'GESTIÓN',
    items: [
      { id: 'clients',  path: '/clientes',       Icon: IconClients,  label: 'Clientes'       },
      { id: 'settings', path: '/configuracion',  Icon: IconSettings, label: 'Configuraciones' },
    ],
  },
]

const FOOTER_ITEMS = [
  { id: 'preview', path: '/preview', Icon: IconEye, label: 'Vista previa' },
  { id: 'qr',      path: '/qr',      Icon: IconQR,  label: 'QR y enlaces' },
]

export default function Sidebar({ isOpen, onMobileClose }) {
  const { logo, setLogo } = useMenu()
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const isVentasActive = location.pathname.startsWith('/ventas')
  const [ventasOpen, setVentasOpen] = useState(() => isVentasActive)

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogo(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleNavigate = (path) => {
    navigate(path)
    if (onMobileClose) onMobileClose()
  }

  return (
    <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
      <div className="sidebar-header">
        <div
          className="sidebar-logo-wrap"
          onClick={() => inputRef.current?.click()}
          title="Cambiar logo"
        >
          {logo
            ? <img src={logo} alt="Logo" className="sidebar-logo-img" />
            : <span className="sidebar-logo-emoji">🍕</span>
          }
          <span className="sidebar-logo-overlay">📷</span>
        </div>
        <div className="sidebar-brand">
          <span className="sidebar-brand-name">La Pizzería de Buin</span>
          <span className="sidebar-brand-sub">Panel Admin</span>
        </div>
        <input
          ref={inputRef} type="file" accept="image/*"
          style={{ display: 'none' }} onChange={handleLogoChange}
        />
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="sidebar-section">
            <span className="sidebar-section-label">{section.label}</span>
            {section.items.map(({ id, Icon, label, collapsible, children, path }) => {
              if (collapsible) {
                return (
                  <div key={id} className="sidebar-collapsible">
                    {/* Parent button */}
                    <button
                      className={`sidebar-item sidebar-item--collapsible${isVentasActive ? ' active' : ''}`}
                      onClick={() => {
                        setVentasOpen(v => !v)
                        /* Navigate to first child if none already selected */
                        if (!isVentasActive && children?.length > 0) {
                          handleNavigate(children[0].path)
                        }
                      }}
                    >
                      <Icon className="sidebar-item-icon" />
                      <span className="sidebar-item-text">{label}</span>
                      <span className={`sidebar-chevron${ventasOpen ? ' sidebar-chevron--open' : ''}`}>
                        <IconChevron />
                      </span>
                    </button>

                    {/* Sub-items */}
                    {ventasOpen && (
                      <div className="sidebar-children">
                        {children.map(child => (
                          <button
                            key={child.id}
                            className={`sidebar-child-item${location.pathname === child.path ? ' active' : ''}`}
                            onClick={() => handleNavigate(child.path)}
                          >
                            <span className="sidebar-child-dot" />
                            {child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <button
                  key={id}
                  className={`sidebar-item ${location.pathname === path ? 'active' : ''}`}
                  onClick={() => handleNavigate(path)}
                >
                  <Icon className="sidebar-item-icon" />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {FOOTER_ITEMS.map(({ id, Icon, label, path }) => (
          <button
            key={id}
            className={`sidebar-item sidebar-item--sm ${location.pathname === path ? 'active' : ''}`}
            onClick={() => handleNavigate(path)}
          >
            <Icon className="sidebar-item-icon" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user-dot">A</div>
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">Admin</span>
          <span className="sidebar-user-role">Administrador</span>
        </div>
      </div>
    </aside>
  )
}

/* ── Inline SVG icons ─────────────────────────────────────────────────── */
function IconPDV({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}
function IconVentas({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>
  )
}
function IconMenu({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
    </svg>
  )
}
function IconKitchen({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13.87A4 4 0 017.41 6a5.11 5.11 0 011.05-1.54 5 5 0 017.08 0A5.11 5.11 0 0116.59 6 4 4 0 0118 13.87V21H6z"/><line x1="6" y1="17" x2="18" y2="17"/>
    </svg>
  )
}
function IconClients({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function IconSettings({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}
function IconEye({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
function IconQR({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      <rect x="14" y="14" width="3" height="3"/><line x1="20" y1="14" x2="20" y2="14"/><line x1="20" y1="20" x2="20" y2="20"/>
    </svg>
  )
}
function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}
