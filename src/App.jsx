import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { MenuProvider }     from './context/MenuContext'
import { OrdersProvider }   from './context/OrdersContext'
import { ClientProvider }   from './context/ClientContext'
import { SettingsProvider } from './context/SettingsContext'
import Sidebar from './components/Layout/Sidebar'
import MenuPage from './components/Menu/MenuPage'
import PedidosPDV from './pages/pdv/PedidosPDV'
import HistorialPage from './pages/ventas/HistorialPage'
import ReportesPage from './pages/ventas/ReportesPage'
import ClientsPage from './pages/clientes/ClientsPage'
import SettingsPage from './pages/settings/SettingsPage'
import Login from './pages/Login'
import './App.css'

const PAGES = {
  menu:      MenuPage,
  pdv:       PedidosPDV,
  historial: HistorialPage,
  reportes:  ReportesPage,
  clients:   ClientsPage,
  settings:  SettingsPage,
}

/* ── Panel autenticado — los providers solo montan aquí ── */
function AuthenticatedApp() {
  const [activePage, setActivePage] = useState(() => {
    const path = window.location.pathname.replace('/', '')
    return PAGES[path] ? path : 'menu'
  })

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace('/', '')
      if (PAGES[path]) setActivePage(path)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const PageComponent = PAGES[activePage] ?? MenuPage

  const handleNavigate = (page) => {
    setActivePage(page)
    window.history.pushState(null, '', `/${page}`)
    setIsMobileMenuOpen(false)
  }

  return (
    // El orden de anidación es: Settings (zonas de delivery) → Menu → Orders → Clients
    // SettingsProvider va al exterior porque DeliveryCalculator en OrderBuilderModal
    // consume las zonas al construir un pedido.
    <SettingsProvider>
      <MenuProvider>
        <OrdersProvider>
          <ClientProvider>
            <div className="app-layout">
              <Sidebar
                activePage={activePage}
                onNavigate={handleNavigate}
                isOpen={isMobileMenuOpen}
              />

              {isMobileMenuOpen && (
                <div
                  className="sidebar-overlay"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}

              <div className="app-content-wrapper">
                <header className="mobile-header">
                  <span className="mobile-header-title">Admin Pizzería</span>
                  <button
                    className="mobile-header-btn"
                    onClick={() => setIsMobileMenuOpen(true)}
                  >
                    ☰
                  </button>
                </header>

                <main className="app-main">
                  <PageComponent />
                </main>
              </div>
            </div>
          </ClientProvider>
        </OrdersProvider>
      </MenuProvider>
    </SettingsProvider>
  )
}

/* ── Raíz — solo decide Login vs. panel ── */
export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Cargando...</div>
  }

  if (!user) {
    return <Login />
  }

  return <AuthenticatedApp />
}

