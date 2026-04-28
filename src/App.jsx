import { useState, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { MenuProvider }     from './context/MenuContext'
import { OrdersProvider }   from './context/OrdersContext'
import { ClientProvider }   from './context/ClientContext'
import { SettingsProvider } from './context/SettingsContext'
import Sidebar from './components/Layout/Sidebar'
import Login from './pages/Login'
import './App.css'

const MenuPage      = lazy(() => import('./components/Menu/MenuPage'))
const PedidosPDV    = lazy(() => import('./pages/pdv/PedidosPDV'))
const HistorialPage = lazy(() => import('./pages/ventas/HistorialPage'))
const ReportesPage  = lazy(() => import('./pages/ventas/ReportesPage'))
const ClientsPage   = lazy(() => import('./pages/clientes/ClientsPage'))
const SettingsPage  = lazy(() => import('./pages/settings/SettingsPage'))
const CocinaPage    = lazy(() => import('./pages/cocina/CocinaPage'))

/* ── Panel autenticado — los providers solo montan aquí ── */
function AuthenticatedApp() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    // El orden de anidación es: Settings (zonas de delivery) → Menu → Orders → Clients
    // SettingsProvider va al exterior porque DeliveryCalculator en OrderBuilderModal
    // consume las zonas al construir un pedido.
    <SettingsProvider>
      <MenuProvider>
        <OrdersProvider>
          <ClientProvider>
            <BrowserRouter>
              <div className="app-layout">
                <Sidebar
                  isOpen={isMobileMenuOpen}
                  onMobileClose={() => setIsMobileMenuOpen(false)}
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
                    <Suspense fallback={<div className="flex h-full items-center justify-center text-[var(--muted)]">Cargando módulo...</div>}>
                      <Routes>
                        <Route path="/" element={<Navigate to="/pdv" replace />} />
                        <Route path="/pdv" element={<PedidosPDV />} />
                        <Route path="/ventas/historial" element={<HistorialPage />} />
                        <Route path="/ventas/reportes" element={<ReportesPage />} />
                        <Route path="/clientes" element={<ClientsPage />} />
                        <Route path="/configuracion" element={<SettingsPage />} />
                        <Route path="/menu" element={<MenuPage />} />
                        <Route path="/cocina" element={<CocinaPage />} />
                        <Route path="*" element={<Navigate to="/pdv" replace />} />
                      </Routes>
                    </Suspense>
                  </main>
                </div>
              </div>
            </BrowserRouter>
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

