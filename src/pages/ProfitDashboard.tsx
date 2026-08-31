import { lazy, Suspense } from 'react'
import { useAuth } from '../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

export default function ProfitDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: revenueData, isPending: isLoadingRevenue } = useQuery(
    ['profit-revenue'],
    async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('total_amount, gst_amount, status, created_at')
      if (error) throw error
      return data
    },
    { refetchInterval: false }
  )

  const { data: expensesData, isPending: isLoadingExpenses } = useQuery(
    ['profit-expenses'],
    async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, created_at')
      if (error) throw error
      return data
    },
    { refetchInterval: false }
  )

  const { data: supplierCredits, isPending: isLoadingCredits } = useQuery(
    ['supplier-credits'],
    async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('name, outstanding')
      if (error) throw error
      return data
    },
    { refetchInterval: false }
  )

  const { data: customerCredits, isPending: isLoadingCustomerCredits } = useQuery(
    ['customer-credits'],
    async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('name, credit_limit, outstanding')
      if (error) throw error
      return data
    },
    { refetchInterval: false }
  )

  const paidInvoices = revenueData?.filter((inv: any) => inv.status === 'paid') || []
  const revenue = paidInvoices.reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0)
  const cogs = paidInvoices.reduce((sum: number, inv: any) => sum + (inv.gst_amount || 0), 0)
  const grossProfit = revenue - cogs

  const paidExpenses = expensesData?.filter((exp: any) => exp.type === 'expense') || []
  const totalExpenses = paidExpenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0)
  const netProfit = grossProfit - totalExpenses

  const totalRevenueLabel = '₹' + revenue.toLocaleString()
  const totalCogsLabel = '₹' + cogs.toLocaleString()
  const grossProfitLabel = '₹' + grossProfit.toLocaleString()
  const totalExpensesLabel = '₹' + totalExpenses.toLocaleString()
  const netProfitLabel = '₹' + netProfit.toLocaleString()

  const profitIcon = netProfit >= 0 ? TrendingUp : TrendingDown
  const profitText = netProfit >= 0 ? 'Profit' : 'Loss'

  return (
    <div className="rounded-lg border p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-fg">Profit Dashboard</h2>
        <button
          onClick={() => navigate('/bank-import')}
          className="inline-flex items-center justify-center rounded-md border border-accent text-accent hover:bg-accent/10 py-2 px-4 text-sm font-medium"
        >
          Bank Import
        </button>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Revenue Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-lg font-semibold">{totalRevenueLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">COGS</p>
            <p className="text-lg font-semibold">{totalCogsLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gross Profit</p>
            <p className="text-lg font-semibold">{grossProfitLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="text-lg font-semibold">{totalExpensesLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 rounded-lg {netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}">
        {netProfit >= 0 ? (
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-yellow-700">
              Net Profit of {netProfitLabel} is {profitText.toLowerCase()}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-600">Net Loss of {netProfitLabel}</span>
          </div>
        )}
      </div>

      {supplierCredits && !isLoadingCredits && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Supplier Outstanding</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {supplierCredits.map((supplier: any) => (
              <div
                key={supplier.id}
                className={`p-3 rounded bg-${supplier.outstanding > 0 ? 'red-50' : 'green-50'} border ${supplier.outstanding > 0 ? 'border-red-200' : 'border-green-200'}`}
              >
                <p className="text-xs text-muted-foreground">{supplier.name}</p>
                <p className="text-lg font-bold">
                  {'₹' + (supplier.outstanding?.toLocaleString() || 0)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {customerCredits && !isLoadingCustomerCredits && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Customer Credit Limits</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {customerCredits.map((customer: any) => (
              <div
                key={customer.id}
                className={`p-3 rounded bg-${customer.outstanding > 0 ? 'red-50' : 'green-50'} border ${customer.outstanding > 0 ? 'border-red-200' : 'border-green-200'}`}
              >
                <p className="text-xs text-muted-foreground">{customer.name}</p>
                <p className="text-lg font-bold">
                  {'₹' + (customer.credit_limit?.toString() || '0')} - Out: {'₹' + (customer.outstanding?.toString() || '0')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(isLoadingRevenue || isLoadingExpenses || isLoadingCredits || isLoadingCustomerCredits) && (
        <div className="mt-8">
          <p className="text-sm text-muted-foreground">Loading profit data...</p>
        </div>
      )}
    </div>
  )
}
