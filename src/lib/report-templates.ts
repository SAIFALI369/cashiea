// ════════════════════════════════════════════════════════════════
// Report type metadata + prompt framing.
//
// This is the single source of truth for report type structure — used by:
//   - the Reports UI (to show expected sections + placeholders)
//   - the ai-automation edge function (mirrors frameReportPrompt)
//
// Keep this in sync with supabase/functions/ai-automation/index.ts
// frameReportPrompt(). If you change a section list here, change it there.
// ════════════════════════════════════════════════════════════════

export type ReportType = 'financial' | 'sales' | 'operations' | 'custom'

export interface ReportTemplate {
  value: ReportType
  label: string
  hint: string
  sections: string[]
  placeholder: string
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    value: 'financial',
    label: 'Financial',
    hint: 'A briefing on money in, money out, and what to do next',
    sections: ['Executive Summary', 'Revenue Analysis', 'Expense Breakdown', 'Profitability & Margins', 'Cash Flow', 'Recommendations'],
    placeholder: 'Revenue: ₹125,000\nExpenses: ₹87,000\nCOGS: ₹32,000\nCash balance: ₹48,000\nAR aging: 30 days\nBurn rate: ₹9K/mo',
  },
  {
    value: 'sales',
    label: 'Sales',
    hint: 'What moved, who bought, and where the next rupee comes from',
    sections: ['Executive Summary', 'Pipeline Overview', 'Win/Loss Analysis', 'Top Performers', 'Conversion Funnel', 'Forecast'],
    placeholder: 'Deals in pipeline: 24 (₹310K)\nWon this quarter: 8 (₹96K)\nLost: 5\nAvg deal size: ₹12K\nWin rate: 38%\nSales cycle: 21 days',
  },
  {
    value: 'operations',
    label: 'Operations',
    hint: 'Stock, speed, and the one bottleneck costing you sales',
    sections: ['Executive Summary', 'Throughput & Efficiency', 'Bottlenecks', 'Resource Utilization', 'Quality Metrics', 'Improvements'],
    placeholder: 'Tickets resolved: 412\nAvg resolution: 6.2 hrs\nBacklog: 38\nSLA breaches: 4\nTeam size: 7\nUtilization: 78%',
  },
  {
    value: 'custom',
    label: 'Custom',
    hint: 'A short briefing on whatever you name',
    sections: ['Executive Summary', 'Findings', 'Recommendations'],
    placeholder: 'Paste any business data you want analyzed and turned into a structured report...',
  },
]

export function getReportTemplate(type: string): ReportTemplate {
  return REPORT_TEMPLATES.find((t) => t.value === type) || REPORT_TEMPLATES[3]
}

/**
 * Build the structured prompt for a given report type. Mirrors the logic in
 * supabase/functions/ai-automation/index.ts so both client and server agree.
 */
const VOICE =
  'Write it as a briefing a trusted manager would put on the owner\'s desk — complete sentences, one idea per paragraph, numbers woven into the prose (never a dump of labelled fields). Open the Executive Summary with two or three sentences that a busy owner can read in ten seconds. Recommendations must be concrete next steps, not slogans. No emoji. No filler. Indian rupees and lakh/crore grouping.'

export function frameReportPrompt(reportType: string, title: string, data: string): string {
  const t = title || `${reportType} Report`
  switch (reportType) {
    case 'financial':
      return `Create a FINANCIAL REPORT titled "${t}". Structure it as:\n1. Executive Summary\n2. Revenue Analysis\n3. Expense Breakdown\n4. Profitability & Margins\n5. Cash Flow Highlights\n6. Recommendations\n\n${VOICE}\n\nFocus on numbers, ratios, and financial health. Data:\n${data}`
    case 'sales':
      return `Create a SALES REPORT titled "${t}". Structure it as:\n1. Executive Summary\n2. Pipeline Overview\n3. Win/Loss Analysis\n4. Top Performers & Products\n5. Conversion Funnel\n6. Forecast & Recommendations\n\n${VOICE}\n\nFocus on deals, conversion rates, and revenue drivers. Data:\n${data}`
    case 'operations':
      return `Create an OPERATIONS REPORT titled "${t}". Structure it as:\n1. Executive Summary\n2. Throughput & Efficiency\n3. Bottlenecks & Issues\n4. Resource Utilization\n5. Quality Metrics\n6. Process Improvement Recommendations\n\n${VOICE}\n\nFocus on efficiency, cycle times, and operational health. Data:\n${data}`
    default:
      return `Create a CUSTOM business report titled "${t}" with an Executive Summary, Findings, and Recommendations sections based on this data:\n${data}\n\n${VOICE}`
  }
}
