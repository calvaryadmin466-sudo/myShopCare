import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import type { AuditLog } from '../types'
import { Search, Download, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { exportData } from '../lib/export'

interface AuditLogViewerProps {
  tableFilter?: string
  limit?: number
}

export function AuditLogViewer({ tableFilter, limit = 50 }: AuditLogViewerProps) {
  const { profile } = useAuth()
  const { t } = useLang()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [tableFilterState, setTableFilterState] = useState<string>(tableFilter || 'all')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  useEffect(() => {
    if (profile) loadLogs()
  }, [profile, tableFilter])

  async function loadLogs() {
    if (!profile) return
    setLoading(true)

    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('business_id', profile.business_id || profile.shop_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (tableFilter) {
      query = query.eq('table_name', tableFilter)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error loading audit logs:', error)
    } else {
      setLogs(data || [])
    }
    setLoading(false)
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      search === '' || 
      log.table_name.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      (log.record_id && log.record_id.includes(search))
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter
    const matchesTable = tableFilterState === 'all' || log.table_name === tableFilterState

    return matchesSearch && matchesAction && matchesTable
  })

  const actions = ['all', 'insert', 'update', 'delete', 'view']
  const tables = ['all', ...Array.from(new Set(logs.map(l => l.table_name)))]

  function handleExport(format: 'csv' | 'excel' | 'pdf') {
    const columns = [
      { key: 'created_at', label: 'Date' },
      { key: 'table_name', label: 'Table' },
      { key: 'action', label: 'Action' },
      { key: 'record_id', label: 'Record ID' },
      { key: 'user_id', label: 'User ID' },
    ]

    exportData({
      filename: `audit_logs_${new Date().toISOString().split('T')[0]}`,
      format,
      data: filteredLogs,
      columns
    })
  }

  function getActionColor(action: string) {
    switch (action) {
      case 'insert': return 'var(--green)'
      case 'update': return 'var(--yellow)'
      case 'delete': return 'var(--red)'
      case 'view': return 'var(--blue)'
      default: return 'var(--text2)'
    }
  }

  function formatJson(json: any) {
    return JSON.stringify(json, null, 2)
  }

  return (
    <div className="audit-log-viewer">
      <div className="card">
        <div className="card-title">Audit Logs</div>
        
        {/* Filters */}
        <div className="filters" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <Search size={18} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search logs..."
            />
          </div>
          
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
          >
            {actions.map(action => (
              <option key={action} value={action}>
                {action === 'all' ? 'All Actions' : action.charAt(0).toUpperCase() + action.slice(1)}
              </option>
            ))}
          </select>

          {!tableFilter && (
            <select
              value={tableFilterState}
              onChange={e => setTableFilterState(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}
            >
              {tables.map(table => (
                <option key={table} value={table}>
                  {table === 'all' ? 'All Tables' : table}
                </option>
              ))}
            </select>
          )}

          <button className="btn btn-ghost" onClick={() => handleExport('csv')}>
            <Download size={16} /> Export
          </button>
        </div>

        {/* Logs List */}
        {loading ? (
          <div className="loading-card">
            <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 16, width: '40%' }} />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <p>No audit logs found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredLogs.map(log => (
              <div
                key={log.id}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background: getActionColor(log.action) + '20',
                        color: getActionColor(log.action)
                      }}
                    >
                      {log.action}
                    </span>
                    <span style={{ fontWeight: 600 }}>{log.table_name}</span>
                    {log.record_id && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
                        ID: {log.record_id.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                    {expandedLog === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {expandedLog === log.id && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    {log.old_values && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, color: 'var(--red)' }}>
                          Old Values:
                        </div>
                        <pre style={{ 
                          background: 'var(--bg2)', 
                          padding: 8, 
                          borderRadius: 4, 
                          fontSize: '0.75rem',
                          overflow: 'auto',
                          maxHeight: 200
                        }}>
                          {formatJson(log.old_values)}
                        </pre>
                      </div>
                    )}
                    {log.new_values && (
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, color: 'var(--green)' }}>
                          New Values:
                        </div>
                        <pre style={{ 
                          background: 'var(--bg2)', 
                          padding: 8, 
                          borderRadius: 4, 
                          fontSize: '0.75rem',
                          overflow: 'auto',
                          maxHeight: 200
                        }}>
                          {formatJson(log.new_values)}
                        </pre>
                      </div>
                    )}
                    {log.ip_address && (
                      <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text3)' }}>
                        IP: {log.ip_address}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
