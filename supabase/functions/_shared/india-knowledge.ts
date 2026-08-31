// ════════════════════════════════════════════════════════════════
// India compliance knowledge — injected into Meraj's system prompt
// so answers about GST, invoicing and business law are accurate.
// Mirrors src/lib/india-compliance.ts (kept in sync manually —
// edge functions deploy standalone and cannot import from src/).
//
// General information, not legal/tax advice. Sources: CGST Act 2017,
// CGST Rules 2017 (Rule 46), DPDP Act 2023 + DPDP Rules 2025.
// ════════════════════════════════════════════════════════════════

export const INDIA_KNOWLEDGE = `
INDIAN TAX & BUSINESS LAW — you are accurate about these:
- GSTIN: 15 characters — 2-digit state code + PAN + entity code + 'Z' + checksum. State codes: 10 Bihar, 20 Jharkhand, 07 Delhi, 27 Maharashtra, 29 Karnataka, 33 Tamil Nadu, 36 Telangana, 19 West Bengal, 24 Gujarat, 09 UP (full list on request).
- GST slabs: 0%, 5%, 12%, 18%, 28% (+ cess on some goods). Intra-state supply → CGST + SGST (each half the rate); inter-state → IGST (full rate), decided by supplier state vs place of supply.
- Registration threshold: ₹40 lakh goods / ₹20 lakh services (halved in special-category states). Composition scheme: up to ₹1.5 crore (₹75 lakh special states) — composition dealers issue a BILL OF SUPPLY and cannot charge GST.
- Tax invoice requirements (Rule 46 CGST Rules): heading "TAX INVOICE", supplier name + address + GSTIN, consecutive invoice number (max 16 characters), date, buyer details (GSTIN for B2B), HSN/SAC per item, description, quantity + unit, taxable value, CGST/SGST or IGST rate and amount separately, total in figures AND words, place of supply for inter-state, reverse charge Yes/No, signature.
- HSN digits by turnover: optional below ₹1.5 crore, 2 digits for ₹1.5–5 crore, 4 digits above ₹5 crore (6 for some B2B).
- Filing: GSTR-1 by the 11th, GSTR-3B + payment by the 20th of next month; QRMP quarterly scheme up to ₹5 crore turnover; GSTR-9 annual return above ₹2 crore; e-invoicing mandatory above ₹5 crore. Late fee + 18% p.a. interest on unpaid tax.
- Income tax: presumptive taxation 44AD for shops (up to ₹2 crore turnover — declare 6% digital / 8% cash receipts as profit); 44ADA for professionals (up to ₹50 lakh).
- Data protection: DPDP Act 2023 + DPDP Rules 2025 — consent-based collection of customer data (phones, addresses), clear notices, breach reporting to the Data Protection Board within 72 hours.

When you use these facts, keep the answer practical for a shop owner, and add that it's general information — a Chartered Accountant should confirm specifics.
`.trim()
