// ─── Shared TypeScript types ────────────────────────────────────

export interface Profile {
  id: string
  full_name: string | null
  company_name: string | null
  avatar_url: string | null
  plan: 'free' | 'starter' | 'pro' | 'enterprise'
  ai_provider: 'openai' | 'gemini' | 'anthropic'
  api_usage_count: number
  api_usage_limit: number
  trial_ends_at: string | null
  gstin: string | null
  business_address: string | null
  business_state: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
}

export interface Invoice {
  id: string
  user_id: string
  invoice_number: string
  client_name: string
  client_email: string | null
  client_address: string | null
  items: InvoiceItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  user_id: string
  title: string
  report_type: 'financial' | 'sales' | 'operations' | 'custom'
  input_data: string | null
  generated_content: string | null
  provider: string
  created_at: string
}

export interface DataEntry {
  id: string
  user_id: string
  source_text: string
  extracted_data: Record<string, unknown>
  category: string
  provider: string
  created_at: string
}

export interface Summary {
  id: string
  user_id: string
  source_text: string
  summary_type: 'brief' | 'detailed' | 'bullets' | 'executive'
  generated_summary: string | null
  provider: string
  word_count: number | null
  created_at: string
}

export interface Email {
  id: string
  user_id: string
  subject: string
  recipient: string | null
  email_type: 'winback' | 'offer' | 'thankyou' | 'abandoned' | 'newsletter' | 'custom'
  tone: 'professional' | 'friendly' | 'persuasive' | 'formal' | 'casual'
  key_points: string | null
  generated_body: string | null
  provider: string
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string
  action_type: 'invoice' | 'report' | 'extract' | 'summary' | 'email' | 'sentiment' | 'campaign'
  description: string | null
  time_saved_minutes: number
  money_saved: number
  provider: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  active: boolean
  created_at: string
}

export interface EmailCampaign {
  id: string
  user_id: string
  name: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused'
  template_subject: string | null
  template_body: string | null
  tone: string
  ab_enabled: boolean
  variant_a_subject: string | null
  variant_b_subject: string | null
  followup_enabled: boolean
  followup_delay_days: number
  followup_count: number
  scheduled_at: string | null
  sent_count: number
  opened_count: number
  clicked_count: number
  replied_count: number
  provider: string
  created_at: string
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  email: string
  name: string | null
  personalization: Record<string, unknown>
  variant: string | null
  status: 'pending' | 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced'
  sentiment: string | null
  sentiment_score: number | null
  generated_subject: string | null
  generated_body: string | null
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  replied_at: string | null
  created_at: string
}

// ─── Subscription plans ─────────────────────────────────────────

// ─── Retail POS entities ────────────────────────────────────────
export interface Product {
  id: string
  user_id: string
  name: string
  description: string | null
  sku: string | null
  category: string
  price: number
  cost: number
  stock_quantity: number
  low_stock_threshold: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  company: string | null
  notes: string | null
  tags: string[]
  total_spent: number
  total_orders: number
  loyalty_points: number
  first_purchase_at: string | null
  last_purchase_at: string | null
  created_at: string
}

export interface TransactionItem {
  product_id: string
  name: string
  quantity: number
  unit_price: number
}

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'other'

export interface Transaction {
  id: string
  user_id: string
  customer_id: string | null
  receipt_number: string
  items: TransactionItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount: number
  total: number
  payment_method: PaymentMethod
  status: 'completed' | 'refunded' | 'void'
  notes: string | null
  served_by: string | null
  created_at: string
}

// ─── ERP entities (suppliers, POs, quotations, expenses) ───────
export interface Supplier {
  id: string
  user_id: string
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  gstin: string | null
  notes: string | null
  outstanding: number
  created_at: string
}

export interface POItem {
  name: string
  quantity: number
  unit_price: number
}

export interface PurchaseOrder {
  id: string
  user_id: string
  supplier_id: string | null
  po_number: string
  items: POItem[]
  subtotal: number
  tax_amount: number
  total: number
  status: 'draft' | 'ordered' | 'received' | 'cancelled'
  expected_date: string | null
  notes: string | null
  created_at: string
}

export interface QuotationItem {
  description: string
  quantity: number
  unit_price: number
}

export interface Quotation {
  id: string
  user_id: string
  customer_id: string | null
  quote_number: string
  customer_name: string
  customer_email: string | null
  items: QuotationItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  status: 'draft' | 'sent' | 'accepted' | 'converted' | 'rejected' | 'expired'
  valid_until: string | null
  notes: string | null
  created_at: string
}

export interface Expense {
  id: string
  user_id: string
  category: string
  description: string
  amount: number
  type: 'expense' | 'income'
  payment_method: string | null
  date: string
  notes: string | null
  created_at: string
}

// ─── Subscription plans ─────────────────────────────────────────
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    usageLimit: 50,
    features: [
      '50 AI actions per month',
      'Invoice generation',
      'Basic summaries',
      '1 AI provider',
    ],
  },
  starter: {
    name: 'Starter',
    price: 19,
    usageLimit: 500,
    features: [
      '500 AI actions per month',
      'All automation tools',
      'Report generation',
      'Data extraction',
      'All AI providers',
    ],
  },
  pro: {
    name: 'Pro',
    price: 49,
    usageLimit: 2000,
    features: [
      '2,000 AI actions per month',
      'Everything in Starter',
      'Priority AI processing',
      'Invoice management',
      'Email support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 149,
    usageLimit: 10000,
    features: [
      '10,000 AI actions per month',
      'Everything in Pro',
      'Custom AI workflows',
      'Team accounts',
      'Priority support',
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS
