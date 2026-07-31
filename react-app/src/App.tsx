import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LangProvider } from './contexts/LangContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { BusinessProvider } from './contexts/BusinessContext'
import { DynamicThemeProvider } from './contexts/DynamicThemeContext'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import POS from './pages/POS'
import SalesHistory from './pages/SalesHistory'
import Expenses from './pages/Expenses'
import Debts from './pages/Debts'
import Deals from './pages/Deals'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import BusinessManagement from './pages/BusinessManagement'

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', color: 'var(--accent)'
        }}><ShoppingCart size={30} /></div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--accent)', marginBottom: 8 }}>
          myShopCare
        </h2>
        <p style={{ color: 'var(--text3)', fontSize: '0.8rem', marginBottom: 20 }}>Loading your shop...</p>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, accessLoading, accessAllowed } = useAuth()
  if (loading || accessLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/auth" replace />
  if (!accessAllowed) return <div className="loading-screen"><div style={{ textAlign: 'center', maxWidth: 380 }}><h2 style={{ color: 'var(--accent)', marginBottom: 10 }}>Access paused</h2><p style={{ color: 'var(--text3)' }}>Your myShopCare access is not active. Please contact the administrator.</p></div></div>
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <LangProvider>
            <BusinessProvider>
              <DynamicThemeProvider>
                <Routes>
                  <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
                  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Dashboard />} />
                    <Route path="products" element={<Products />} />
                    <Route path="sales" element={<POS />} />
                    <Route path="sales-history" element={<SalesHistory />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="expenses" element={<Expenses />} />
                    <Route path="debts" element={<Debts />} />
                    <Route path="deals" element={<Deals />} />
                    <Route path="businesses" element={<BusinessManagement />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Routes>
              </DynamicThemeProvider>
            </BusinessProvider>
          </LangProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
