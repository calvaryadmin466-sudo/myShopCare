import { useEffect, useRef, useState } from 'react'
import { Bell, X, AlertTriangle, Clock, Package } from 'lucide-react'
import { useNotifications, type AppNotification } from '../hooks/useNotifications'
import { useLang } from '../contexts/LangContext'
import { Link } from 'react-router-dom'

function formatExpiry(daysLeft: number, t: (k: string) => string): { text: string; color: string } {
  if (daysLeft < 0)
    return { text: t('expired_days_ago').replace('{n}', String(Math.abs(daysLeft))), color: 'var(--red)' }
  if (daysLeft === 0)
    return { text: t('expires_today'), color: 'var(--red)' }
  if (daysLeft <= 7)
    return { text: t('expires_in_days').replace('{n}', String(daysLeft)), color: '#f97316' }
  return { text: t('expires_in_days').replace('{n}', String(daysLeft)), color: 'var(--yellow)' }
}

function formatNotificationDetails(n: AppNotification, t: (k: string) => string): { text: string; color: string; title: string; icon: any } {
  if (n.type === 'expiry') {
    const days = n.daysLeft ?? 0
    const details = formatExpiry(days, t)
    return {
      text: `${details.text} (${t('expiry_date')}: ${new Date(n.expiryDate + 'T00:00:00').toLocaleDateString('sw-TZ')})`,
      color: details.color,
      title: days < 0 ? t('expired') : t('expiry_alert_title'),
      icon: Clock
    }
  } else {
    const qty = n.stockQuantity ?? 0
    const unit = n.unit || 'pcs'
    const isOut = qty === 0
    const text = isOut
      ? t('out_of_stock')
      : t('items_left').replace('{n}', String(qty)).replace('{unit}', unit)
    return {
      text: `${text} (${t('low_stock_alert')}: ${n.lowStockThreshold ?? 0} ${unit})`,
      color: isOut ? 'var(--red)' : '#f97316',
      title: isOut ? t('out_of_stock_alert_title') : t('low_stock_alert_title'),
      icon: Package
    }
  }
}

export function ExpiryNotificationBell() {
  const { notifications } = useNotifications()
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [toastQueue, setToastQueue] = useState<AppNotification[]>([])
  const [currentToast, setCurrentToast] = useState<AppNotification | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const prevAlertIds = useRef<Set<string>>(new Set())

  // ── Pop-up toast system ──────────────────────────────────────
  useEffect(() => {
    if (notifications.length === 0) return
    // Find newly arrived alerts (not seen before and not dismissed)
    const newAlerts = notifications.filter(a => !prevAlertIds.current.has(a.id) && !dismissed.has(a.id))
    if (newAlerts.length > 0) {
      setToastQueue(q => [...q, ...newAlerts])
    }
    prevAlertIds.current = new Set(notifications.map(a => a.id))
  }, [notifications.map(a => a.id).join(',')])

  // Show next toast from queue
  useEffect(() => {
    if (currentToast || toastQueue.length === 0) return
    const [next, ...rest] = toastQueue
    setCurrentToast(next)
    setToastQueue(rest)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setCurrentToast(null)
    }, 5000)
  }, [toastQueue, currentToast])

  // Click-outside closes dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const visibleAlerts = notifications.filter(a => !dismissed.has(a.id))
  const unread = visibleAlerts.length

  const expiredOrOutCount = visibleAlerts.filter(a => (a.type === 'expiry' && (a.daysLeft ?? 0) < 0) || (a.type === 'low_stock' && a.stockQuantity === 0)).length
  const warningCount = unread - expiredOrOutCount

  if (notifications.length === 0 && !currentToast) return null

  return (
    <>
      {/* ── Bell button ─────────────────────────────────────── */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          id="expiry-notification-bell"
          onClick={() => setOpen(o => !o)}
          style={{
            position: 'relative',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 8px',
            borderRadius: 'var(--radius)',
            color: unread > 0 ? 'var(--red)' : 'var(--text3)',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.15s, background 0.15s',
          }}
          title={t('notification_alerts')}
        >
          <Bell id="bell-icon" size={18} style={{ animation: unread > 0 ? 'bell-shake 1.2s ease-in-out infinite' : 'none' }} />
          {unread > 0 && (
            <span style={{
              position: 'absolute',
              top: 2, right: 2,
              width: 16, height: 16,
              background: 'var(--red)',
              color: 'white',
              borderRadius: '50%',
              fontSize: '0.6rem',
              fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* ── Dropdown ──────────────────────────────────────── */}
        {open && (
          <div id="expiry-dropdown" style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 350,
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'slide-in-down 0.18s ease',
          }}>
            {/* header */}
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} color="var(--red)" />
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t('notification_alerts')}</span>
                {expiredOrOutCount > 0 && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, background: 'var(--red-light)', color: 'var(--red)', padding: '2px 6px', borderRadius: 99 }}>
                    {expiredOrOutCount} Urgent
                  </span>
                )}
                {warningCount > 0 && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, background: 'rgba(249,115,22,0.12)', color: '#f97316', padding: '2px 6px', borderRadius: 99 }}>
                    {warningCount} Warning
                  </span>
                )}
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X size={14} />
              </button>
            </div>

            {/* list */}
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {visibleAlerts.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem' }}>
                  {t('all_cleared')}
                </div>
              ) : visibleAlerts.map(a => {
                const details = formatNotificationDetails(a, t)
                const IconComponent = details.icon
                return (
                  <div key={a.id} style={{
                    padding: '11px 16px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    transition: 'background 0.1s',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: details.color === 'var(--red)' ? 'var(--red-light)' : 'rgba(249,115,22,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <IconComponent size={15} color={details.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div style={{ fontSize: '0.75rem', color: details.color, fontWeight: 600, marginTop: 2 }}>{details.text}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 1 }}>
                        {a.category}
                      </div>
                    </div>
                    <button
                      onClick={() => setDismissed(d => new Set([...d, a.id]))}
                      title={t('dismiss')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '2px', flexShrink: 0 }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* footer */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link
                to="/products"
                onClick={() => setOpen(false)}
                style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
              >
                {t('view_all_products')} →
              </Link>
              {visibleAlerts.length > 0 && (
                <button
                  onClick={() => setDismissed(new Set(visibleAlerts.map(a => a.id)))}
                  style={{ fontSize: '0.72rem', color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {t('dismiss_all')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Pop-up toast ────────────────────────────────────── */}
      {currentToast && (() => {
        const details = formatNotificationDetails(currentToast, t)
        const isUrgent = details.color === 'var(--red)'
        const IconComponent = details.icon
        return (
          <div
            id="expiry-toast"
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 330,
              background: 'var(--bg2)',
              border: `2px solid ${details.color}`,
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
              zIndex: 99999,
              padding: '14px 16px',
              display: 'flex', gap: 12, alignItems: 'flex-start',
              animation: 'slide-in-up 0.22s cubic-bezier(.22,.68,0,1.2)',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: isUrgent ? 'var(--red-light)' : 'rgba(249,115,22,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconComponent size={17} color={details.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.83rem', color: 'var(--text)', marginBottom: 3 }}>
                {isUrgent ? '⚠️ ' : '🕐 '}{details.title}
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentToast.name}
              </div>
              <div style={{
                fontSize: '0.75rem', fontWeight: 600, marginTop: 3,
                color: details.color,
              }}>
                {details.text}
              </div>
            </div>
            <button
              onClick={() => {
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
                setCurrentToast(null)
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        )
      })()}
    </>
  )
}
