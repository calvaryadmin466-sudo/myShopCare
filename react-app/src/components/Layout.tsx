import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useTheme } from '../contexts/ThemeContext'
import { useBusiness } from '../contexts/BusinessContext'
import { offlineSync } from '../lib/offlineSync'
import {
  LayoutDashboard, Package, ShoppingCart, CreditCard,
  Tag, Settings, LogOut, X, Menu, Store, History, Moon, Sun, BarChart3, Receipt,
  Building2, ChevronDown, Wifi, WifiOff, Building, Home, Plus, MoreHorizontal
} from 'lucide-react'
import { ExpiryNotificationBell } from './ExpiryNotificationBell'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const { t, lang, setLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const { businesses, currentBusiness, setCurrentBusiness } = useBusiness()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [businessDropdownOpen, setBusinessDropdownOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const businessDropdownRef = useRef<HTMLDivElement>(null)

  async function handleLogout() {
    await signOut()
    navigate('/auth')
  }

  const navItems = [
    { to: '/', icon: <LayoutDashboard />, label: t('dashboard'), end: true },
    { to: '/products', icon: <Package />, label: t('products') },
    { to: '/sales', icon: <ShoppingCart />, label: t('sales') },
    { to: '/sales-history', icon: <History />, label: t('sales_history') },
    { to: '/reports', icon: <BarChart3 />, label: t('reports') },
    { to: '/expenses', icon: <Receipt />, label: t('expenses') },
    { to: '/debts', icon: <CreditCard />, label: t('debts') },
    { to: '/deals', icon: <Tag />, label: t('deals') },
    { to: '/businesses', icon: <Building2 />, label: t('businesses') },
    { to: '/settings', icon: <Settings />, label: t('settings') },
  ]

  // Click-outside closes the business selector dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (businessDropdownRef.current && !businessDropdownRef.current.contains(e.target as Node)) {
        setBusinessDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Monitor online status, and keep retrying any offline-queued operations
  // (e.g. sales made while offline) as a fallback alongside the 'online'
  // event listener already inside offlineSync itself.
  useEffect(() => {
    setIsOnline(offlineSync.getOnlineStatus())
    offlineSync.startPeriodicSync()

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      offlineSync.stopPeriodicSync()
    }
  }, [])

  return (
    <div className="app-layout">
      {/* Overlay on mobile */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>myShopCare</h1>
          <p>{lang === 'sw' ? 'Duka lako, kwa urahisi' : 'Your shop, simplified'}</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {/* Business Selector */}
          {businesses.length > 0 && (
            <div className="business-selector" ref={businessDropdownRef}>
              <button
                className="business-selector-btn"
                onClick={() => setBusinessDropdownOpen(!businessDropdownOpen)}
              >
                <div className="business-info">
                  {currentBusiness?.logo_url ? (
                    <img src={currentBusiness.logo_url} alt="" className="business-logo" />
                  ) : (
                    <Building size={20} className="business-icon" />
                  )}
                  <span className="business-name">{currentBusiness?.name || 'Select Business'}</span>
                </div>
                <ChevronDown size={16} />
              </button>
              
              {businessDropdownOpen && (
                <div className="business-dropdown">
                  {businesses.map((business) => (
                    <button
                      key={business.id}
                      className={`business-option ${currentBusiness?.id === business.id ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentBusiness(business)
                        setBusinessDropdownOpen(false)
                      }}
                    >
                      {business.logo_url ? (
                        <img src={business.logo_url} alt="" className="business-logo-small" />
                      ) : (
                        <Building size={16} />
                      )}
                      <span>{business.name}</span>
                      {currentBusiness?.id === business.id && (
                        <div className="business-active-indicator" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {profile && (
            <div className="shop-badge">
              <div className="name">{profile.full_name}</div>
              <div className="role">{profile.role}</div>
            </div>
          )}
          <button className="nav-item btn-ghost" style={{ width: '100%', border: 'none', cursor: 'pointer' }} onClick={handleLogout}>
            <LogOut size={16} />
            {t('logout')}
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Store size={18} color="var(--accent)" />
            <h2>{profile?.shop_name || 'myShopCare'}</h2>
          </div>
          <div className="topbar-right">
              {/* Connection Status Indicator */}
              <div className={`connection-status ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online' : 'Offline'}>
                {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                <span className="connection-text">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              <ExpiryNotificationBell />
              <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
                <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
              </button>
              <div className="lang-toggle">
                <button className={`lang-btn ${lang === 'sw' ? 'active' : ''}`} onClick={() => setLang('sw')}>SW</button>
                <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
              </div>
            </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </div>

      <nav className="bottom-nav no-print">
        <NavLink to="/" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Home />
          <span>{t('dashboard')}</span>
        </NavLink>
        <NavLink to="/products" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Package />
          <span>{t('products')}</span>
        </NavLink>
        <NavLink to="/sales" className="bottom-nav-fab" aria-label={t('sales')}>
          <Plus size={22} />
        </NavLink>
        <NavLink to="/sales-history" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <History />
          <span>{t('sales_history')}</span>
        </NavLink>
        <button className="bottom-nav-item" onClick={() => setSidebarOpen(true)}>
          <MoreHorizontal />
          <span>{t('more')}</span>
        </button>
      </nav>
    </div>
  )
}
