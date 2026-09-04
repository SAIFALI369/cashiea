import { ConfirmDialog } from '../components/ConfirmDialog'
import { useDebounce } from '../lib/useDebounce'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { ScanLine, Coins, History, LayoutGrid, List, Pause, Search, ShoppingCart, Loader2, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { offlineInsert, offlineRpc } from '../lib/mutations'
import { formatINR } from '../lib/format'
import {
  computeSale, effectiveRate, lineKey, topSoldProducts, tenderStatus,
  type CartLine, type ReceiptModel, type TenderLine,
} from '../lib/pos'
import { holdCart, listHeldCarts, deleteHeldCart, type HeldCartSnapshot } from '../lib/heldCarts'
import type { Product, Customer, PaymentMethod, HeldCart } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import toast from 'react-hot-toast'
import { CartContents } from '../components/pos/CartContents'
import { StickyCartBar } from '../components/pos/StickyCartBar'
import { NumpadModal } from '../components/pos/NumpadModal'
import { LineOptionsModal } from '../components/pos/LineOptionsModal'
import { HeldCartsModal } from '../components/pos/HeldCartsModal'
import { ReceiptModal } from '../components/pos/ReceiptModal'
import { RecentSalesModal } from '../components/pos/RecentSalesModal'
import { EodModal } from '../components/pos/EodModal'
import { ProductCard, ProductRow, FrequentTile } from '../components/pos/ProductViews'

export default function POS() {
  const { profile, ownerId, user } = useAuth()
  const { isOwner } = useCan()

  // ── Catalog data ──
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [frequent, setFrequent] = useState<Product[]>([])

  // ── Browsing state ──
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [activeCategory, setActiveCategory] = useState('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  // ── Cart state ──
  const [cart, setCart] = useState<CartLine[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [cartDiscountMode, setCartDiscountMode] = useState<'flat' | 'pct'>('flat')
  const [cartDiscountValue, setCartDiscountValue] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [defaultTaxRate, setDefaultTaxRate] = useState(0)

  // ── Payment state ──
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [splitMode, setSplitMode] = useState(false)
  const [tenders, setTenders] = useState<TenderLine[]>([])
  const [upiRef] = useState(() => `RCP-${Date.now().toString().slice(-8)}`)

  // ── Held carts ──
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([])
  const [heldLoading, setHeldLoading] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [holdDialog, setHoldDialog] = useState(false)
  const [holdLabel, setHoldLabel] = useState('')
  const [resumeSwap, setResumeSwap] = useState<HeldCart | null>(null)

  // ── Modals / UI ──
  const [showScanner, setShowScanner] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' })
  const [showRecent, setShowRecent] = useState(false)
  const [showEod, setShowEod] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [numpadLine, setNumpadLine] = useState<string | null>(null)
  const [lineOptionsKey, setLineOptionsKey] = useState<string | null>(null)
  const [unitPickerProduct, setUnitPickerProduct] = useState<Product | null>(null)
  const [processing, setProcessing] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptModel | null>(null)
  const [receiptPhone, setReceiptPhone] = useState<string | null>(null)

  const frequentLoaded = useRef(false)

  // Load when the profile resolves — NOT on first paint. Opening the app
  // directly on /app/pos (reload, restore, pull-to-refresh) used to fire the
  // query with a null owner before auth finished, leaving POS permanently
  // stuck on the empty state.
  useEffect(() => { if (ownerId) loadData() }, [ownerId])

  // View preference persists per user.
  useEffect(() => {
    if (!ownerId) return
    const saved = localStorage.getItem(`cashiea_pos_view:${ownerId}`)
    if (saved === 'grid' || saved === 'list') setView(saved)
  }, [ownerId])
  useEffect(() => {
    if (ownerId) localStorage.setItem(`cashiea_pos_view:${ownerId}`, view)
  }, [view, ownerId])

  const loadData = async () => {
    setLoading(true)
    const [p, c] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', ownerId).eq('active', true).order('name'),
      supabase.from('customers').select('*').eq('user_id', ownerId).order('name'),
    ])
    setProducts((p.data as Product[]) || [])
    setCustomers((c.data as Customer[]) || [])
    setLoading(false)
    if (!frequentLoaded.current) { frequentLoaded.current = true; loadFrequent((p.data as Product[]) || []) }
  }

  /** Top sellers from the last 30 days — the frequent-items row. */
  const loadFrequent = async (catalog: Product[]) => {
    if (!navigator.onLine || !catalog.length) return
    try {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
      const { data } = await supabase
        .from('transactions')
        .select('items')
        .eq('user_id', ownerId)
        .eq('status', 'completed')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(300)
      const top = topSoldProducts((data as unknown as { items: { product_id: string; name: string; quantity: number }[] }[]) || [], 8)
      const byId = new Map(catalog.map((p) => [p.id, p]))
      setFrequent(top.map((t) => byId.get(t.productId)).filter((p): p is Product => !!p))
    } catch { /* frequent row is best-effort */ }
  }

  const refreshHeld = async () => {
    if (!ownerId) { setHeldCarts([]); setHeldLoading(false); return }
    if (!navigator.onLine) return
    setHeldLoading(true)
    try { setHeldCarts(await listHeldCarts(ownerId)) } catch { /* best-effort */ }
    setHeldLoading(false)
  }

  useEffect(() => { if (ownerId) refreshHeld() }, [ownerId])

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || 'general'))
    return ['all', ...Array.from(set)]
  }, [products])

  // Handle barcode detection — find the product by SKU/barcode and add to cart
  const handleBarcodeDetect = async (code: string) => {
    setShowScanner(false)
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
  }, [products, activeCategory, search, debouncedSearch])

  // ── Cart operations ───────────────────────────────────────────

  /** Max sellable units of a line given remaining base stock. */
  const maxUnits = (line: Pick<CartLine, 'stock' | 'factor'>) =>
    Math.max(0, Math.floor((line.stock || 0) / (line.factor || 1)))

  const addToCart = (product: Product, unit?: { unit: string; price: number; factor: number }) => {
    // Multi-unit products ask which unit to sell in.
    if (!unit && product.units && product.units.length > 1) {
      setUnitPickerProduct(product)
      return
    }
    const u = unit || { unit: '', price: product.price, factor: 1 }
    const key = lineKey(product.id, u.unit)
    const existing = cart.find((l) => l.key === key)
    const gstRate = Number(product.gst_rate ?? 0) || 0
    const cap = Math.floor((product.stock_quantity || 0) / (u.factor || 1))

    if (existing) {
      if (existing.quantity >= cap) {
        toast.error(`Only ${cap} in stock`, { id: 'pos-stock-cap' })
        return
      }
      setCart(cart.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)))
    } else {
      if (cap <= 0) {
        toast.error('Out of stock')
        return
      }
      setCart([...cart, {
        key,
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: u.price,
        stock: product.stock_quantity,
        gst_rate: gstRate,
        gst_source: gstRate > 0 ? 'product' : 'sale',
        price_includes_tax: false,
        unit: u.unit || undefined,
        factor: u.factor || 1,
      }])
    }
  }

  const changeQty = (key: string, delta: number) => {
    setCart(cart.flatMap((l) => {
      if (l.key !== key) return [l]
      const next = l.quantity + delta
      if (next <= 0) return []
      const cap = maxUnits(l)
      if (next > cap) {
        toast.error(`Only ${cap} in stock`, { id: 'pos-stock-cap' })
        return [l]
      }
      return [{ ...l, quantity: next }]
    }))
  }

  const setQty = (key: string, qty: number) => {
    if (qty <= 0) { removeLine(key); return }
    setCart(cart.map((l) => {
      if (l.key !== key) return l
      const cap = maxUnits(l)
      if (qty > cap) {
        toast.error(`Only ${cap} in stock`, { id: 'pos-stock-cap' })
        return { ...l, quantity: cap }
      }
      return { ...l, quantity: qty }
    }))
  }

  const patchLine = (key: string, patch: Partial<CartLine>) =>
    setCart(cart.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const removeLine = (key: string) => setCart(cart.filter((l) => l.key !== key))

  // ── Sale math ─────────────────────────────────────────────────

  /** Pre-tax, pre-cart-discount base subtotal (drives the % discount). */
  const baseSubtotal = useMemo(() => {
    return cart.reduce((s, l) => {
      const r = effectiveRate(l, defaultTaxRate)
      const gross = l.quantity * l.unit_price
      const base = l.price_includes_tax && r > 0 ? gross / (1 + r / 100) : gross
      return s + Math.max(0, base - (l.line_discount || 0))
    }, 0)
  }, [cart, defaultTaxRate])

  const cartDiscount = cartDiscountMode === 'pct'
    ? (baseSubtotal * (cartDiscountValue || 0)) / 100
    : cartDiscountValue || 0

  const sale = useMemo(() => {
    return computeSale(
      cart.map((l) => ({
        key: l.key,
        name: l.name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        gst_rate: effectiveRate(l, defaultTaxRate),
        price_includes_tax: l.price_includes_tax,
        line_discount: l.line_discount,
      })),
      cartDiscount,
    )
  }, [cart, cartDiscount, defaultTaxRate])

  const tender = tenderStatus(sale.total, tenders)
  const hasProductGst = cart.some((l) => l.gst_source === 'product')
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0)
  const checkoutReady = !splitMode || tender.covered
  const checkoutHint = splitMode && !tender.covered
    ? `Add ${formatINR(tender.remaining)} more in tenders to complete the sale`
    : ''

  // ── Checkout ──────────────────────────────────────────────────

  const resetCartState = () => {
    setCart([])
    setDiscountReason('')
    setCartDiscountValue(0)
    setSelectedCustomer(null)
    setSplitMode(false)
    setTenders([])
  }

  const handleCheckout = async () => {
    if (!ownerId) {
      toast.error('Your shop is still loading — please try again in a moment')
      return
    }
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    if (splitMode && !tender.covered) {
      toast.error('Tenders must cover the total before checkout')
      return
    }
    if (cart.length > 200 || cart.some((line) =>
      !Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 1000000 ||
      !Number.isFinite(line.factor) || line.factor <= 0 || line.factor > 1000 ||
      !Number.isFinite(line.unit_price) || line.unit_price < 0 || line.unit_price > 9999999999.99
    )) {
      toast.error('One or more cart lines are invalid — refresh the cart and try again')
      return
    }
    if (!Number.isFinite(sale.subtotal) || !Number.isFinite(sale.taxTotal) || !Number.isFinite(sale.total) ||
      sale.subtotal < 0 || sale.taxTotal < 0 || sale.total < 0 || sale.total > 9999999999.99) {
      toast.error('This sale is outside the supported amount range')
      return
    }
    setProcessing(true)
    try {
      const receiptNumber = `RCP-${Date.now().toString().slice(-8)}`
      // ₹0 tenders are never written (sale_payments.amount must be > 0) —
      // a fully-discounted sale simply records no tender rows.
      const netTenders = (splitMode ? tender.netTenders : [{ method: paymentMethod as PaymentMethod, amount: sale.total }])
        .filter((t) => t.amount > 0.005)
      const txnId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const saleItems = cart.map((l) => ({
        product_id: l.product_id,
        name: l.name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        unit: l.unit || null,
        factor: l.factor || 1,
        gst_rate: effectiveRate(l, defaultTaxRate),
        gst_source: l.gst_source,
        price_includes_tax: l.price_includes_tax,
        line_discount: l.line_discount || 0,
        line_discount_note: l.line_discount_note || null,
      }))

      // Checkout is one idempotent server transaction. It validates the
      // business membership, prices, tenders and stock, then writes the sale,
      // payment lines, stock decrements, customer stats and audit event
      // atomically. If the connection drops after commit, replaying this same
      // transaction id returns the existing sale instead of double-selling.
      const { error, queued } = await offlineRpc('complete_sale', {
        p_transaction_id: txnId,
        p_user_id: ownerId,
        p_customer_id: selectedCustomer?.id || null,
        p_receipt_number: receiptNumber,
        p_items: saleItems,
        p_subtotal: sale.subtotal,
        p_tax_rate: sale.effectiveTaxRate,
        p_tax_amount: sale.taxTotal,
        p_discount: sale.discountTotal,
        p_discount_reason: discountReason.trim() || null,
        p_total: sale.total,
        p_default_tax_rate: defaultTaxRate,
        p_payment_method: netTenders.length > 1 ? 'split' : netTenders[0]?.method || paymentMethod,
        p_payments: netTenders.map((t) => ({ method: t.method, amount: t.amount, reference: null })),
        p_served_by: profile?.full_name || null,
      }, { id: txnId, receipt_number: receiptNumber } as any)
      if (error) throw error

      // Digital receipt. The server remains the source of truth; this local
      // model is only the immediate print/share view while offline too.
      setReceipt({
        shopName: profile?.company_name || profile?.full_name || 'My Business',
        address: profile?.business_address,
        phone: profile?.phone || profile?.whatsapp_number,
        gstin: profile?.gstin,
        upiId: profile?.upi_id,
        receiptNumber,
        date: new Date().toISOString(),
        customerName: selectedCustomer?.name,
        lines: cart.map((l) => {
          const r = sale.lines.find((x) => x.key === l.key)
          return {
            name: l.name,
            quantity: l.quantity,
            unit_price: l.unit_price,
            unit: l.unit,
            amount: r ? r.total : l.quantity * l.unit_price,
          }
        }),
        subtotal: sale.subtotal,
        discountTotal: sale.discountTotal,
        taxTotal: sale.taxTotal,
        total: sale.total,
        tenders: netTenders.map((t) => ({ method: t.method as string, amount: t.amount })),
        change: splitMode ? tender.change : 0,
        servedBy: profile?.full_name || null,
      })
      setReceiptPhone(selectedCustomer?.phone || null)

      resetCartState()
      setSheetOpen(false)
      if (!queued) await loadData()
      toast.success(queued ? 'Sale saved offline — will sync when reconnected' : 'Sale completed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setProcessing(false)
    }
  }

  // ── Hold / resume ─────────────────────────────────────────────

  const currentSnapshot = (): HeldCartSnapshot => ({
    lines: cart as unknown as Record<string, unknown>[],
    customer: selectedCustomer ? { id: selectedCustomer.id, name: selectedCustomer.name } : null,
    note: discountReason || '',
    cartDiscount: cartDiscountValue,
    discountReason,
    defaultTaxRate,
  })

  const doHold = async (label: string) => {
    if (!ownerId) { toast.error('Your shop is still loading — please try again'); return }
    if (cart.length === 0) return
    try {
      const { queued, row } = await holdCart(ownerId, label, currentSnapshot(), sale.total, user?.id || profile?.id || ownerId)
      setHoldDialog(false)
      setHoldLabel('')
      resetCartState()
      setSheetOpen(false)
      if (queued) setHeldCarts((prev) => [row, ...prev]) // visible immediately, even offline
      else refreshHeld()
      toast.success(queued ? 'Cart held — it will sync when reconnected' : 'Cart held — start the next sale')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not hold the cart')
    }
  }

  const doResume = async (h: HeldCart) => {
    const snap = h.cart as unknown as HeldCartSnapshot
    const lines = ((snap.lines || []) as unknown as CartLine[])
    // Re-validate stock against the live catalog.
    const byId = new Map(products.map((p) => [p.id, p]))
    let clamped = 0
    const restored = lines.map((l) => {
      const p = byId.get(l.product_id)
      const stock = p ? p.stock_quantity : l.stock
      const cap = Math.max(0, Math.floor(stock / (l.factor || 1)))
      if (l.quantity > cap) { clamped++; return { ...l, stock, quantity: cap } }
      return { ...l, stock }
    }).filter((l) => l.quantity > 0)

    setCart(restored)
    setSelectedCustomer(snap.customer ? customers.find((c) => c.id === snap.customer!.id) || null : null)
    setCartDiscountValue(snap.cartDiscount || 0)
    setDiscountReason(snap.discountReason || '')
    setDefaultTaxRate(snap.defaultTaxRate || 0)

    setShowHeld(false)
    setResumeSwap(null)
    if (isOwner || h.created_by === user?.id) {
      try {
        await deleteHeldCart(h.id, ownerId!)
      } catch {
        toast('Held cart kept — connect to the internet to clear it')
      }
    }
    refreshHeld()
    if (clamped > 0) toast(`${clamped} line${clamped !== 1 ? 's' : ''} reduced to current stock`)
    toast.success('Cart restored')
  }

  const onResumeClick = (h: HeldCart) => {
    if (cart.length > 0) setResumeSwap(h)
    else doResume(h)
  }

  const onDeleteHeld = async (h: HeldCart) => {
    if (!ownerId || (!isOwner && h.created_by !== user?.id)) {
      toast.error('Only the owner or the cashier who parked this cart can delete it')
      return
    }
    try {
      await deleteHeldCart(h.id, ownerId)
      refreshHeld()
    } catch {
      toast.error('Connect to the internet to delete a held cart')
    }
  }

  // ── Inline new customer ───────────────────────────────────────

  const addNewCustomer = async () => {
    if (!ownerId) { toast.error('Your shop is still loading — please try again'); return }
    if (!newCustomer.name.trim()) {
      toast.error('Name is required')
      return
    }
    try {
      const { data, error } = await offlineInsert('customers', {
        user_id: ownerId,
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || null,
      })
      if (error || !data) throw error || new Error('Could not save the customer')
      const c = data as Customer
      setSelectedCustomer(c)
      setShowCustomerPicker(false)
      setShowNewCustomer(false)
      setNewCustomer({ name: '', phone: '' })
      setCustomers((prev) => [...prev, c])
      toast.success(`${c.name} added`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add the customer')
    }
  }

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  const cartProps = {
    cart, sale, selectedCustomer,
    onPickCustomer: () => setShowCustomerPicker(true),
    onClearCustomer: () => setSelectedCustomer(null),
    onChangeQty: changeQty,
    onOpenLineOptions: setLineOptionsKey,
    onNumpad: setNumpadLine,
    onHold: () => setHoldDialog(true),
    onClearCart: () => setConfirmClear(true),
    onCheckout: handleCheckout,
    processing,
    checkoutReady,
    checkoutHint,
    paymentMethod, setPaymentMethod,
    splitMode, setSplitMode,
    tenders, setTenders,
    cartDiscountMode, setCartDiscountMode,
    cartDiscountValue, setCartDiscountValue,
    discountReason, setDiscountReason,
    defaultTaxRate, setDefaultTaxRate,
    upiId: profile?.upi_id || null,
    payeeName: profile?.company_name || profile?.full_name || 'My Business',
    receiptRef: upiRef,
    hasProductGst,
  }

  const numpadTarget = numpadLine ? cart.find((l) => l.key === numpadLine) : null
  const lineOptionsTarget = lineOptionsKey ? cart.find((l) => l.key === lineOptionsKey) : null

  return (
    <div className="animate-fade-in pb-24 lg:pb-0">
      <PageHeader
        title="Cashier / POS"
        subtitle="Ring up sales, bill customers, and generate receipts at the counter"
        icon={<ShoppingCart className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => { refreshHeld(); setShowHeld(true) }}
              className="relative w-11 h-11 rounded-control border border-line bg-surface flex items-center justify-center text-accent hover:bg-accent-soft transition-colors"
              aria-label={`Held carts${heldCarts.length ? ` (${heldCarts.length})` : ''}`}
              title="Held carts"
            >
              <Pause className="w-5 h-5" />
              {heldCarts.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-accent text-accent-fg text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {heldCarts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowRecent(true)}
              className="w-11 h-11 rounded-control border border-line bg-surface flex items-center justify-center text-accent hover:bg-accent-soft transition-colors"
              aria-label="Recent sales and void"
              title="Recent sales"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowEod(true)}
              className="w-11 h-11 rounded-control border border-line bg-surface flex items-center justify-center text-accent hover:bg-accent-soft transition-colors"
              aria-label="Close the day — cash reconciliation"
              title="Close the day"
            >
              <Coins className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowScanner(true)}
              className="w-11 h-11 rounded-control border border-line bg-surface flex items-center justify-center text-accent hover:bg-accent-soft transition-colors"
              aria-label="Scan barcode"
              title="Scan barcode"
            >
              <ScanLine className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No products yet"
          description="Add products in the Products page first, then ring them up here at the counter."
        />
      ) : (
        <>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Product grid — min-w-0 lets the grid item shrink below its
                content, so horizontally-scrollable rows (category chips,
                frequent tiles) scroll inside the card instead of blowing
                the page out to desktop width on phones. */}
            <div className="lg:col-span-2 min-w-0">
              {/* Frequent items — fastest path to a repeat sale */}
              {frequent.length >= 3 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wide mb-2 px-0.5">Frequent</p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-1">
                    {frequent.map((p) => (
                      <div key={p.id} className="snap-start"><FrequentTile product={p} onAdd={addToCart} /></div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card p-4 sticky top-4 z-10 mb-4 bg-surface/80 backdrop-blur">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="input-field pl-11"
                      placeholder="Search by product name or SKU..."
                      onKeyDown={(e) => e.key === 'Enter' && search.trim() && handleBarcodeDetect(search.trim())}
                    />
                  </div>
                  {/* Grid / list toggle — persists per user */}
                  <div className="flex items-center rounded-xl border border-line overflow-hidden flex-shrink-0" role="group" aria-label="Product view">
                    <button
                      onClick={() => setView('grid')}
                      className={`w-10 h-10 flex items-center justify-center ${view === 'grid' ? 'bg-accent text-accent-fg' : 'text-fg-subtle hover:text-fg'}`}
                      aria-label="Grid view"
                      aria-pressed={view === 'grid'}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setView('list')}
                      className={`w-10 h-10 flex items-center justify-center ${view === 'list' ? 'bg-accent text-accent-fg' : 'text-fg-subtle hover:text-fg'}`}
                      aria-label="List view"
                      aria-pressed={view === 'list'}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Category chips — single row, horizontal scroll, never wraps */}
                <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar scroll-smooth snap-x">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all border whitespace-nowrap flex-shrink-0 snap-start ${
                        activeCategory === cat
                          ? 'bg-accent text-accent-fg border-accent'
                          : 'border-line text-fg-muted hover:text-fg'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {view === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredProducts.map((p) => (
                    <ProductCard key={p.id} product={p} onAdd={addToCart} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map((p) => (
                    <ProductRow key={p.id} product={p} onAdd={addToCart} />
                  ))}
                </div>
              )}

              {filteredProducts.length === 0 && (
                <p className="text-sm text-fg-subtle text-center py-12">No products match this search</p>
              )}
            </div>

            {/* Cart — desktop column */}
            <div className="lg:col-span-1 hidden lg:block min-w-0">
              <div className="card sticky top-4 overflow-hidden">
                <CartContents variant="desktop" {...cartProps} />
              </div>
            </div>
          </div>

          {/* Collapsed cart pinned above the mobile bottom nav */}
          <StickyCartBar itemCount={itemCount} sale={sale} onExpand={() => setSheetOpen(true)} />
        </>
      )}

      {/* Mobile full cart / checkout sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 lg:hidden flex items-end" onClick={() => setSheetOpen(false)} role="dialog" aria-label="Cart and checkout">
          <div
            className="card w-full rounded-b-none rounded-t-card max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-2 flex justify-center flex-shrink-0">
              <button onClick={() => setSheetOpen(false)} aria-label="Close cart" className="py-3 px-10 flex justify-center">
                <span className="w-12 h-1.5 rounded-full bg-line-2" />
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <CartContents variant="sheet" {...cartProps} />
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
            <button onClick={() => { setSelectedCustomer(null); setShowCustomerPicker(false) }} className="w-full p-2.5 rounded-lg hover:bg-surface-2 text-left text-sm text-fg-muted mb-1">Walk-in (no customer)</button>
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

            {/* Inline add-new — feeds the CRM */}
            <div className="border-t border-line mt-3 pt-3">
              {!showNewCustomer ? (
                <button onClick={() => setShowNewCustomer(true)} className="w-full p-2.5 rounded-lg hover:bg-surface-2 text-left text-sm font-semibold text-accent flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> New customer
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    autoFocus
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="input-field"
                    placeholder="Name (required)"
                    aria-label="New customer name"
                  />
                  <input
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="input-field"
                    placeholder="Phone (optional)"
                    inputMode="tel"
                    aria-label="New customer phone"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowNewCustomer(false)} className="btn-ghost flex-1 py-2 text-sm">Cancel</button>
                    <button onClick={addNewCustomer} className="btn-primary flex-1 py-2 text-sm">Add</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hold cart — optional label */}
      {holdDialog && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={() => setHoldDialog(false)} role="dialog" aria-label="Hold cart">
          <div className="card p-4 w-full sm:max-w-sm rounded-b-none sm:rounded-card" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <h3 className="font-bold text-fg mb-1">Hold this sale</h3>
            <p className="text-xs text-fg-subtle mb-3">The cart is saved exactly as it is. Start a new sale and resume this one from the Held button any time.</p>
            <input
              autoFocus
              value={holdLabel}
              onChange={(e) => setHoldLabel(e.target.value)}
              className="input-field mb-3"
              placeholder="Label (customer name or note, optional)"
              aria-label="Held cart label"
            />
            <div className="flex gap-2">
              <button onClick={() => setHoldDialog(false)} className="btn-ghost flex-1 py-3">Cancel</button>
              <button onClick={() => doHold(holdLabel)} className="btn-primary flex-1 py-3">Hold cart</button>
            </div>
          </div>
        </div>
      )}

      {/* Resume a held cart while the current cart has items */}
      <ConfirmDialog
        open={!!resumeSwap}
        title="Resume held cart?"
        message="The current cart will be held automatically, then the selected sale is restored."
        confirmLabel="Resume"
        danger={false}
        onConfirm={async () => {
          if (!resumeSwap) return
          await doHold('Auto-held while resuming')
          await doResume(resumeSwap)
        }}
        onClose={() => setResumeSwap(null)}
      />

      {/* Unit picker — products priced per piece / kg / dozen */}
      {unitPickerProduct && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={() => setUnitPickerProduct(null)} role="dialog" aria-label={`Choose a unit for ${unitPickerProduct.name}`}>
          <div className="card p-4 w-full sm:max-w-sm rounded-b-none sm:rounded-card" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <h3 className="font-bold text-fg mb-1 truncate">{unitPickerProduct.name}</h3>
            <p className="text-xs text-fg-subtle mb-3">Sold in multiple units — pick one.</p>
            <div className="space-y-2">
              {(unitPickerProduct.units && unitPickerProduct.units.length
                ? unitPickerProduct.units
                : [{ unit: 'piece', price: unitPickerProduct.price, factor: 1 }]
              ).map((u) => (
                <button
                  key={u.unit}
                  onClick={() => { addToCart(unitPickerProduct, u); setUnitPickerProduct(null) }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-line hover:border-accent text-left"
                >
                  <span className="font-semibold text-fg capitalize">{u.unit}</span>
                  <span className="font-bold text-accent-strong tabular-nums">{formatINR(u.price)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Held carts list */}
      <HeldCartsModal
        open={showHeld}
        heldCarts={heldCarts}
        loading={heldLoading}
        onResume={onResumeClick}
        onDelete={onDeleteHeld}
        canDelete={(h) => isOwner || h.created_by === user?.id}
        onClose={() => setShowHeld(false)}
      />

      {/* Recent sales + void */}
      <RecentSalesModal
        open={showRecent}
        ownerId={ownerId!}
        profile={profile}
        canVoid={isOwner}
        onVoided={() => loadData()}
        onClose={() => setShowRecent(false)}
      />

      {/* End-of-day cash reconciliation */}
      <EodModal open={showEod} ownerId={ownerId!} canSave={isOwner} onClose={() => setShowEod(false)} />

      {/* Quantity numpad */}
      <NumpadModal
        open={!!numpadLine}
        title={`Quantity — ${numpadTarget?.name || ''}${numpadTarget?.unit ? ` (${numpadTarget.unit})` : ''}`}
        initialValue={numpadTarget?.quantity ?? 1}
        max={numpadTarget ? maxUnits(numpadTarget) : undefined}
        onDone={(n) => { if (numpadLine) setQty(numpadLine, n); setNumpadLine(null) }}
        onClose={() => setNumpadLine(null)}
      />

      {/* Per-line options */}
      {lineOptionsTarget && (
        <LineOptionsModal
          line={lineOptionsTarget}
          unitPrice={lineOptionsTarget.unit_price}
          onPatch={patchLine}
          onRemove={removeLine}
          onNumpad={() => { setNumpadLine(lineOptionsTarget.key); setLineOptionsKey(null) }}
          onClose={() => setLineOptionsKey(null)}
        />
      )}

      {/* Receipt confirmation */}
      {receipt && (
        <ReceiptModal
          receipt={receipt}
          profile={profile}
          phone={receiptPhone}
          onClose={() => setReceipt(null)}
        />
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
        onConfirm={() => { resetCartState(); setConfirmClear(false) }}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  )
}
