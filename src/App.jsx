import { useState } from 'react'
import { useAuth } from './context/AuthContext'
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

export default function App() {
  const { user, loading } = useAuth()
  const [activePage, setActivePage] = useState('menu')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Cargando...</div>
  }

  if (!user) {
    return <Login />
  }

  const PageComponent = PAGES[activePage] ?? MenuPage

  const handleNavigate = (page) => {
    setActivePage(page)
    setIsMobileMenuOpen(false)
  }

  return (
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
  )
}
