import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useTheme } from '../contexts/ThemeContext'
import {
  LayoutDashboard, Package, ShoppingCart, CreditCard,
  Tag, Settings, LogOut, X, Menu, Store, History, Moon, Sun
} from 'lucide-react'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const { t, lang, setLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/auth')
  }

  const navItems = [
    { to: '/', icon: <LayoutDashboard />, label: t('dashboard'), end: true },
    { to: '/products', icon: <Package />, label: t('products') },
    { to: '/sales', icon: <ShoppingCart />, label: t('sales') },
    { to: '/sales-history', icon: <History />, label: t('sales_history') },
    { to: '/debts', icon: <CreditCard />, label: t('debts') },
    { to: '/deals', icon: <Tag />, label: t('deals') },
    { to: '/settings', icon: <Settings />, label: t('settings') },
  ]

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
          {profile && (
            <div className="shop-badge">
              <div className="name">{profile.shop_name}</div>
              <div className="role">{profile.full_name} · {profile.role}</div>
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
    </div>
  )
}
