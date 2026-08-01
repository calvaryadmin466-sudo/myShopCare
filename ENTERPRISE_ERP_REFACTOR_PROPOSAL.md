# Enterprise ERP Refactor Proposal for myShopCare

## Executive Summary

This document outlines a comprehensive refactor plan to evolve myShopCare into a professional, scalable ERP while preserving all existing functionality. The focus is on eliminating code duplication, improving performance through SQL-based calculations, ensuring consistent UI/UX, and adding enterprise-grade features like audit logging and proper data governance.

---

## Current State Analysis

### Database Schema

**Existing Tables:**
- `businesses` - Multi-business support with owner_id, theme_color, currency
- `business_users` - Role-based access (owner, manager, cashier)
- `profiles` - User profiles with business_id reference
- `products` - Products with business_id, expiry tracking, low stock thresholds
- `workers` - Employees with business_id
- `sales` - Sales transactions with business_id
- `sale_items` - Line items with unit_cost, total_cost for P&L
- `debts` - Customer debts with business_id
- `debt_payments` - Debt payment tracking
- `expenses` - Business expenses with business_id
- `deals` - Promotions/discounts with business_id
- `offline_sync_queue` - Offline synchronization tracking

**Strengths:**
- Multi-business architecture with proper RLS
- Business isolation through business_id
- Role-based access control
- Offline sync support
- P&L support (unit_cost, total_cost in sale_items)

**Weaknesses:**
- Missing audit fields (created_by, updated_by, deleted_at)
- No audit logging tables
- No SQL views for analytics
- No PostgreSQL functions for business logic
- Some tables still reference deprecated shop_id

### RLS Policies

**Current Implementation:**
- Uses `public.get_my_business_id()` function for business context
- Policies filter by business_id for all tables
- Separate policies for business_users table
- Proper cascade deletes on business_id

**Issues:**
- `get_my_business_id()` relies on business_users table lookup
- No session-based context setting
- Function called on every query (performance concern)

### TypeScript Types

**Current State:**
- Comprehensive type definitions in `src/types/index.ts`
- Proper interfaces for all entities
- Deprecated shop_id fields marked
- Good separation of concerns

**Strengths:**
- Strong typing throughout
- Proper business_id typing
- Clear type hierarchy

**Weaknesses:**
- No audit field types (created_by, updated_by)
- No soft delete types
- Missing audit log types

### React Components

**Current Pages:**
- Dashboard - Stats cards, charts, quick actions
- Business Management - Recently redesigned with premium UI
- Products - Product management with inventory
- POS - Sales point of sale
- Sales History - Transaction listing
- Reports - Analytics with client-side calculations
- Expenses - Expense tracking
- Debts - Debt management
- Deals - Promotion management
- Settings - Worker management

**Design System:**
- Uses CSS variables for theming
- Tailwind CSS for styling
- Framer Motion for animations
- Lucide React for icons
- Dashboard serves as design reference

**Issues:**
- Reports.tsx has complex client-side calculations (should be SQL)
- No consistent table components (sorting, pagination, filtering)
- No reusable data table component
- Missing export functionality (PDF, Excel, CSV)
- No server-side pagination for large datasets

### Context Providers

**Current Providers:**
- AuthContext - User authentication and profile
- BusinessContext - Multi-business management
- LangContext - Internationalization
- ThemeContext - Theme management
- DynamicThemeContext - Per-business theming

**Strengths:**
- Proper separation of concerns
- Business context for multi-tenancy
- Dynamic theming support

**Weaknesses:**
- No audit context
- No notification context (partially added)
- No export context

### Duplicated Calculations

**Critical Issue Identified:**

1. **Revenue Calculations:**
   - Dashboard: Client-side aggregation of sales.total
   - Reports: Complex client-side calculation with payment ratio logic
   - Both should use same SQL view

2. **Profit Calculations:**
   - Reports: Client-side calculation (revenue - COGS - expenses)
   - Dashboard: No profit calculation
   - Should be centralized SQL function

3. **Top Products:**
   - Dashboard: Client-side aggregation from sale_items
   - Reports: Client-side aggregation from PaymentRow
   - Different calculation methods

4. **Low Stock:**
   - Dashboard: Client-side filter (stock_quantity <= low_stock_threshold)
   - useNotifications: Same calculation
   - Should be SQL view

5. **Date Range Filtering:**
   - Dashboard: Hardcoded 7-day window
   - Reports: Flexible (week/month/year)
   - Should use SQL function

---

## Proposed Improvements

### Phase 1: Database Enhancements

#### 1.1 Add Audit Fields to All Tables

**Migration: `006_add_audit_fields.sql`**

```sql
-- Add audit fields to all business tables
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'businesses', 'business_users', 'profiles', 'products', 
    'workers', 'sales', 'sale_items', 'debts', 'debt_payments',
    'expenses', 'deals'
  ] LOOP
    -- Add created_by if not exists
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id)', table_name);
    
    -- Add updated_by if not exists
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id)', table_name);
    
    -- Add deleted_at if not exists (soft delete)
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', table_name);
    
    -- Create index on deleted_at for performance
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_deleted_at ON %I(deleted_at) WHERE deleted_at IS NOT NULL', table_name, table_name);
  END LOOP;
END $$;

-- Update RLS policies to exclude soft-deleted records
-- Example for products (apply to all tables)
DROP POLICY IF EXISTS "Business products" ON products;
CREATE POLICY "Business products" ON products 
  FOR ALL USING (
    business_id = public.get_my_business_id() 
    AND deleted_at IS NULL
  );
```

#### 1.2 Create Audit Log Table

**Migration: `007_create_audit_log.sql`**

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name      TEXT NOT NULL,
  record_id       UUID,
  action          TEXT NOT NULL CHECK (action IN ('insert','update','delete','view')),
  old_values      JSONB,
  new_values      JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business audit logs" ON audit_logs
  FOR SELECT USING (business_id = public.get_my_business_id());

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_audit_logs_business ON audit_logs(business_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

#### 1.3 Create SQL Views for Analytics

**Migration: `008_create_analytics_views.sql`**

```sql
-- View: Dashboard Statistics
CREATE OR REPLACE VIEW vw_dashboard_stats AS
SELECT 
  s.business_id,
  COUNT(DISTINCT s.id) FILTER (WHERE s.created_at::date = CURRENT_DATE) as today_transactions,
  COALESCE(SUM(s.total) FILTER (WHERE s.created_at::date = CURRENT_DATE), 0) as today_sales,
  COUNT(DISTINCT p.id) as total_products,
  COUNT(DISTINCT p.id) FILTER (WHERE p.stock_quantity <= p.low_stock_threshold) as low_stock_count,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active') as total_debtors,
  COALESCE(SUM(d.balance) FILTER (WHERE d.status = 'active'), 0) as total_debt_amount
FROM sales s
CROSS JOIN LATERAL (
  SELECT COUNT(*) as product_count, 
         SUM(CASE WHEN stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count
  FROM products p WHERE p.business_id = s.business_id AND p.deleted_at IS NULL
) p_stats
CROSS JOIN LATERAL (
  SELECT COUNT(*) as debtor_count, 
         SUM(balance) as total_balance
  FROM debts d WHERE d.business_id = s.business_id AND d.status = 'active' AND d.deleted_at IS NULL
) d_stats
LEFT JOIN products p ON p.business_id = s.business_id AND p.deleted_at IS NULL
LEFT JOIN debts d ON d.business_id = s.business_id AND d.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.business_id;

-- View: Sales Summary with Profit
CREATE OR REPLACE VIEW vw_sales_summary AS
SELECT 
  s.id,
  s.business_id,
  s.created_at,
  s.payment_method,
  s.payment_status,
  s.total,
  s.customer_name,
  s.cashier_name,
  COALESCE(SUM(si.total_price), 0) as revenue,
  COALESCE(SUM(si.total_cost), 0) as cogs,
  COALESCE(SUM(si.total_price), 0) - COALESCE(SUM(si.total_cost), 0) as gross_profit,
  COUNT(DISTINCT si.id) as item_count
FROM sales s
LEFT JOIN sale_items si ON si.sale_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.business_id, s.created_at, s.payment_method, s.payment_status, s.total, s.customer_name, s.cashier_name;

-- View: Product Performance
CREATE OR REPLACE VIEW vw_product_performance AS
SELECT 
  p.id as product_id,
  p.business_id,
  p.name as product_name,
  p.category,
  p.stock_quantity,
  p.low_stock_threshold,
  COALESCE(SUM(si.quantity), 0) as total_sold,
  COALESCE(SUM(si.total_price), 0) as total_revenue,
  COALESCE(SUM(si.total_cost), 0) as total_cogs,
  COALESCE(SUM(si.total_price), 0) - COALESCE(SUM(si.total_cost), 0) as total_profit,
  COUNT(DISTINCT si.sale_id) as sale_count
FROM products p
LEFT JOIN sale_items si ON si.product_id = p.id
LEFT JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.business_id, p.name, p.category, p.stock_quantity, p.low_stock_threshold;

-- View: Customer Summary
CREATE OR REPLACE VIEW vw_customer_summary AS
SELECT 
  COALESCE(s.customer_name, 'Walk-in') as customer_name,
  COALESCE(s.customer_phone, '') as customer_phone,
  s.business_id,
  COUNT(DISTINCT s.id) as transaction_count,
  COALESCE(SUM(s.total), 0) as total_purchased,
  COALESCE(SUM(CASE WHEN s.payment_method = 'credit' THEN s.total ELSE 0 END), 0) as total_credit,
  COALESCE(SUM(d.balance), 0) as outstanding_debt,
  MAX(s.created_at) as last_purchase_date
FROM sales s
LEFT JOIN debts d ON d.customer_name = s.customer_name AND d.business_id = s.business_id AND d.status = 'active' AND d.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.customer_name, s.customer_phone, s.business_id;

-- View: Payment Distribution
CREATE OR REPLACE VIEW vw_payment_distribution AS
SELECT 
  business_id,
  payment_method,
  COUNT(*) as transaction_count,
  COALESCE(SUM(total), 0) as total_amount,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY business_id), 2) as percentage
FROM sales
WHERE deleted_at IS NULL
GROUP BY business_id, payment_method;
```

#### 1.4 Create PostgreSQL Functions

**Migration: `009_create_business_functions.sql`**

```sql
-- Function: Calculate Revenue for Date Range
CREATE OR REPLACE FUNCTION calculate_revenue(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_payment_method TEXT DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_revenue NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total), 0)
  INTO v_revenue
  FROM sales
  WHERE business_id = p_business_id
    AND created_at >= p_start_date
    AND created_at < p_end_date
    AND deleted_at IS NULL
    AND (p_payment_method IS NULL OR payment_method = p_payment_method);
  
  RETURN v_revenue;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Calculate Profit for Date Range
CREATE OR REPLACE FUNCTION calculate_profit(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS NUMERIC AS $$
DECLARE
  v_revenue NUMERIC;
  v_cogs NUMERIC;
  v_expenses NUMERIC;
BEGIN
  -- Revenue from sales
  SELECT COALESCE(SUM(si.total_price), 0)
  INTO v_revenue
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  WHERE s.business_id = p_business_id
    AND s.created_at >= p_start_date
    AND s.created_at < p_end_date
    AND s.deleted_at IS NULL;
  
  -- COGS from sale items
  SELECT COALESCE(SUM(si.total_cost), 0)
  INTO v_cogs
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  WHERE s.business_id = p_business_id
    AND s.created_at >= p_start_date
    AND s.created_at < p_end_date
    AND s.deleted_at IS NULL;
  
  -- Expenses
  SELECT COALESCE(SUM(amount), 0)
  INTO v_expenses
  FROM expenses
  WHERE business_id = p_business_id
    AND expense_date >= p_start_date
    AND expense_date < p_end_date
    AND deleted_at IS NULL;
  
  RETURN v_revenue - v_cogs - v_expenses;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Get Low Stock Products
CREATE OR REPLACE FUNCTION get_low_stock_products(p_business_id UUID)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  category TEXT,
  current_stock NUMERIC,
  threshold NUMERIC,
  deficit NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.category,
    p.stock_quantity,
    p.low_stock_threshold,
    p.low_stock_threshold - p.stock_quantity
  FROM products p
  WHERE p.business_id = p_business_id
    AND p.stock_quantity <= p.low_stock_threshold
    AND p.deleted_at IS NULL
  ORDER BY (p.low_stock_threshold - p.stock_quantity) DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Log Audit Entry
CREATE OR REPLACE FUNCTION log_audit(
  p_table_name TEXT,
  p_record_id UUID,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_business_id UUID;
BEGIN
  -- Get current business_id from context
  v_business_id := public.get_my_business_id();
  
  INSERT INTO audit_logs (
    business_id,
    user_id,
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    v_business_id,
    auth.uid(),
    p_table_name,
    p_record_id,
    p_action,
    p_old_values,
    p_new_values,
    inet_client_addr(),
    current_setting('request.headers.user-agent', true)
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### Phase 2: TypeScript Type Updates

**File: `src/types/index.ts`**

```typescript
// Add to existing types

export interface AuditLog {
  id: string;
  business_id: string;
  user_id: string;
  table_name: string;
  record_id?: string;
  action: 'insert' | 'update' | 'delete' | 'view';
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface DashboardStatsView {
  business_id: string;
  today_transactions: number;
  today_sales: number;
  total_products: number;
  low_stock_count: number;
  total_debtors: number;
  total_debt_amount: number;
}

export interface SalesSummaryView {
  id: string;
  business_id: string;
  created_at: string;
  payment_method: string;
  payment_status: string;
  total: number;
  customer_name?: string;
  cashier_name?: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  item_count: number;
}

export interface ProductPerformanceView {
  product_id: string;
  business_id: string;
  product_name: string;
  category: string;
  stock_quantity: number;
  low_stock_threshold: number;
  total_sold: number;
  total_revenue: number;
  total_cogs: number;
  total_profit: number;
  sale_count: number;
}

export interface CustomerSummaryView {
  customer_name: string;
  customer_phone: string;
  business_id: string;
  transaction_count: number;
  total_purchased: number;
  total_credit: number;
  outstanding_debt: number;
  last_purchase_date: string;
}

// Update existing interfaces to include audit fields
export interface Product {
  // ... existing fields
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

export interface Sale {
  // ... existing fields
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

// Apply to all other entities similarly
```

### Phase 3: Reusable React Components

#### 3.1 Create DataTable Component

**File: `src/components/DataTable.tsx`**

```typescript
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
```

#### 3.2 Create Export Utility

**File: `src/lib/export.ts`**

```typescript
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export type ExportFormat = 'csv' | 'excel' | 'pdf'

export interface ExportOptions {
  filename: string
  format: ExportFormat
  data: any[]
  columns: { key: string; label: string }[]
}

export function exportData({ filename, format, data, columns }: ExportOptions) {
  switch (format) {
    case 'csv':
      exportCSV(filename, data, columns)
      break
    case 'excel':
      exportExcel(filename, data, columns)
      break
    case 'pdf':
      exportPDF(filename, data, columns)
      break
  }
}

function exportCSV(filename: string, data: any[], columns: { key: string; label: string }[]) {
  const headers = columns.map(c => c.label)
  const rows = data.map(row => columns.map(c => row[c.key]))
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(`${filename}.csv`, blob)
}

function exportExcel(filename: string, data: any[], columns: { key: string; label: string }[]) {
  const worksheet = XLSX.utils.json_to_sheet(
    data.map(row => {
      const obj: any = {}
      columns.forEach(col => {
        obj[col.label] = row[col.key]
      })
      return obj
    })
  )
  
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

function exportPDF(filename: string, data: any[], columns: { key: string; label: string }[]) {
  const doc = new jsPDF()
  
  const tableData = data.map(row => columns.map(col => row[col.key]))
  const tableHeaders = columns.map(col => col.label)
  
  doc.autoTable({
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 }
  })
  
  doc.save(`${filename}.pdf`)
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

### Phase 4: Refactor Reports Page

**Key Changes:**
- Replace client-side calculations with SQL views
- Use `vw_sales_summary` for sales data
- Use `vw_product_performance` for product analytics
- Use `calculate_revenue()` and `calculate_profit()` functions
- Implement server-side pagination
- Add DataTable component
- Add export functionality

### Phase 5: Refactor Dashboard Page

**Key Changes:**
- Use `vw_dashboard_stats` view instead of multiple queries
- Replace client-side aggregations with SQL
- Add profit calculation using `calculate_profit()`
- Ensure consistency with Reports page
- Add drill-down to Sales History on card click

### Phase 6: Enhance Sales History

**New Features:**
- Advanced search (invoice number, customer, product)
- Multiple filters (date range, payment method, status)
- Server-side sorting and pagination
- Invoice lookup by ID
- Receipt printing
- Transaction details drawer
- Customer link to customer profile
- Product link to product details
- Audit history timeline
- Notes and attachments
- Duplicate sale functionality
- Refund capability

### Phase 7: UI Consistency Improvements

**Actions:**
- Ensure all pages use same card style as Dashboard
- Standardize spacing (24px between sections)
- Use consistent typography
- Apply same button styles across all pages
- Use consistent form inputs
- Implement consistent loading states
- Add consistent empty states
- Use consistent error handling

### Phase 8: Performance Optimizations

**Database:**
- Add composite indexes for common query patterns
- Create materialized views for heavy analytics
- Implement query result caching
- Optimize RLS policies

**Frontend:**
- Implement React.memo for expensive components
- Use virtual scrolling for large lists
- Implement proper code splitting
- Add service worker for offline caching
- Optimize bundle size

### Phase 9: Real-time Updates

**Implementation:**
- Use Supabase Realtime for:
  - Dashboard stats updates on new sale
  - Inventory updates on sale completion
  - Debt updates on payment
  - Low stock alerts
- Remove manual refresh requirements
- Add optimistic UI updates

### Phase 10: Audit Logging

**Implementation:**
- Add triggers for automatic audit logging on:
  - Sales (insert, update, delete)
  - Products (insert, update, delete)
  - Debts (insert, update, delete)
  - Expenses (insert, update, delete)
- Create audit log viewer in Settings
- Add export of audit logs

---

## Implementation Priority

### High Priority (Phase 1-3)
1. Add audit fields to tables
2. Create SQL views for analytics
3. Create PostgreSQL functions
4. Update TypeScript types
5. Create reusable DataTable component
6. Create export utility

### Medium Priority (Phase 4-6)
7. Refactor Reports page to use SQL views
8. Refactor Dashboard page to use SQL views
9. Enhance Sales History with advanced features
10. Add server-side pagination

### Low Priority (Phase 7-10)
11. UI consistency improvements
12. Performance optimizations
13. Real-time updates
14. Audit logging implementation

---

## Success Metrics

- **Code Duplication:** Reduce duplicated calculations by 80%
- **Performance:** Dashboard load time < 500ms, Reports load time < 1s
- **Consistency:** All pages use same design system
- **Maintainability:** Single source of truth for all calculations
- **Scalability:** Support 10x more transactions without performance degradation
- **Audit Trail:** 100% of critical operations logged

---

## Risks and Mitigations

**Risk:** Breaking existing functionality during refactor
**Mitigation:** Comprehensive testing, gradual rollout, feature flags

**Risk:** Performance regression from SQL views
**Mitigation:** Benchmark queries, add indexes, use materialized views

**Risk:** User resistance to UI changes
**Mitigation:** Gradual UI updates, maintain familiar workflows

---

## Conclusion

This refactor plan transforms myShopCare into a professional, enterprise-grade ERP while preserving all existing functionality. The focus on SQL-based calculations, reusable components, and consistent UI/UX will significantly improve maintainability, performance, and scalability. The phased approach ensures minimal disruption while delivering measurable improvements at each stage.
