import { lazy, Suspense } from 'react'
import { useAuth } from '../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Button, Loader } from 'lucide-react'

export default function GstExport() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: invoices, isPending } = useQuery(
    ['gst-invoices'],
    async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .not('gst_status', 'is', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    { refetchInterval: false }
  )

  const generateGstReport = async () => {
    if (!invoices || invoices.length === 0) {
      alert('No invoices found with GST data.')
      return
    }

    const report = invoices.map((inv: any) => ({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.created_at,
      gst_rate: inv.gst_rate || 0,
      gst_amount: inv.gst_amount || 0,
      total_amount: inv.total_amount,
      customer_name: inv.customer_name,
      customer_gstin: inv.customer_gstin,
      status: inv.status
    }))

    const csvContent = [
      ['Invoice ID', 'Invoice No.', 'Date', 'GST Rate (%)', 'GST Amount', 'Total', 'Customer', 'GSTIN', 'Status'],
      ...report.map((r: any) => [
        r.invoice_id,
        r.invoice_number,
        new Date(r.invoice_date).toLocaleDateString(),
        r.gst_rate,
        r.gst_amount,
        r.total_amount,
        r.customer_name,
        r.customer_gstin || '',
        r.status
      ])
    ]
      .map((row: any[]) => row.map((field: any) => `"${field}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `gstr1-report-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-fg mb-4">GST GSTR-1 Export</h2>

      <p className="text-sm text-muted-foreground mb-4">
        Export your GST invoices in GSTR-1 compatible format for filing.
      </p>

      {isPending ? (
        <p>
          <Loader className="h-4 w-4 mr-2" /> Loading invoices...
        </p>
      ) : invoices ? (
        <>
          <button
            onClick={generateGstReport}
            className="inline-flex items-center justify-center rounded-md border border-accent text-accent hover:bg-accent/10 py-2 px-4 text-sm font-medium"
            disabled={invoices.length === 0}
          >
            {invoices.length} invoices found • Generate GSTR-1 Report
          </button>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead>
                <tr>
                  <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">Invoice ID</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">Invoice No.</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">Date</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">GST Rate (%)</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">GST Amount</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">Total</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">Customer</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">GSTIN</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b hover:bg-surface-1">
                    <td className="p-3">{inv.id}</td>
                    <td className="p-3">{inv.invoice_number}</td>
                    <td className="p-3">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="p-3">{inv.gst_rate || 0}</td>
                    <td className="p-3">{inv.gst_amount || 0}</td>
                    <td className="p-3">{inv.total_amount}</td>
                    <td className="p-3">{inv.customer_name || '—'}</td>
                    <td className="p-3">{inv.customer_gstin || '—'}</td>
                    <td className="p-3">{inv.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No invoices found.</p>
      )}
    </div>
  )
}