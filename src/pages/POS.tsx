import { ConfirmDialog } from '../components/ConfirmDialog'
import { useDebounce } from '../lib/useDebounce'
import { useEffect, useState, useMemo } from 'react'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { ScanLine } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { offlineInsert } from '../lib/mutations'
import { formatINR } from '../lib/format'
import type { Product, Customer, TransactionItem, PaymentMethod } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { ShoppingCart, Search, Plus, Minus, Trash2, Loader2, Receipt, UserCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface CartLine extends TransactionItem {
  stock: number
}

export default function POS() {
  const { profile, ownerId } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartLine[]>([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [showScanner, setShowScanner] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [taxRate, setTaxRate] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<{ number: string; total: number } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [p, c] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', ownerId).eq('active', true).order('name'),
      supabase.from('customers').select('*').eq('user_id', ownerId).order('name'),
    ])
    setProducts((p.data as Product[]) || [])
    setCustomers((c.data as Customer[]) || [])
    setLoading(false)
  }

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || 'general'))
    return ['all', ...Array.from(set)]
  }, [products])

  // Handle barcode detection — find the product by SKU/barcode and add to cart
  const handleBarcodeDetect = async (code: string) => {
    setShowScanner(false)
    // Search by SKU first, then by name
    const prod = products.find((p: any) =>
      p.sku === code ||
      p.sku?.includes(code) ||
      p.name?.toLowerCase().includes(code.toLowerCase())
    )
    if (prod) {
      addToCart(prod)
    } else {
      // Not in catalog — show in search so the owner can create it
      setSearch(code)
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === 'all' || p.category === activeCategory
      const matchSearch = !search ||
        p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(debouncedSearch.toLowerCase())
      return matchCat && matchSearch
    })
  }, [products, activeCategory, search])

  const addToCart = (product: Product) => {
    const existing = cart.find((l) => l.product_id === product.id)
    if (existing) {
      if (existing.quantity >= product.stock_quantity) {
        toast.error(`Only ${product.stock_quantity} in stock`)
        return
      }
      setCart(cart.map((l) => l.product_id === product.id ? { ...l, quantity: l.quantity + 1 } : l))
    } else {
      if (product.stock_quantity <= 0) {
        toast.error('Out of stock')
        return
      }
      setCart([...cart, { product_id: product.id, name: product.name, quantity: 1, unit_price: product.price, stock: product.stock_quantity }])
    }
  }

  const changeQty = (productId: string, delta: number) => {
    setCart(cart.flatMap((l) => {
      if (l.product_id !== productId) return [l]
      const next = l.quantity + delta
      if (next <= 0) return []
      if (next > l.stock) {
        toast.error(`Only ${l.stock} in stock`)
        return [l]
      }
      return [{ ...l, quantity: next }]
    }))
  }

  const removeLine = (productId: string) => setCart(cart.filter((l) => l.product_id !== productId))

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unit_price, 0)
  const taxableBase = Math.max(0, subtotal - discount)
  const taxAmount = (taxableBase * taxRate) / 100
  const total = taxableBase + taxAmount

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    setProcessing(true)
    try {
      const receiptNumber = `RCP-${Date.now().toString().slice(-8)}`

      const { data, error, queued } = await offlineInsert('transactions', {
        user_id: ownerId,
        customer_id: selectedCustomer?.id || null,
        receipt_number: receiptNumber,
        items: cart.map(({ product_id, name, quantity, unit_price }) => ({ product_id, name, quantity, unit_price })),
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount,
        total,
        payment_method: paymentMethod,
        status: 'completed',
        served_by: profile?.full_name || null,
      })
      if (error) throw error

      // Online-only side effects (stock decrement, customer stats, activity log)
      if (!queued && navigator.onLine) {
        await Promise.all(cart.map((l) =>
          supabase.rpc('decrement_stock', { p_id: l.product_id, qty: l.quantity }).then(({ error }) => {
            if (error) console.warn('stock decrement failed for', l.product_id, error.message)
          })
        ))
        if (selectedCustomer) {
          await supabase.rpc('recompute_customer_stats', { customer_uuid: selectedCustomer.id })
        }
        await supabase.from('activity_logs').insert({
          user_id: ownerId,
          action_type: 'invoice',
          description: `Sale ${receiptNumber} — ${cart.reduce((s, l) => s + l.quantity, 0)} items, ₹${total.toFixed(2)}`,
          time_saved_minutes: 8,
          money_saved: 4,
        })
      }

      setLastReceipt({ number: receiptNumber, total })
      setCart([])
      setDiscount(0)
      setSelectedCustomer(null)
      if (!queued) await loadData()
      toast.success(queued ? 'Sale saved offline — will sync when reconnected' : 'Sale completed! 💰')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Cashier / POS"
        subtitle="Ring up sales, bill customers, and generate receipts at the counter"
        icon={<ShoppingCart className="w-5 h-5" />}
      />

      {products.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No products yet"
          description="Add products in the Products page first, then ring them up here at the counter."
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Product grid */}
          <div className="lg:col-span-2">
            <div className="card p-4 sticky top-4 z-10 mb-4 bg-surface/80 backdrop-blur">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-11"
                  placeholder="Search by product name or SKU..."
                  onKeyDown={(e) => e.key === 'Enter' && search.trim() && handleBarcodeDetect(search.trim())}
                />
                <button
                  onClick={() => setShowScanner(true)}
                  className="w-11 h-11 rounded-control border border-line bg-surface flex items-center justify-center text-accent hover:bg-accent-soft transition-colors flex-shrink-0"
                  aria-label="Scan barcode"
                >
                  <ScanLine className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all border ${
                      activeCategory === cat ? 'border-brand-600 bg-brand-600/20 text-brand-300' : 'border-line text-fg-muted hover:text-fg'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock_quantity <= 0}
                  className="card p-4 text-left hover:border-brand-600 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-fg text-sm leading-tight">{p.name}</h3>
                    {p.stock_quantity <= p.low_stock_threshold && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">{p.stock_quantity} left</span>
                    )}
                  </div>
                  {p.sku && <p className="text-xs text-fg-subtle mt-0.5">{p.sku}</p>}
                  <p className="text-lg font-bold text-brand-400 mt-2">{formatINR(p.price)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-fg flex items-center gap-2"><Receipt className="w-5 h-5 text-brand-400" /> Current Sale</h2>
                {cart.length > 0 && (
                  <button onClick={() => setConfirmClear(true)} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                )}
              </div>

              {/* Customer */}
              <button
                onClick={() => setShowCustomerPicker(true)}
                className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-surface/60 border border-line hover:border-brand-600 transition-colors text-left mb-4"
              >
                <UserCircle className="w-5 h-5 text-brand-400 flex-shrink-0" />
                {selectedCustomer ? (
                  <div className="min-w-0">
                    <p className="text-sm text-fg truncate">{selectedCustomer.name}</p>
                    <p className="text-xs text-fg-subtle">{selectedCustomer.total_orders} prior orders · {formatINR(selectedCustomer.total_spent, 0)} spent</p>
                  </div>
                ) : (
                  <span className="text-sm text-fg-subtle">Walk-in customer (optional)</span>
                )}
                {selectedCustomer && (
                  <X className="w-4 h-4 text-fg-subtle hover:text-fg ml-auto" onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null) }} />
                )}
              </button>

              {cart.length === 0 ? (
                <p className="text-sm text-fg-subtle text-center py-8">Tap products to add them to the sale</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                    {cart.map((line) => (
                      <div key={line.product_id} className="flex items-center gap-2 bg-surface/60 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-fg truncate">{line.name}</p>
                          <p className="text-xs text-fg-subtle">{formatINR(line.unit_price)} ea</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => changeQty(line.product_id, -1)} className="w-11 h-11 rounded-lg bg-surface-2 hover:bg-surface-3 flex items-center justify-center active:scale-95 transition-transform"><Minus className="w-4 h-4" /></button>
                          <span className="w-6 text-center text-sm text-fg">{line.quantity}</span>
                          <button onClick={() => changeQty(line.product_id, 1)} className="w-11 h-11 rounded-lg bg-surface-2 hover:bg-surface-3 flex items-center justify-center active:scale-95 transition-transform"><Plus className="w-4 h-4" /></button>
                        </div>
                        <span className="text-sm font-semibold text-fg w-16 text-right">{formatINR(line.quantity * line.unit_price)}</span>
                        <button onClick={() => removeLine(line.product_id)} className="text-fg-subtle hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 text-sm border-t border-line pt-3">
                    <div className="flex justify-between text-fg-muted"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
                    <div className="flex justify-between items-center text-fg-muted">
                      <span>Discount</span>
                      <input type="number" min={0} value={discount || ''} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} className="w-20 px-2 py-0.5 bg-surface border border-line rounded text-right text-fg text-sm" placeholder="0" />
                    </div>
                    <div className="flex justify-between items-center text-fg-muted">
                      <span>Tax %</span>
                      <input type="number" min={0} value={taxRate || ''} onChange={(e) => setTaxRate(Math.max(0, Number(e.target.value)))} className="w-20 px-2 py-0.5 bg-surface border border-line rounded text-right text-fg text-sm" placeholder="0" />
                    </div>
                  </div>

                  {/* Payment method */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-3">
                    {(['cash', 'card', 'upi', 'wallet', 'other'] as PaymentMethod[]).map((m) => (
                      <button key={m} onClick={() => setPaymentMethod(m)} className={`py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${paymentMethod === m ? 'bg-brand-600 text-fg' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}>{m}</button>
                    ))}
                  </div>

                  <button onClick={handleCheckout} disabled={processing} className="btn-primary w-full mt-4 py-3 flex items-center justify-center gap-2">
                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue → {formatINR(total)}</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer picker modal */}
      {showCustomerPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCustomerPicker(false)}>
          <div className="card p-4 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-fg mb-3">Select customer</h3>
            <input
              autoFocus
              placeholder="Search customers..."
              className="input-field mb-3"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            <button onClick={() => { setSelectedCustomer(null); setShowCustomerPicker(false) }} className="w-full p-2.5 rounded-lg hover:bg-surface-2 text-left text-sm text-fg-muted mb-1">🚶 Walk-in (no customer)</button>
            {customers
              .filter((c) => {
                if (!customerSearch) return true
                const q = customerSearch.toLowerCase()
                return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)
              })
              .map((c) => (
              <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false) }} className="w-full p-2.5 rounded-lg hover:bg-surface-2 text-left">
                <p className="text-sm text-fg">{c.name}</p>
                <p className="text-xs text-fg-subtle">{c.email || c.phone || 'No contact'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Receipt confirmation */}
      {lastReceipt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setLastReceipt(null)}>
          <div className="card p-5 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-fg mb-1">Sale Complete!</h3>
            <p className="text-sm text-fg-muted mb-4">Receipt {lastReceipt.number}</p>
            <p className="text-3xl font-extrabold text-fg mb-6">{formatINR(lastReceipt.total)}</p>
            <button onClick={() => setLastReceipt(null)} className="btn-primary w-full">New Sale</button>
          </div>
        </div>
      )}
      {/* Barcode scanner overlay */}
      {showScanner && (
        <BarcodeScanner
          onDetect={handleBarcodeDetect}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Clear cart confirmation */}
      <ConfirmDialog
        open={confirmClear}
        title="Clear entire cart?"
        message={`${cart.length} item${cart.length !== 1 ? 's' : ''} will be removed. This cannot be undone.`}
        confirmLabel="Clear cart"
        danger={true}
        onConfirm={() => { setCart([]); setConfirmClear(false) }}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  )
}
