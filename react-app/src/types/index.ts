// ─── Auth / User ─────────────────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  shop_name: string;
  shop_id?: string; // Deprecated, use business_id
  business_id?: string;
  role: 'owner' | 'cashier' | 'manager';
  created_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

export interface Business {
  id: string;
  name: string;
  logo_url?: string;
  theme_color: string;
  currency: 'USD' | 'TZS' | 'KSH';
  owner_id: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  _role?: 'owner' | 'manager' | 'cashier'; // Internal use for user's role in this business
}

export interface BusinessUser {
  id: string;
  business_id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'cashier';
  created_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

export interface Worker {
  id: string;
  shop_id?: string; // Deprecated, use business_id
  business_id: string;
  name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

// ─── Products ─────────────────────────────────────────────────
export interface Product {
  id: string;
  shop_id?: string; // Deprecated, use business_id
  business_id: string;
  name: string;
  sku: string;
  description?: string;
  category: string;
  buying_price: number;
  selling_price: number;
  stock_quantity: number;
  unit: string;
  low_stock_threshold: number;
  image_url?: string;
  expiry_date?: string | null;       // ISO date string YYYY-MM-DD
  expiry_days_alert: number;         // days before expiry to alert (default 30)
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

// ─── Sales / POS ──────────────────────────────────────────────
export interface Sale {
  id: string;
  shop_id?: string; // Deprecated, use business_id
  business_id: string;
  cashier_id: string;
  cashier_worker_id?: string;
  cashier_name?: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: 'cash' | 'mobile_money' | 'card' | 'credit';
  payment_status: 'paid' | 'partial' | 'pending';
  amount_paid: number;
  change_given: number;
  notes?: string;
  created_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_cost?: number;
  total_cost?: number;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

export interface CartItem extends Product {
  qty: number;
}

// ─── Debts ────────────────────────────────────────────────────
export interface Debt {
  id: string;
  shop_id?: string; // Deprecated, use business_id
  business_id: string;
  customer_name: string;
  customer_phone?: string;
  original_amount: number;
  amount_paid: number;
  balance: number;
  due_date?: string;
  status: 'active' | 'paid' | 'overdue';
  notes?: string;
  sale_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
  payments?: DebtPayment[];
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
  created_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

export interface Expense {
  id: string;
  shop_id?: string; // Deprecated, use business_id
  business_id: string;
  category: string;
  description?: string;
  amount: number;
  payment_method: 'cash' | 'mobile_money' | 'card' | 'bank' | 'other';
  expense_date: string;
  created_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

// ─── Deals / Promotions ───────────────────────────────────────
export interface Deal {
  id: string;
  shop_id?: string; // Deprecated, use business_id
  business_id: string;
  name: string;
  description?: string;
  deal_type: 'percentage' | 'fixed' | 'bogo' | 'bundle';
  discount_value: number;
  min_purchase?: number;
  applicable_products?: string[];
  start_date: string;
  end_date: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

// ─── Dashboard ────────────────────────────────────────────────
export interface DashboardStats {
  today_sales: number;
  today_transactions: number;
  total_products: number;
  low_stock_count: number;
  total_debtors: number;
  total_debt_amount: number;
  week_revenue: { date: string; revenue: number }[];
  top_products: { name: string; qty: number; revenue: number }[];
}

// ─── SQL View Types ─────────────────────────────────────────────
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

export interface PaymentDistributionView {
  business_id: string;
  payment_method: string;
  transaction_count: number;
  total_amount: number;
  percentage: number;
}

// ─── Audit Log ─────────────────────────────────────────────────
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

// ─── i18n ─────────────────────────────────────────────────────
export type Lang = 'en' | 'sw';

export interface Translations {
  [key: string]: string;
}

// ─── Offline Sync ───────────────────────────────────────────────
export interface OfflineSyncItem {
  id: string;
  business_id: string;
  user_id: string;
  table_name: string;
  operation: 'insert' | 'update' | 'delete' | 'rpc';
  record_id?: string;
  record_data: any;
  created_at: string;
  synced_at?: string;
  sync_status: 'pending' | 'synced' | 'failed';
}
