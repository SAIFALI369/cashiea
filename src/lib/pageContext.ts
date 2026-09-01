// ════════════════════════════════════════════════════════════════
// PAGE CONTEXT — lets Meraj know WHICH page the owner is looking at.
// The floating mini-assistant passes this to the AI so questions about
// "this", "here", or "this page" are answered against the right screen.
// Live business data still comes from the backend snapshot; this just
// tells the model which page (and therefore which data) to focus on.
// ════════════════════════════════════════════════════════════════

export interface PageContextInfo {
  name: string
  description: string
}

const PAGE_CONTEXT: Record<string, PageContextInfo> = {
  '/app/profit-dashboard': {
    name: 'Profit',
    description: 'the profit dashboard — sales revenue, estimated cost of goods sold, gross and net profit, expenses, supplier dues and customer udhaar for the selected period',
  },
  '/app/gst-export': {
    name: 'GST Export',
    description: 'the GST export sheet — rate-wise GST summary (CGST/SGST/IGST), B2B vs B2C split and invoice list for GSTR-1 filing preparation',
  },
  '/app/bank-import': {
    name: 'Bank Import',
    description: 'the bank statement import — upload a bank CSV, match credits to unpaid invoices, and mark matched invoices paid',
  },
  '/app/pos': {
    name: 'Point of Sale',
    description: 'the checkout screen where you ring up a new sale — add items and quantities, apply discount and tax, take payment, and generate a bill',
  },
  '/app/products': {
    name: 'Products & Stock',
    description: 'your inventory — product names, selling price, cost, SKU, category, current stock quantity, and low-stock reorder thresholds',
  },
  '/app/customers': {
    name: 'Customers',
    description: 'your customer list — names, phone, email, total spent, number of orders, and last purchase date',
  },
  '/app/suppliers': {
    name: 'Suppliers',
    description: 'your suppliers / vendors — their names and any outstanding amounts you owe them',
  },
  '/app/khata': {
    name: 'Khata',
    description: 'your digital udhaar book — credit given to customers, pending amounts, collection history',
  },
  '/app/invoices': {
    name: 'Receipts & Invoices',
    description: 'your bills and GST invoices — invoice numbers, customer names, line items, totals, tax, discount, and status (draft / paid)',
  },
  '/app/accounts': {
    name: 'Accounts',
    description: 'your expenses, income, payouts, and profit & loss overview',
  },
  '/app/quotations': {
    name: 'Quotations',
    description: 'the price quotes / estimates you have sent to customers',
  },
  '/app/reports': {
    name: 'Reports',
    description: 'your AI-generated sales and business insight reports',
  },
  '/app/summaries': {
    name: 'Summaries',
    description: 'your saved AI summaries of business activity',
  },
  '/app/email-assistant': {
    name: 'Email Assistant',
    description: 'the tool for drafting customer and retargeting emails',
  },
  '/app/campaigns': {
    name: 'Campaigns',
    description: 'your WhatsApp / SMS broadcast and win-back campaigns to customers',
  },
  '/app/brain': {
    name: 'Business Brain',
    description: 'AI-predicted tasks, actions and follow-ups for your shop',
  },
  '/app/team': {
    name: 'Team & Staff',
    description: 'your staff members and their roles',
  },
  '/app/data-entry': {
    name: 'Data Entry',
    description: 'bulk data-entry tools for products, sales, or customers',
  },
  '/app/activity': {
    name: 'Activity Logs',
    description: 'the log of actions you and Meraj have taken, with time and money saved',
  },
  '/app/failed-jobs': {
    name: 'Pending Jobs',
    description: 'background jobs that failed or are pending a retry',
  },
  '/app/connect-apps': {
    name: 'Connections',
    description: 'the apps connected to your Cashiea account (e.g. Gmail, Google Sheets)',
  },
  '/app/integrations': {
    name: 'Integrations',
    description: 'available third-party integrations for your account',
  },
  '/app/settings': {
    name: 'Settings',
    description: 'your account settings — appearance, AI provider, profile',
  },
  '/app/account': {
    name: 'Account & Profile',
    description: 'your profile — name, phone, email, company, role (Owner)',
  },
  '/app/subscription': {
    name: 'Subscription',
    description: 'your plan, billing, and usage limits',
  },
  '/app/api-keys': {
    name: 'API Keys',
    description: 'your API keys for external integrations',
  },
  '/app/compliance': {
    name: 'Compliance',
    description: 'data-protection and compliance settings',
  },
  '/app/support': {
    name: 'Support',
    description: 'help and support options',
  },
  '/app/about': {
    name: 'About Me',
    description: 'your account overview',
  },
  '/app/suggestions': {
    name: 'Suggestions',
    description: 'feature suggestions and feedback',
  },
  '/app/notifications': {
    name: 'Notifications',
    description: 'your notifications',
  },
  '/app/permissions': {
    name: 'Permissions',
    description: 'data and app permissions',
  },
}

/** Resolve the page context for a pathname, or null when unknown. */
export function getPageContext(pathname: string): PageContextInfo | null {
  if (!pathname || !pathname.startsWith('/app')) return null
  const clean = pathname.split('?')[0].split('#')[0]
  if (PAGE_CONTEXT[clean]) return PAGE_CONTEXT[clean]
  // Dynamic routes (e.g. /app/campaigns/new, /app/campaigns/:id) → parent page.
  if (clean.startsWith('/app/campaigns')) return PAGE_CONTEXT['/app/campaigns']
  return null
}
