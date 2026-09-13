import { describe, it, expect } from 'vitest'
import {
  buildTallyXml,
  buildTallyMastersXml,
  buildTallyVouchersXml,
  buildSalesVoucherMessage,
  buildReceiptVoucherMessage,
  buildPaymentVoucherMessage,
  buildPartyLedgerMessage,
  buildStockItemMessage,
  bucketTaxByRate,
  tallyDate,
  tallyName,
  xmlEscape,
  TALLY_LEDGERS,
  type TallySale,
  type TallyExportInput,
} from './tally'

const sale = (over: Partial<TallySale> = {}): TallySale => ({
  number: 'INV-001',
  date: '2026-09-13T10:30:00+05:30',
  party: 'Ramesh Stores',
  partyGstin: null,
  items: [
    { name: 'Notebook 200pg', quantity: 50, unitPrice: 25, gstRate: 12, hsn: '4820', unit: 'Nos' },
    { name: 'Pen Blue', quantity: 10, unitPrice: 10, gstRate: 12, hsn: '9609' },
  ],
  subtotal: 1350,
  taxAmount: 162,
  total: 1512,
  notes: 'Thank you',
  ...over,
})

const baseInput = (over: Partial<TallyExportInput> = {}): TallyExportInput => ({
  sales: [sale()],
  receipts: [{ number: 'RCP-1', date: '2026-09-13T00:00:00Z', party: 'Ramesh Stores', amount: 500, method: 'upi', against: 'INV-001' }],
  payments: [{ number: 'EXP-1', date: '2026-09-13T00:00:00Z', party: 'Electricity', amount: 1200, narration: 'September electricity bill' }],
  parties: [],
  stockItems: [],
  ...over,
})

describe('xmlEscape', () => {
  it('escapes the five XML entities', () => {
    expect(xmlEscape('a<b>&"c"\'d\'')).toBe('a&lt;b&gt;&amp;&quot;c&quot;&apos;d&apos;')
  })
  it('passes plain text through', () => {
    expect(xmlEscape('Notebook 200pg')).toBe('Notebook 200pg')
  })
  it('tolerates null/undefined', () => {
    expect(xmlEscape(null as unknown as string)).toBe('')
  })
})

describe('tallyDate', () => {
  it('formats ISO dates as YYYYMMDD', () => {
    expect(tallyDate('2026-09-13T10:30:00+05:30')).toBe('20260913')
    expect(tallyDate('2026-01-01')).toBe('20260101')
  })
  it('returns an epoch-safe value for garbage', () => {
    expect(tallyDate('not a date')).toBe('19700101')
  })
})

describe('tallyName', () => {
  it('trims and caps length', () => {
    expect(tallyName('  Ramesh  ')).toBe('Ramesh')
    expect(tallyName('x'.repeat(150)).length).toBe(99)
  })
  it('never returns an empty name', () => {
    expect(tallyName('   ')).toBe('Unnamed')
  })
})

describe('bucketTaxByRate', () => {
  it('groups lines by rate and computes tax', () => {
    const buckets = bucketTaxByRate([
      { name: 'A', quantity: 2, unitPrice: 100, gstRate: 18 },
      { name: 'B', quantity: 1, unitPrice: 50, gstRate: 5 },
      { name: 'C', quantity: 1, unitPrice: 100, gstRate: 18 },
    ])
    expect(buckets).toEqual([
      { rate: 5, taxable: 50, tax: 2.5 },
      { rate: 18, taxable: 300, tax: 54 },
    ])
  })
  it('subtracts line discounts from taxable value', () => {
    const buckets = bucketTaxByRate([
      { name: 'A', quantity: 4, unitPrice: 100, gstRate: 18, lineDiscount: 100 },
    ])
    expect(buckets[0].taxable).toBe(300)
    expect(buckets[0].tax).toBe(54)
  })
  it('ignores negative quantities and prices', () => {
    const buckets = bucketTaxByRate([
      { name: 'A', quantity: -5, unitPrice: 100, gstRate: 18 },
      { name: 'B', quantity: 2, unitPrice: -3, gstRate: 18 },
    ])
    expect(buckets).toEqual([])
  })
})

describe('buildSalesVoucherMessage', () => {
  it('emits an invoice-mode Sales voucher', () => {
    const x = buildSalesVoucherMessage(sale())
    expect(x).toContain('<VOUCHER VCHTYPE="Sales"')
    expect(x).toContain('<ISINVOICE>Yes</ISINVOICE>')
    expect(x).toContain('<VCHENTRYMODE>Item Invoice</VCHENTRYMODE>')
    expect(x).toContain('<VOUCHERNUMBER>INV-001</VOUCHERNUMBER>')
    expect(x).toContain('<PARTYLEDGERNAME>Ramesh Stores</PARTYLEDGERNAME>')
  })

  it('splits intra-state tax into CGST + SGST at half each', () => {
    const x = buildSalesVoucherMessage(sale())
    // 1350 taxable @12% = 162 tax → 81 + 81
    expect(x).toContain(`<LEDGERNAME>${TALLY_LEDGERS.cgst}</LEDGERNAME>`)
    expect(x.match(new RegExp(`<AMOUNT>-81\\.00</AMOUNT>`, 'g'))?.length).toBe(2)
    expect(x).not.toContain(`<LEDGERNAME>${TALLY_LEDGERS.igst}</LEDGERNAME>`)
  })

  it('uses IGST alone for inter-state sales', () => {
    const x = buildSalesVoucherMessage(sale({ interstate: true }))
    expect(x).toContain(`<LEDGERNAME>${TALLY_LEDGERS.igst}</LEDGERNAME>`)
    expect(x).not.toContain(`<LEDGERNAME>${TALLY_LEDGERS.cgst}</LEDGERNAME>`)
    expect(x).toContain('<AMOUNT>-162.00</AMOUNT>')
  })

  it('writes the party debit for the exact recorded total', () => {
    const x = buildSalesVoucherMessage(sale())
    expect(x).toContain('<AMOUNT>1512.00</AMOUNT>')
  })

  it('balances with a Round Off line when totals drift', () => {
    const x = buildSalesVoucherMessage(sale({ total: 1512.4 }))
    expect(x).toContain(`<LEDGERNAME>${TALLY_LEDGERS.roundOff}</LEDGERNAME>`)
    expect(x).toContain('<AMOUNT>0.40</AMOUNT>')
  })

  it('omits the Round Off line when the voucher already balances', () => {
    const x = buildSalesVoucherMessage(sale())
    expect(x).not.toContain(`<LEDGERNAME>${TALLY_LEDGERS.roundOff}</LEDGERNAME>`)
  })

  it('credits each inventory line with rate and unit', () => {
    const x = buildSalesVoucherMessage(sale())
    expect(x).toContain('<STOCKITEMNAME>Notebook 200pg</STOCKITEMNAME>')
    expect(x).toContain('<RATE>25.00/Nos</RATE>')
    expect(x).toContain('<AMOUNT>-1250.00</AMOUNT>')
    expect(x).toContain('<AMOUNT>-100.00</AMOUNT>')
  })

  it('defaults missing units to Nos', () => {
    const x = buildSalesVoucherMessage(sale())
    expect(x).toContain('<RATE>10.00/Nos</RATE>')
  })

  it('includes the buyer GSTIN on B2B sales', () => {
    const x = buildSalesVoucherMessage(sale({ partyGstin: '27AAAPL1234C1ZV' }))
    expect(x).toContain('<PARTYGSTIN>27AAAPL1234C1ZV</PARTYGSTIN>')
  })

  it('XML-escapes hostile names', () => {
    const x = buildSalesVoucherMessage(sale({
      party: 'A <shop> & "sons"',
      items: [{ name: 'Milk 1L <fresh>', quantity: 2, unitPrice: 60, gstRate: 0 }],
    }))
    expect(x).toContain('A &lt;shop&gt; &amp; &quot;sons&quot;')
    expect(x).toContain('Milk 1L &lt;fresh&gt;')
    expect(x).not.toMatch(/<shop>/)
  })

  it('keeps every amount a fixed 2-decimal string (no exponent)', () => {
    const x = buildSalesVoucherMessage(sale({
      items: [{ name: 'Gold chain', quantity: 1, unitPrice: 9999999999.99, gstRate: 3 }],
      total: 9999999999.99,
      subtotal: 9999999999.99,
      taxAmount: 0,
    }))
    expect(x).not.toMatch(/e[+-]\d/i)
    expect(x).toContain('<AMOUNT>-9999999999.99</AMOUNT>')
  })
})

describe('buildReceiptVoucherMessage', () => {
  it('debits Bank for UPI and credits the party', () => {
    const x = buildReceiptVoucherMessage({ number: 'RCP-1', date: '2026-09-13', party: 'Ramesh Stores', amount: 500, method: 'upi', against: 'INV-001' })
    expect(x).toContain('<VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>')
    expect(x).toContain('<LEDGERNAME>Bank Account</LEDGERNAME>')
    expect(x).toContain('<AMOUNT>500.00</AMOUNT>')
    expect(x).toContain('<LEDGERNAME>Ramesh Stores</LEDGERNAME>')
    expect(x).toContain('<AMOUNT>-500.00</AMOUNT>')
    expect(x).toContain('against INV-001')
  })
  it('debits Cash for cash receipts', () => {
    const x = buildReceiptVoucherMessage({ number: 'RCP-2', date: '2026-09-13', party: 'Sita', amount: 100, method: 'cash' })
    expect(x).toContain(`<LEDGERNAME>${TALLY_LEDGERS.cash}</LEDGERNAME>`)
  })
  it('balances: every debit has an equal credit', () => {
    const x = buildReceiptVoucherMessage({ number: 'RCP-3', date: '2026-09-13', party: 'Sita', amount: 77.77, method: 'card' })
    const amounts = [...x.matchAll(/<AMOUNT>(-?[\d.]+)<\/AMOUNT>/g)].map((m) => Number(m[1]))
    expect(amounts.length).toBe(2)
    expect(amounts.reduce((s, a) => s + a, 0)).toBe(0)
  })
})

describe('buildPaymentVoucherMessage', () => {
  it('debits the payee and credits cash', () => {
    const x = buildPaymentVoucherMessage({ number: 'EXP-1', date: '2026-09-13', party: 'Electricity', amount: 1200, narration: 'September bill' })
    expect(x).toContain('<VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>')
    expect(x).toContain('<LEDGERNAME>Electricity</LEDGERNAME>')
    expect(x).toContain('<AMOUNT>1200.00</AMOUNT>')
    expect(x).toContain('<AMOUNT>-1200.00</AMOUNT>')
    expect(x).toContain('September bill')
  })
})

describe('buildPartyLedgerMessage', () => {
  it('parents customers under Sundry Debtors with GSTIN', () => {
    const x = buildPartyLedgerMessage({ name: 'Ramesh Stores', gstin: '27AAAPL1234C1ZV', kind: 'customer', phone: '9876543210' })
    expect(x).toContain('<LEDGER NAME="Ramesh Stores"')
    expect(x).toContain('<PARENT>Sundry Debtors</PARENT>')
    expect(x).toContain('<PARTYGSTIN>27AAAPL1234C1ZV</PARTYGSTIN>')
    expect(x).toContain('<LEDGERPHONE>9876543210</LEDGERPHONE>')
  })
  it('parents suppliers under Sundry Creditors and skips GSTIN when absent', () => {
    const x = buildPartyLedgerMessage({ name: 'Wholesale Mart', kind: 'supplier' })
    expect(x).toContain('<PARENT>Sundry Creditors</PARENT>')
    expect(x).not.toContain('PARTYGSTIN')
  })
})

describe('buildStockItemMessage', () => {
  it('carries HSN and GST rate', () => {
    const x = buildStockItemMessage({ name: 'Notebook 200pg', hsn: '4820', gstRate: 12, unit: 'Nos' })
    expect(x).toContain('<STOCKITEM NAME="Notebook 200pg"')
    expect(x).toContain('<HSNCODE>4820</HSNCODE>')
    expect(x).toContain('<GSTPERCENT>12.00</GSTPERCENT>')
    expect(x).toContain('<BASEUNITS>Nos</BASEUNITS>')
  })
  it('omits the GST block when there is no HSN', () => {
    const x = buildStockItemMessage({ name: 'Loose item', gstRate: 0 })
    expect(x).not.toContain('GSTDETAILS')
  })
})

describe('buildTallyXml', () => {
  it('wraps everything in one Import Data envelope, masters before vouchers', () => {
    const { xml } = buildTallyXml(baseInput())
    expect(xml.startsWith('<ENVELOPE>')).toBe(true)
    expect(xml.trim().endsWith('</ENVELOPE>')).toBe(true)
    expect(xml).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>')
    const mastersAt = xml.indexOf('<LEDGER NAME="Ramesh Stores"')
    const voucherAt = xml.indexOf('<VOUCHER VCHTYPE="Sales"')
    expect(mastersAt).toBeGreaterThan(-1)
    expect(voucherAt).toBeGreaterThan(mastersAt)
  })

  it('auto-creates party + stock masters referenced only by vouchers', () => {
    const { xml } = buildTallyXml(baseInput())
    expect(xml).toContain('<LEDGER NAME="Ramesh Stores"')
    expect(xml).toContain('<STOCKITEM NAME="Notebook 200pg"')
    expect(xml).toContain('<STOCKITEM NAME="Pen Blue"')
  })

  it('never emits a Cash party master for walk-in sales', () => {
    const { xml } = buildTallyXml(baseInput({
      sales: [sale({ party: 'Cash' })],
      receipts: [{ number: 'RCP-9', date: '2026-09-13', party: 'Cash', amount: 10, method: 'cash' }],
    }))
    expect(xml).not.toContain('<LEDGER NAME="Cash"')
  })

  it('exports the standard duty ledgers', () => {
    const { xml } = buildTallyXml(baseInput())
    expect(xml).toContain(`NAME="${TALLY_LEDGERS.cgst}"`)
    expect(xml).toContain(`NAME="${TALLY_LEDGERS.sgst}"`)
    expect(xml).toContain(`NAME="${TALLY_LEDGERS.igst}"`)
    expect(xml).toContain(`NAME="${TALLY_LEDGERS.roundOff}"`)
  })

  it('escapes & in the Duties & Taxes parent', () => {
    const { xml } = buildTallyXml(baseInput())
    expect(xml).toContain('<PARENT>Duties &amp; Taxes</PARENT>')
    expect(xml).not.toContain('<PARENT>Duties & Taxes</PARENT>')
  })

  it('includes the company name when given', () => {
    const { xml } = buildTallyXml(baseInput({ company: 'Ramesh Stores Pvt Ltd' }))
    expect(xml).toContain('<SVCURRENTCOMPANY>Ramesh Stores Pvt Ltd</SVCURRENTCOMPANY>')
  })
  it('omits the company tag when not given', () => {
    const { xml } = buildTallyXml(baseInput())
    expect(xml).not.toContain('SVCURRENTCOMPANY')
  })

  it('reports accurate stats', () => {
    const { stats } = buildTallyXml(baseInput())
    expect(stats.salesVouchers).toBe(1)
    expect(stats.receiptVouchers).toBe(1)
    expect(stats.paymentVouchers).toBe(1)
    expect(stats.salesTotal).toBe(1512)
    expect(stats.receiptsTotal).toBe(500)
    expect(stats.paymentsTotal).toBe(1200)
    expect(stats.stockItems).toBe(2) // Notebook + Pen from the sale lines
  })

  it('handles an empty export without breaking', () => {
    const { xml, stats } = buildTallyXml({ sales: [], receipts: [], payments: [] })
    expect(xml).toContain('<ENVELOPE>')
    expect(stats.salesVouchers).toBe(0)
    expect(stats.ledgers).toBe(7) // 5 standard + Sales + Bank
  })

  it('is well-formed enough that every open tag has a closing partner', () => {
    const { xml } = buildTallyXml(baseInput())
    const opens = (xml.match(/<[A-Z][A-Z0-9.]*[ >]/g) || []).length
    const selfClosed = (xml.match(/\/>/g) || []).length
    const closes = (xml.match(/<\/[A-Z][A-Z0-9.]*>/g) || []).length
    expect(opens - selfClosed).toBe(closes)
  })
})

describe('separate files', () => {
  it('masters file contains no vouchers and vice versa', () => {
    const input = baseInput()
    const masters = buildTallyMastersXml(input)
    const vouchers = buildTallyVouchersXml(input)
    expect(masters).toContain('<REPORTNAME>All Masters</REPORTNAME>')
    expect(masters).not.toContain('<VOUCHER ')
    expect(vouchers).toContain('<REPORTNAME>Vouchers</REPORTNAME>')
    expect(vouchers).not.toContain('<LEDGER NAME=')
  })
})
