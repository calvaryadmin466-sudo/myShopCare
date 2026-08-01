import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search, Filter, Download, Printer, MoreVertical } from 'lucide-react'

interface Column<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, row: T) => React.ReactNode
  width?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  onFilter?: (filters: Record<string, any>) => void
  onExport?: (format: 'csv' | 'excel' | 'pdf') => void
  sortable?: boolean
  filterable?: boolean
  exportable?: boolean
  pageSize?: number
  emptyMessage?: string
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  onSort,
  onFilter,
  onExport,
  sortable = true,
  filterable = true,
  exportable = true,
  pageSize = 25,
  emptyMessage = 'No data available'
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = [...data]

    // Apply search
    if (searchTerm) {
      result = result.filter(row =>
        columns.some(col => {
          const value = row[col.key]
          return String(value).toLowerCase().includes(searchTerm.toLowerCase())
        })
      )
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        result = result.filter(row => row[key] === value)
      }
    })

    // Apply sort
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey]
        const bVal = b[sortKey]
        if (aVal === bVal) return 0
        const comparison = aVal > bVal ? 1 : -1
        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [data, searchTerm, filters, sortKey, sortDirection, columns])

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize)
  const paginatedData = processedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleSort = (key: string) => {
    if (!sortable) return
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
    onSort?.(key, sortDirection === 'asc' ? 'desc' : 'asc')
  }

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    onExport?.(format)
  }

  if (loading) {
    return <DataTableSkeleton columns={columns} />
  }

  return (
    <div className="data-table">
      {/* Toolbar */}
      <div className="data-table-toolbar">
        {filterable && (
          <div className="search-bar">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
        {exportable && (
          <div className="export-buttons">
            <button onClick={() => handleExport('csv')} title="Export CSV">
              <Download size={18} />
            </button>
            <button onClick={() => handleExport('excel')} title="Export Excel">
              <Download size={18} />
            </button>
            <button onClick={() => handleExport('pdf')} title="Export PDF">
              <Printer size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  style={{ width: col.width }}
                  className={sortable && col.sortable ? 'sortable' : ''}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <div className="th-content">
                    {col.label}
                    {sortKey === String(col.key) && (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-state">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr key={idx}>
                  {columns.map(col => (
                    <td key={String(col.key)}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

function DataTableSkeleton<T>({ columns: { length } }: { columns: { length: number } }) {
  return (
    <div className="data-table">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {Array.from({ length }).map((_, i) => (
                <th key={i}>
                  <div className="skeleton" style={{ height: 16, width: '80%' }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length }).map((_, j) => (
                  <td key={j}>
                    <div className="skeleton" style={{ height: 16 }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
