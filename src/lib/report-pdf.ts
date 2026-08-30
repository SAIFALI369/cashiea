// ════════════════════════════════════════════════════════════════
// Report PDF — renders a generated report (markdown) into a clean
// A4 PDF: title header band, section headings, bullets, paragraphs
// and simple tables. Uses the app's semantic palette; "Rs." because
// jsPDF standard fonts cannot render the ₹ glyph.
// ════════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf'
import type { Profile, Report } from './types'

const PAGE = { w: 210, h: 297, margin: 16 }
const COLOR = {
  accent: [16, 185, 129] as [number, number, number],     // --accent
  accentSoft: [209, 250, 229] as [number, number, number], // --accent-soft
  dark: [41, 37, 31] as [number, number, number],          // --fg
  muted: [92, 84, 73] as [number, number, number],         // --fg-muted
  subtle: [132, 123, 108] as [number, number, number],     // --fg-subtle
  line: [226, 217, 201] as [number, number, number],       // --line
  surface: [245, 239, 228] as [number, number, number],    // --surface-2
  white: [255, 255, 255] as [number, number, number],
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
      // separator rows like |---|---|
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

export function buildReportPdf(report: Pick<Report, 'title' | 'report_type' | 'created_at' | 'generated_content'>, profile: Profile | null): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const business = profile?.company_name || profile?.full_name || 'My Business'
  let y = 0

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE.h - 18) { doc.addPage(); y = 16 }
  }

  // ── Header band (page 1) ──
  doc.setFillColor(...COLOR.accent)
  doc.rect(0, 0, PAGE.w, 26, 'F')
  doc.setTextColor(...COLOR.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(report.title || `${report.report_type} report`, PAGE.margin, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const meta = [
    business,
    new Date(report.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' }),
    `${report.report_type} report`,
  ].join('  ·  ')
  doc.text(meta, PAGE.margin, 19)
  y = 34

  const blocks = markdownToBlocks(report.generated_content || '')

  for (const b of blocks) {
    const text = stripMd(b.text)
    if (b.kind === 'h1' || b.kind === 'h2') {
      ensureSpace(14)
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(b.kind === 'h1' ? 13 : 11)
      doc.setTextColor(...COLOR.dark)
      doc.text(doc.splitTextToSize(text, PAGE.w - 2 * PAGE.margin), PAGE.margin, y)
      y += 5.5
      doc.setDrawColor(...COLOR.accent)
      doc.setLineWidth(0.6)
      doc.line(PAGE.margin, y, PAGE.margin + 14, y)
      y += 3
    } else if (b.kind === 'h3') {
      ensureSpace(10)
      y += 2.5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLOR.dark)
      doc.text(doc.splitTextToSize(text, PAGE.w - 2 * PAGE.margin), PAGE.margin, y)
      y += 4.5
    } else if (b.kind === 'bullet') {
      const wrapped = doc.splitTextToSize(text, PAGE.w - 2 * PAGE.margin - 5) as string[]
      ensureSpace(wrapped.length * 4.6 + 2)
      doc.setFillColor(...COLOR.accent)
      doc.circle(PAGE.margin + 1.4, y - 0.9, 0.8, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(...COLOR.muted)
      doc.text(wrapped, PAGE.margin + 5, y)
      y += wrapped.length * 4.6 + 1.2
    } else if (b.kind === 'table' && b.rows && b.rows.length) {
      const cols = Math.max(...b.rows.map((r) => r.length))
      const colW = (PAGE.w - 2 * PAGE.margin) / cols
      // crude width estimate per cell to pick a font size
      const longest = Math.max(...b.rows.flat().map((c) => stripMd(c).length))
      const fs = longest > 60 ? 7.5 : longest > 34 ? 8.5 : 9.5
      for (let r = 0; r < b.rows.length; r++) {
        const rowCells = b.rows[r].map((c) => stripMd(c))
        const rowH = Math.max(...rowCells.map((c) => (doc.splitTextToSize(c, colW - 3) as string[]).length)) * (fs * 0.42 + 1.4) + 2
        ensureSpace(rowH + 2)
        if (r === 0) {
          doc.setFillColor(...COLOR.surface)
          doc.rect(PAGE.margin, y - 2, PAGE.w - 2 * PAGE.margin, rowH, 'F')
        }
        doc.setFont('helvetica', r === 0 ? 'bold' : 'normal')
        doc.setFontSize(fs)
        doc.setTextColor(...(r === 0 ? COLOR.dark : COLOR.muted))
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
      const wrapped = doc.splitTextToSize(text, PAGE.w - 2 * PAGE.margin) as string[]
      ensureSpace(wrapped.length * 4.6 + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(...COLOR.muted)
      doc.text(wrapped, PAGE.margin, y)
      y += wrapped.length * 4.6 + 1.5
    }
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLOR.subtle)
    doc.text('Generated by Cashiea', PAGE.margin, PAGE.h - 8)
    doc.text(`${p} / ${pages}`, PAGE.w - PAGE.margin, PAGE.h - 8, { align: 'right' })
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
