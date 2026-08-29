/**
 * Input validation for Indian retail — GSTIN, UPI ID, phone, email, GST rates.
 * All validators return { valid: boolean; message?: string }.
 */

export interface ValidationResult {
  valid: boolean
  message?: string
}

/** Email: standard RFC-ish check */
export function validateEmail(email: string): ValidationResult {
  if (!email) return { valid: true, message: undefined } // optional fields
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!re.test(email)) return { valid: false, message: 'Enter a valid email (e.g. shop@gmail.com)' }
  return { valid: true }
}

/** Phone: Indian 10-digit (accepts +91 prefix, spaces, dashes) */
export function validatePhone(phone: string): ValidationResult {
  if (!phone) return { valid: true }
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '')
  // Indian mobile: 10 digits starting 6-9, optionally prefixed with 91
  const re = /^(91)?[6-9]\d{9}$/
  if (!re.test(cleaned)) {
    return { valid: false, message: 'Enter a valid Indian mobile (e.g. 9876543210)' }
  }
  return { valid: true }
}

/** GSTIN: 15 chars, state code + PAN + entity + Z + checksum */
export function validateGstin(gstin: string): ValidationResult {
  if (!gstin) return { valid: true }
  const cleaned = gstin.trim().toUpperCase()
  
  // Basic format: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric
  const re = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/
  if (!re.test(cleaned)) {
    return { valid: false, message: 'GSTIN must be 15 characters (e.g. 22AAAAA0000A1Z5)' }
  }
  
  // Checksum validation (mod-36 algorithm)
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const val = chars.indexOf(cleaned[i])
    const product = val * weights[i]
    sum += Math.floor(product / 36) + (product % 36)
  }
  const checkDigit = chars[(36 - (sum % 36)) % 36]
  
  if (cleaned[14] !== checkDigit) {
    return { valid: false, message: 'GSTIN checksum is invalid — double-check the last character' }
  }
  
  return { valid: true }
}

/** UPI ID: word@bank format */
export function validateUpiId(upi: string): ValidationResult {
  if (!upi) return { valid: true }
  const re = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/
  if (!re.test(upi)) {
    return { valid: false, message: 'UPI ID must be name@bank (e.g. shop@paytm)' }
  }
  return { valid: true }
}

/** HSN Code: 2-8 digits */
export function validateHsn(hsn: string): ValidationResult {
  if (!hsn) return { valid: true }
  const re = /^\d{2,8}$/
  if (!re.test(hsn)) {
    return { valid: false, message: 'HSN code must be 2-8 digits (e.g. 3004)' }
  }
  return { valid: true }
}

/** Price: positive number */
export function validatePrice(price: string | number): ValidationResult {
  const num = Number(price)
  if (isNaN(num) || num < 0) {
    return { valid: false, message: 'Price must be a positive number' }
  }
  return { valid: true }
}

/** Quantity: non-negative integer */
export function validateQty(qty: string | number): ValidationResult {
  const num = Number(qty)
  if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
    return { valid: false, message: 'Quantity must be a whole number' }
  }
  return { valid: true }
}

/** Password: min 8 chars, at least one letter + one number */
export function validatePassword(pw: string): ValidationResult {
  if (pw.length < 8) return { valid: false, message: 'Password must be at least 8 characters' }
  if (!/[a-zA-Z]/.test(pw)) return { valid: false, message: 'Password must contain at least one letter' }
  if (!/[0-9]/.test(pw)) return { valid: false, message: 'Password must contain at least one number' }
  return { valid: true }
}

/** PIN code: 6 digits */
export function validatePincode(pin: string): ValidationResult {
  if (!pin) return { valid: true }
  const re = /^[1-9]\d{5}$/
  if (!re.test(pin)) return { valid: false, message: 'PIN code must be 6 digits' }
  return { valid: true }
}
