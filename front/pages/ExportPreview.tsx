import React, { useRef, useState } from 'react'
import PaymentsByCompanyTemplate from '../components/templates/PaymentsByCompanyTemplate'
import PaymentsByBrokerTemplate from '../components/templates/PaymentsByBrokerTemplate'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import useRegistrations from '../hooks/useRegistrations'

const ExportPreview: React.FC = () => {
  const selectedYear = new Date().getFullYear()
  const { invoices, filters } = useRegistrations(selectedYear)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // compute totals helper
  const computeTotals = (invoicesList: any[]) => {
    const billed = invoicesList.reduce((s, inv) => s + Number(inv.billed_amount || 0), 0)
    const paid = invoicesList.reduce((s, inv) => s + (inv.payments || []).reduce((ss: number, p: any) => ss + Number(p.amount || 0), 0), 0)
    const rejected = invoicesList.reduce((s, inv) => s + (inv.rejections || []).reduce((ss: number, r: any) => ss + Number(r.rejected_amount ?? r.amount ?? 0), 0), 0)
    const balance = billed - paid - rejected
    return { billed, paid, rejected, balance }
  }

  const [exporting, setExporting] = useState(false)

  const handleExportHtml = async () => {
    setExporting(true)
    if (!wrapperRef.current) return
    const pages = wrapperRef.current.querySelectorAll('.export-page')
    if (!pages || pages.length === 0) return

    // We'll use pixel units so mapping between canvas and PDF is straightforward
    const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' })

    // capture scale for html2canvas (higher scale -> sharper images)
    const captureScale = 2

    for (let p = 0; p < pages.length; p++) {
      const el = pages[p] as HTMLElement

      // find header and table elements to repeat headers on each page
      const headerEl = el.querySelector('.template-header') as HTMLElement | null
      const tableEl = el.querySelector('.template-table') as HTMLElement | null

      // full capture of the element at high resolution
      const fullCanvas = await html2canvas(el, { scale: captureScale })
      // if we have a header, capture header separately so we can repeat it
      let headerCanvas: HTMLCanvasElement | null = null
      if (headerEl) {
        headerCanvas = await html2canvas(headerEl, { scale: captureScale })
      }

      const canvasW = fullCanvas.width
      const canvasH = fullCanvas.height
      const pdfW = doc.internal.pageSize.getWidth()
      const pdfH = doc.internal.pageSize.getHeight()
      const scale = pdfW / canvasW

      if (!tableEl || !headerCanvas) {
        // fallback: slice full canvas into pages (no repeated header)
        const totalPdfHeight = canvasH * scale
        const pageCount = Math.ceil(totalPdfHeight / pdfH)
        const sliceHeightCanvas = Math.floor(pdfH / scale)

        for (let i = 0; i < pageCount; i++) {
          const sx = 0
          const sy = i * sliceHeightCanvas
          const sh = Math.min(sliceHeightCanvas, canvasH - sy)

          const tmpCanvas = document.createElement('canvas')
          tmpCanvas.width = canvasW
          tmpCanvas.height = sh
          const ctx = tmpCanvas.getContext('2d')!
          ctx.drawImage(fullCanvas, sx, sy, canvasW, sh, 0, 0, canvasW, sh)
          const imgData = tmpCanvas.toDataURL('image/png')
          if (p > 0 || i > 0) doc.addPage()
          doc.addImage(imgData, 'PNG', 0, 0, pdfW, sh * scale)
        }
      } else {
        // We have headerCanvas: repeat header on each page and slice body
        const headerCanvasH = headerCanvas.height
        const bodyCanvasH = canvasH - headerCanvasH
        if (bodyCanvasH <= 0) {
          // nothing to slice, just draw full canvas
          const imgData = fullCanvas.toDataURL('image/png')
          doc.addImage(imgData, 'PNG', 0, 0, pdfW, canvasH * scale)
        } else {
          // Improved heuristics: measure each table row in CSS pixels, convert to canvas pixels
          const elRect = el.getBoundingClientRect()
          const rowNodes = Array.from((tableEl.querySelectorAll('tbody tr') as any) || []) as HTMLElement[]
          const rowsInfo = rowNodes.map((r) => {
            const rRect = r.getBoundingClientRect()
            const topCanvas = Math.round((rRect.top - elRect.top) * captureScale)
            const heightCanvas = Math.round(rRect.height * captureScale)
            return { topCanvas, heightCanvas }
          })

          // available body height per page in canvas pixels
          const availableBodyPerPage = Math.floor(pdfH / scale) - headerCanvasH

          // pack rows into pages without splitting rows (unless a single row exceeds the page)
          let idx = 0
          const groups: { start: number; end: number }[] = []
          while (idx < rowsInfo.length) {
            let start = idx
            let used = 0
            while (idx < rowsInfo.length) {
              const rowH = rowsInfo[idx].heightCanvas
              if (used + rowH <= availableBodyPerPage) {
                used += rowH
                idx++
              } else {
                // if nothing added yet, force include this large row alone
                if (used === 0) {
                  used += rowH
                  idx++
                }
                break
              }
            }
            groups.push({ start, end: idx })
          }

          // create page images for each group
          for (let gi = 0; gi < groups.length; gi++) {
            const g = groups[gi]
            const firstRowTop = rowsInfo[g.start].topCanvas
            const lastRow = rowsInfo[g.end - 1]
            const bodyStart = firstRowTop
            const bodyHeight = (lastRow.topCanvas + lastRow.heightCanvas) - firstRowTop

            const pageCanvas = document.createElement('canvas')
            pageCanvas.width = canvasW
            pageCanvas.height = headerCanvasH + bodyHeight
            const ctx = pageCanvas.getContext('2d')!

            // draw header
            ctx.drawImage(headerCanvas, 0, 0)
            // draw the slice of the full canvas corresponding to the grouped rows
            ctx.drawImage(fullCanvas, 0, bodyStart, canvasW, bodyHeight, 0, headerCanvasH, canvasW, bodyHeight)

            const imgData = pageCanvas.toDataURL('image/png')
            if (p > 0 || gi > 0) doc.addPage()
            doc.addImage(imgData, 'PNG', 0, 0, pdfW, pageCanvas.height * scale)
          }
        }
      }
    }

    doc.save(`enregistrements_preview_${selectedYear}.pdf`)
    setExporting(false)
  }

  // Filtered invoices are already available; we'll display those in both templates
  const totals = computeTotals(invoices || [])

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <button onClick={handleExportHtml} style={{ padding: '8px 12px' }} disabled={exporting}>
          {exporting ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 50 50" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="25" cy="25" r="20" stroke="#2563EB" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="31.4 31.4" />
              </svg>
              Export en cours...
            </span>
          ) : (
            'Exporter en PDF (HTML exact)'
          )}
        </button>
      </div>

      {exporting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', padding: 18, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="28" height="28" viewBox="0 0 50 50" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="25" cy="25" r="20" stroke="#2563EB" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="31.4 31.4" />
            </svg>
            <div>
              <div style={{ fontWeight: 700 }}>Génération du PDF</div>
              <div style={{ fontSize: 12, color: '#555' }}>Veuillez patienter, ceci peut prendre quelques secondes...</div>
            </div>
          </div>
        </div>
      )}

      <div ref={wrapperRef}>
        <div className="export-page" style={{ background: 'white', padding: 8 }}>
          <PaymentsByCompanyTemplate
            provider={"Prestataire (preview)"}
            companyName={"Toutes les compagnies"}
            period={"Général"}
            exportedAt={new Date().toLocaleString()}
            totals={totals}
            rows={(invoices || []).map((inv: any) => ({
              invoiceNumber: inv.invoice_number,
              depositDate: inv.deposit_date,
              invoiceMonth: inv.invoice_month,
              company: inv.Company?.name || inv.company?.name,
              billedAmount: Number(inv.billed_amount || 0),
              payments: (inv.payments || []).map((p: any) => ({ amount: Number(p.amount || 0), date: p.date || p.payment_date, type: 'paid' })),
              rejections: (inv.rejections || []).map((r: any) => ({ amount: Number(r.rejected_amount ?? r.amount ?? 0), date: r.date || r.rejection_date, reason: r.reason || r.rejection_reason })),
              balance: Number(inv.billed_amount || 0) - (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0) - (inv.rejections || []).reduce((s: number, r: any) => s + Number(r.rejected_amount ?? r.amount ?? 0), 0),
              lastStatus: inv.status,
              // rejected reasons: map rejections
            }))}
          />
        </div>

        <div className="export-page" style={{ background: 'white', padding: 8, marginTop: 24 }}>
          <PaymentsByBrokerTemplate
            provider={"Prestataire (preview)"}
            brokerName={"Tous les courtiers"}
            period={"Général"}
            exportedAt={new Date().toLocaleString()}
            totals={totals}
            rows={(invoices || []).map((inv: any) => ({
              invoiceNumber: inv.invoice_number,
              depositDate: inv.deposit_date,
              invoiceMonth: inv.invoice_month,
              broker: inv.Broker?.name || inv.broker?.name,
              subCompany: inv.Company?.name || inv.company?.name,
              billedAmount: Number(inv.billed_amount || 0),
              payments: (inv.payments || []).map((p: any) => ({ amount: Number(p.amount || 0), date: p.date || p.payment_date, type: 'paid' })),
              rejections: (inv.rejections || []).map((r: any) => ({ amount: Number(r.rejected_amount ?? r.amount ?? 0), date: r.date || r.rejection_date, reason: r.reason || r.rejection_reason })),
              balance: Number(inv.billed_amount || 0) - (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0) - (inv.rejections || []).reduce((s: number, r: any) => s + Number(r.rejected_amount ?? r.amount ?? 0), 0),
              lastStatus: inv.status,
            }))}
          />
        </div>
      </div>
    </div>
  )
}

export default ExportPreview

