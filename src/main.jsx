import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider }     from './context/AuthContext'
import { MenuProvider }     from './context/MenuContext'
import { OrdersProvider }   from './context/OrdersContext'
import { ClientProvider }   from './context/ClientContext'
import { SettingsProvider } from './context/SettingsContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <MenuProvider>
        <OrdersProvider>
          <ClientProvider>
            <SettingsProvider>
              <App />
            </SettingsProvider>
          </ClientProvider>
        </OrdersProvider>
      </MenuProvider>
    </AuthProvider>
  </StrictMode>,
)
