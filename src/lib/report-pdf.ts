// ════════════════════════════════════════════════════════════════
// Report PDF — a drafted briefing on A4, not a markdown dump.
// jsPDF standard fonts cannot render ₹, so we write "Rs.".
// ════════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf'
import type { Profile, Report } from './types'

const PAGE = { w: 210, h: 297, margin: 18 }
const COLOR = {
  ink: [28, 25, 23] as [number, number, number],
  muted: [87, 83, 78] as [number, number, number],
  faint: [120, 113, 108] as [number, number, number],
  line: [214, 211, 209] as [number, number, number],
  band: [28, 25, 23] as [number, number, number],
  paper: [250, 250, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  accent: [5, 150, 105] as [number, number, number],
}

interface Block {
  kind: 'h1' | 'h2' | 'h3' | 'bullet' | 'text' | 'table'
  text: string
  rows?: string[][]
}

/** Minimal markdown → blocks (headings, bullets, tables, text). */
export function markdownToBlocks(md: string): Block[] {
  const blocks: Block[] = []
  const lines = (md || '').split(/\r?\n/)
  let tableRows: string[][] | null = null

  const flushTable = () => {
    if (tableRows && tableRows.length) blocks.push({ kind: 'table', text: '', rows: tableRows })
    tableRows = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim())
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue
      tableRows = tableRows || []
      tableRows.push(cells)
      continue
    }
    flushTable()

    if (!line.trim()) continue
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length
      blocks.push({ kind: level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3', text: line.replace(/^#+\s*/, '') })
    } else if (/^\s*[-*•]\s+/.test(line)) {
      blocks.push({ kind: 'bullet', text: line.replace(/^\s*[-*•]\s+/, '') })
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      blocks.push({ kind: 'bullet', text: line.replace(/^\s*\d+[.)]\s+/, '') })
    } else {
      blocks.push({ kind: 'text', text: line })
    }
  }
  flushTable()
  return blocks
}

const stripMd = (s: string) => s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1')

const rupeeSafe = (s: string) => s.replace(/₹/g, 'Rs. ')

export function buildReportPdf(report: Pick<Report, 'title' | 'report_type' | 'created_at' | 'generated_content'>, profile: Profile | null): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const business = profile?.company_name || profile?.full_name || 'My Business'
  const title = report.title || `${report.report_type} report`
  const dated = new Date(report.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  let y = 0

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE.h - 20) {
      doc.addPage()
      y = 22
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...COLOR.faint)
      doc.text(`${business}  ·  ${title}`, PAGE.margin, 12)
      doc.setDrawColor(...COLOR.line)
      doc.setLineWidth(0.2)
      doc.line(PAGE.margin, 15, PAGE.w - PAGE.margin, 15)
    }
  }

  // ── Cover band ──
  doc.setFillColor(...COLOR.band)
  doc.rect(0, 0, PAGE.w, 42, 'F')
  doc.setTextColor(...COLOR.white)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('CONFIDENTIAL BRIEFING', PAGE.margin, 12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  const titleLines = doc.splitTextToSize(title, PAGE.w - 2 * PAGE.margin) as string[]
  doc.text(titleLines.slice(0, 2), PAGE.margin, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`${business}  ·  ${dated}  ·  ${report.report_type} report`, PAGE.margin, 36)
  y = 52

  const blocks = markdownToBlocks(report.generated_content || '')
  let firstProse = true

  for (const b of blocks) {
    const text = rupeeSafe(stripMd(b.text))
    if (b.kind === 'h1' || b.kind === 'h2') {
      ensureSpace(16)
      y += 5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(b.kind === 'h1' ? 12.5 : 11)
      doc.setTextColor(...COLOR.ink)
      const wrapped = doc.splitTextToSize(text, PAGE.w - 2 * PAGE.margin) as string[]
      doc.text(wrapped, PAGE.margin, y)
      y += wrapped.length * 5 + 1
      doc.setDrawColor(...COLOR.accent)
      doc.setLineWidth(0.7)
      doc.line(PAGE.margin, y, PAGE.margin + 18, y)
      y += 4
    } else if (b.kind === 'h3') {
      ensureSpace(10)
      y += 2
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLOR.ink)
      const wrapped = doc.splitTextToSize(text, PAGE.w - 2 * PAGE.margin) as string[]
      doc.text(wrapped, PAGE.margin, y)
      y += wrapped.length * 4.5 + 1
    } else if (b.kind === 'bullet') {
      const wrapped = doc.splitTextToSize(text, PAGE.w - 2 * PAGE.margin - 6) as string[]
      ensureSpace(wrapped.length * 4.6 + 2)
      doc.setFillColor(...COLOR.accent)
      doc.circle(PAGE.margin + 1.5, y - 1, 0.7, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(...COLOR.muted)
      doc.text(wrapped, PAGE.margin + 6, y)
      y += wrapped.length * 4.6 + 1.4
    } else if (b.kind === 'table' && b.rows && b.rows.length) {
      const cols = Math.max(...b.rows.map((r) => r.length))
      const colW = (PAGE.w - 2 * PAGE.margin) / cols
      const longest = Math.max(...b.rows.flat().map((c) => stripMd(c).length))
      const fs = longest > 60 ? 7.5 : longest > 34 ? 8.5 : 9
      for (let r = 0; r < b.rows.length; r++) {
        const rowCells = b.rows[r].map((c) => rupeeSafe(stripMd(c)))
        const rowH = Math.max(...rowCells.map((c) => (doc.splitTextToSize(c, colW - 3) as string[]).length)) * (fs * 0.42 + 1.4) + 2
        ensureSpace(rowH + 2)
        if (r === 0) {
          doc.setFillColor(...COLOR.paper)
          doc.rect(PAGE.margin, y - 2, PAGE.w - 2 * PAGE.margin, rowH, 'F')
        }
        doc.setFont('helvetica', r === 0 ? 'bold' : 'normal')
        doc.setFontSize(fs)
        doc.setTextColor(...(r === 0 ? COLOR.ink : COLOR.muted))
        rowCells.forEach((c, ci) => {
          const wrapped = doc.splitTextToSize(c, colW - 3) as string[]
          doc.text(wrapped, PAGE.margin + ci * colW + 1.5, y + 1.5)
        })
        y += rowH
        if (r < b.rows.length - 1) {
          doc.setDrawColor(...COLOR.line)
          doc.setLineWidth(0.2)
          doc.line(PAGE.margin, y - 0.5, PAGE.w - PAGE.margin, y - 0.5)
        }
      }
      y += 3
    } else {
      const wrapped = doc.splitTextToSize(text, PAGE.w - 2 * PAGE.margin - (firstProse ? 4 : 0)) as string[]
      const boxH = wrapped.length * 4.8 + 8
      if (firstProse) {
        ensureSpace(boxH + 4)
        doc.setFillColor(...COLOR.paper)
        doc.roundedRect(PAGE.margin - 2, y - 5, PAGE.w - 2 * PAGE.margin + 4, boxH, 1.5, 1.5, 'F')
        doc.setDrawColor(...COLOR.accent)
        doc.setLineWidth(1.2)
        doc.line(PAGE.margin - 2, y - 5, PAGE.margin - 2, y - 5 + boxH)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...COLOR.ink)
        doc.text(wrapped, PAGE.margin + 4, y)
        y += boxH + 2
        firstProse = false
      } else {
        ensureSpace(wrapped.length * 4.8 + 2)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(...COLOR.muted)
        doc.text(wrapped, PAGE.margin, y)
        y += wrapped.length * 4.8 + 1.8
      }
    }
  }

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COLOR.faint)
    doc.text(`${business}  ·  prepared for the owner  ·  Cashiea`, PAGE.margin, PAGE.h - 8)
    doc.text(`${p} of ${pages}`, PAGE.w - PAGE.margin, PAGE.h - 8, { align: 'right' })
  }

  return doc
}

export function downloadReportPdf(
  report: Pick<Report, 'title' | 'report_type' | 'created_at' | 'generated_content'>,
  profile: Profile | null,
): void {
  const filename = (report.title || 'report').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  buildReportPdf(report, profile).save(`${filename}.pdf`)
}

/** Plain-text rendering of a report (WhatsApp sharing). */
export function reportToPlainText(report: Pick<Report, 'title' | 'created_at' | 'generated_content'>, limit = 1600): string {
  const blocks = markdownToBlocks(report.generated_content || '')
  const lines: string[] = [`*${report.title}*`, new Date(report.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }), '']
  for (const b of blocks) {
    if (b.kind === 'table' && b.rows) {
      for (const row of b.rows.slice(0, 6)) lines.push(row.filter(Boolean).join(' — '))
    } else if (b.kind === 'h1' || b.kind === 'h2') {
      lines.push('', `*${stripMd(b.text)}*`)
    } else if (b.kind !== 'h3') {
      lines.push(`${b.kind === 'bullet' ? '• ' : ''}${stripMd(b.text)}`)
    }
  }
  let text = lines.join('\n').replace(/\n{3,}/g, '\n\n')
  if (text.length > limit) text = text.slice(0, limit - 1) + '…'
  return text + '\n\n— via Cashiea'
}
