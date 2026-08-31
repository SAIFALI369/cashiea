import { lazy, Suspense } from 'react'
import { useAuth } from '../context/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Loader } from 'lucide-react'

export default function BankImport() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fetch existing invoices for matching
  const { data: invoices, isPending: isLoadingInvoices } = useQuery(
    ['all-invoices'],
    async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, customer_name, status, created_at')
      if (error) throw error
      return data
    },
    { refetchInterval: false }
  )

  const [file, setFile] = useState<File | null>(null)
  const [importProgress, setImportProgress] = useState(0)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setImportProgress(0)

    // Parse CSV
    const text = selectedFile?.text ? await selectedFile.text() : ''
    const rows = parseCsv(text)
    processBankStatement(rows)
  }

  const parseCsv = (text: string) => {
    const lines = text.trim().split('\n')
    return lines.map((line: string) => line.split(',').map((cell: string) => cell.trim()))
  }

  const processBankStatement = async (rows: string[][]) => {
    if (rows.length < 2) {
      alert('No data found in file.')
      setImportProgress(0)
      return
    }

    let matched = 0
    let unmatched = 0

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (row.length < 3) continue

      const date = row[0]
      const description = row[1]
      const amount = parseFloat(row[2])

      if (isNaN(amount)) {
        unmatched++
        continue
      }

      // Try to match with invoice
      const matchedInvoice = invoices?.find(
        (inv: any) =>
          inv.total_amount.toString() === amount.toString() ||
          Math.abs(inv.total_amount - amount) < 0.01
      )

      if (matchedInvoice) {
        // Check if already imported
        const { error } = await supabase
          .from('bank_transactions')
          .select('id')
          .eq('invoice_id', matchedInvoice.id)

        if (!error || error.count === 0) {
          await supabase.from('bank_transactions').insert({
            invoice_id: matchedInvoice.id,
            transaction_date: date,
            amount,
            description,
            matched: true,
          })
          matched++
        }
      } else {
        // Create unmatched transaction
        await supabase.from('bank_transactions').insert({
          transaction_date: date,
          amount,
          description,
          matched: false,
        })
        unmatched++
      }
    }

    // Refresh queries
    queryClient.invalidateQueries(['bank-transactions'])
    queryClient.invalidateQueries(['invoices'])

    setImportProgress(100)
    alert(`Import complete: ${matched} matched, ${unmatched} unmatched.`)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-fg mb-4">Bank Statement Import</h2>

      <p className="text-sm text-muted-foreground mb-4">
        Upload a CSV bank statement to match and import against your invoices.
        Expected format: <code>Date,Description,Amount</code>
      </p>

      {/* File Upload */}
      <div className="mb-4">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="w-full rounded-md border border-line bg-paper text-fg placeholder:text-fg-subtle py-2.5 transition-colors cursor-pointer"
          disabled={isLoadingInvoices}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Format: Date,Description,Amount (e.g., 2024-01-15,UPI Payment,5000)
        </p>
      </div>

      {/* Preview Section */}
      {!isLoadingInvoices && invoices && invoices.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Sample Invoices for Matching
          </h3>
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead>
              <tr>
                <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">
                  Invoice No.
                </th>
                <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">
                  Customer
                </th>
                <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">
                  Amount
                </th>
                <th className="p-3 border-b text-left text-xs font-medium text-fg-muted bg-surface-1">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 10).map((inv: any) => (
                <tr key={inv.id} className="border-b hover:bg-surface-1">
                  <td className="p-3">{inv.invoice_number}</td>
                  <td className="p-3">{inv.customer_name || '—'}</td>
                  <td className="p-3">{`₹${inv.total_amount?.toLocaleString()}`}</td>
                  <td className="p-3">{inv.status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-2">
            Showing first 10 invoices. CSV amounts will be matched automatically.
          </p>
        </div>
      )}

      {/* Import Status */}
      {isLoadingInvoices && (
        <p>
          <Loader className="h-4 w-4 mr-2" /> Loading invoices...
        </p>
      )}

      {/* Progress */}
      {file && importProgress < 100 && (
        <button disabled className="inline-flex items-center justify-center rounded-md border border-accent text-accent hover:bg-accent/10 py-2 px-4 text-sm font-medium">
          Processing... {importProgress}%
        </button>
      )}
    </div>
  )
}