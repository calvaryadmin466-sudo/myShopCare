// ─── Auth / User ─────────────────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  shop_name: string;
  shop_id: string;
  role: 'owner' | 'cashier' | 'manager';
  created_at: string;
}

export interface Worker {
  id: string;
  shop_id: string;
  name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

// ─── Products ─────────────────────────────────────────────────
export interface Product {
  id: string;
  shop_id: string;
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
  created_at: string;
  updated_at: string;
}

// ─── Sales / POS ──────────────────────────────────────────────
export interface Sale {
  id: string;
  shop_id: string;
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
}

export interface CartItem extends Product {
  qty: number;
}

// ─── Debts ────────────────────────────────────────────────────
export interface Debt {
  id: string;
  shop_id: string;
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
  payments?: DebtPayment[];
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
  created_at: string;
}

// ─── Deals / Promotions ───────────────────────────────────────
export interface Deal {
  id: string;
  shop_id: string;
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

// ─── i18n ─────────────────────────────────────────────────────
export type Lang = 'en' | 'sw';

export interface Translations {
  [key: string]: string;
}
