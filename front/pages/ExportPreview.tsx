import React, { useRef, useState, useEffect } from 'react'
import PaymentsByCompanyTemplate from '../components/templates/PaymentsByCompanyTemplate'
import PaymentsByBrokerTemplate from '../components/templates/PaymentsByBrokerTemplate'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import useRegistrations from '../hooks/useRegistrations'
import { getInvoiceStatus } from '@/utils/helpers'

const ExportPreview: React.FC = () => {
  const selectedYear = new Date().getFullYear()
  const { invoices, partners } = useRegistrations(selectedYear)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const exportedRef = useRef<boolean>(false)

  // (removed global computeTotals; per-section totals computed later)

  const [exporting, setExporting] = useState(false)
  const [rowsPerPage, setRowsPerPage] = useState<number>(20)

  // Note: browser print export removed — client-side PDF export only

  // Client-side PDF export using html2canvas + jsPDF for pixel-perfect output
  const handleExportPdfClient = async () => {
    setExporting(true)
    try {
      if (!wrapperRef.current) return
      const pages = Array.from(wrapperRef.current.querySelectorAll('.export-page')) as HTMLElement[]
      if (pages.length === 0) return

      // Use px units so mapping between canvas pixels and PDF is straightforward
      const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' })
      const pdfW = doc.internal.pageSize.getWidth()
      const pdfH = doc.internal.pageSize.getHeight()

      const captureScale = 2 // increase for sharper images

      for (let p = 0; p < pages.length; p++) {
        const el = pages[p]
        // Render the element to canvas
        const fullCanvas = await html2canvas(el, { scale: captureScale, useCORS: true, backgroundColor: '#ffffff' })
        const canvasW = fullCanvas.width
        const canvasH = fullCanvas.height
        const scale = pdfW / canvasW

        if (canvasH * scale <= pdfH) {
          // fits on one PDF page
          const imgData = fullCanvas.toDataURL('image/png')
          if (p > 0) doc.addPage()
          doc.addImage(imgData, 'PNG', 0, 0, pdfW, canvasH * scale)
        } else {
          // slice into multiple PDF pages (don't split rows logic here, rely on pre-paging)
          const sliceH = Math.floor(pdfH / scale) // height in canvas pixels per pdf page
          let sy = 0
          let part = 0
          while (sy < canvasH) {
            const sh = Math.min(sliceH, canvasH - sy)
            const tmp = document.createElement('canvas')
            tmp.width = canvasW
            tmp.height = sh
            const ctx = tmp.getContext('2d')!
            ctx.drawImage(fullCanvas, 0, sy, canvasW, sh, 0, 0, canvasW, sh)
            const imgData = tmp.toDataURL('image/png')
            if (p > 0 || part > 0) doc.addPage()
            doc.addImage(imgData, 'PNG', 0, 0, pdfW, sh * scale)
            sy += sh
            part += 1
          }
        }
      }

      doc.save(`export_${selectedYear}.pdf`)
      // After saving, attempt to close the preview window if it was opened by the parent
      try {
        setTimeout(() => {
          if (window.opener) {
            window.close()
          }
        }, 500)
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.error('Client PDF export failed', e)
    } finally {
      setExporting(false)
    }
  }

  // Auto-run export when opened with ?auto=1 (used by Registrations export button)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('auto') === '1' && !exportedRef.current) {
        // mark exported so we don't loop
        exportedRef.current = true
        // small timeout to allow the page to render, then run client-side PDF export
        setTimeout(() => {
          handleExportPdfClient()
        }, 300)
      }
    } catch (e) {
      // ignore
    }
  }, [])

  // Check if we should show only company or broker template based on URL param
  const params = new URLSearchParams(window.location.search)
  const entityFilter = params.get('entity') // 'company' or 'broker'
  const showCompany = !entityFilter || entityFilter === 'company'
  const showBroker = !entityFilter || entityFilter === 'broker'

  // Apply URL filters (if any) to the invoices list so preview matches the Registrations filters
  const urlFilters: any = {
    Broker: params.get('Broker') || '',
    status: params.get('status') || '',
    dateMin: params.get('dateMin') || '',
    dateMax: params.get('dateMax') || '',
    amountMin: params.get('amountMin') || '',
    amountMax: params.get('amountMax') || '',
    search: params.get('search') || '',
  }

  const applyFiltersToInvoices = (list: any[], f: any) => {
    return (list || []).filter((inv: any) => {
      const entityMatch = !f.Broker || inv.Broker?.name === f.Broker || inv.Company?.name === f.Broker || inv.broker?.name === f.Broker || inv.company?.name === f.Broker
      // Use shared helper to compute invoice status text so filtering matches the table logic
      const statusObj = getInvoiceStatus(inv)
      const statusText = statusObj?.text || ''
      const statusMatch = !f.status || statusText === f.status
      const date = inv.deposit_date || ''
      const dateMinMatch = !f.dateMin || date >= f.dateMin
      const dateMaxMatch = !f.dateMax || date <= f.dateMax
      const amountMinMatch = !f.amountMin || Number(inv.billed_amount) >= Number(f.amountMin)
      const amountMaxMatch = !f.amountMax || Number(inv.billed_amount) <= Number(f.amountMax)
      const searchMatch = !f.search || Object.values(inv).some((v) => v?.toString().toLowerCase().includes(String(f.search).toLowerCase()))
      return entityMatch && statusMatch && dateMinMatch && dateMaxMatch && amountMinMatch && amountMaxMatch && searchMatch
    })
  }

  // Filtered invoices are already available; we'll display those in both templates

  // derive provider name from partners or invoices data
  const providerName = (partners && partners.length > 0 && partners[0].name) || (invoices && invoices[0]?.provider?.name) || 'Prestataire'

  // compute totals from paged rows (rows use billedAmount, payments, rejections, balance)
  const computeTotalsFromRows = (rowsList: any[]) => {
    const billed = rowsList.reduce((s, r) => s + Number(r.billedAmount || 0), 0)
    const paid = rowsList.reduce((s, r) => s + (r.payments || []).reduce((ss: number, p: any) => ss + Number(p.amount || 0), 0), 0)
    const rejected = rowsList.reduce((s, r) => s + (r.rejections || []).reduce((ss: number, rj: any) => ss + Number(rj.amount || 0), 0), 0)
    const balance = billed - paid - rejected
    return { billed, paid, rejected, balance }
  }

  // Helper: build rows matching the template Row shape
  const buildCompanyRows = (invoicesList: any[]) =>
    invoicesList.map((inv: any) => ({
      invoiceNumber: inv.invoice_number,
      depositDate: inv.deposit_date,
      invoiceMonth: inv.invoice_month,
      company: inv.Company?.name || inv.company?.name,
      billedAmount: Number(inv.billed_amount || 0),
      payments: (inv.payments || []).map((p: any) => ({ amount: Number(p.amount || 0), date: p.date || p.payment_date, type: 'paid' })),
      rejections: (inv.rejections || []).map((r: any) => ({ amount: Number(r.rejected_amount ?? r.amount ?? 0), date: r.date || r.rejection_date, reason: r.reason || r.rejection_reason })),
      balance: Number(inv.billed_amount || 0) - (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0) - (inv.rejections || []).reduce((s: number, r: any) => s + Number(r.rejected_amount ?? r.amount ?? 0), 0),
      lastStatus: inv.status,
    }))

  const buildBrokerRows = (invoicesList: any[]) =>
    invoicesList.map((inv: any) => ({
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
    }))

  // Chunk helper: split array into arrays of size <= pageSize
  const chunk = (arr: any[], pageSize: number) => {
    const out: any[] = []
    for (let i = 0; i < arr.length; i += pageSize) out.push(arr.slice(i, i + pageSize))
    return out
  }

  // Prepare paged data (rowsPerPage controlled by UI)
  // Filter invoices so company section only contains invoices with a Company
  // and broker section only contains invoices with a Broker
  const invoicesArray = applyFiltersToInvoices(invoices || [], urlFilters)
  // Ensure invoices are assigned exclusively:
  // - If an invoice has a Broker, treat it as a broker invoice
  // - Otherwise, if it has a Company, treat it as a company invoice
  const brokerInvoices = invoicesArray.filter((inv: any) => !!(inv.Broker || inv.broker))
  const companyInvoices = invoicesArray.filter(
    (inv: any) => !!(inv.Company || inv.company) && !(inv.Broker || inv.broker)
  )

  const companyRowsAll = buildCompanyRows(companyInvoices)
  const brokerRowsAll = buildBrokerRows(brokerInvoices)
  const companyPages = chunk(companyRowsAll, rowsPerPage)
  const brokerPages = chunk(brokerRowsAll, rowsPerPage)

  const companyTotals = computeTotalsFromRows(companyRowsAll)
  const brokerTotals = computeTotalsFromRows(brokerRowsAll)

  // Build header strings from URL filters so the preview shows the active filter values
  const periodLabel = (urlFilters.dateMin || urlFilters.dateMax)
    ? `${urlFilters.dateMin || ''} - ${urlFilters.dateMax || ''}`
    : 'Général'

  const reportTypeFromStatus = (status?: string) => {
    if (!status) return ''
    // keep as-is since status values are in French already (e.g., 'Payé', 'Rejeté', 'Partiel', 'En attente')
    return `Filtres statut : ${status}`
  }

  const companyReportType = reportTypeFromStatus(urlFilters.status) || 'État de facturation par compagnie'
  const brokerReportType = reportTypeFromStatus(urlFilters.status) || 'État de facturation par courtier'

  const companyLabel = urlFilters.Broker && companyInvoices.length > 0 ? String(urlFilters.Broker) : 'Toutes les compagnies'
  const brokerLabel = urlFilters.Broker && brokerInvoices.length > 0 ? String(urlFilters.Broker) : 'Tous les courtiers'

  return (
    <>
      {/* Print-specific styles removed per user request */}
      
      <div className="no-print" style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ marginRight: 6 }}>Lignes par page :</label>
          <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))} style={{ padding: '6px 8px' }}>
            <option value={18}>18</option>
            <option value={20}>20</option>
            <option value={22}>22</option>
            <option value={25}>25</option>
          </select>
          <button onClick={handleExportPdfClient} style={{ padding: '8px 12px', marginLeft: 12 }} disabled={exporting}>
            {exporting ? 'Export en cours...' : 'Exporter PDF (client jsPDF)'}
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

      <div className="no-print" style={{ padding: 16 }}>
        <h3 style={{ marginBottom: 16 }}>Aperçu de l'export :</h3>
      </div>
      </div>

      <div ref={wrapperRef}>
        {showCompany && companyPages.length > 0 && (
          companyPages.map((pageRows, idx) => (
            <div key={`company-page-${idx}`} className="export-page" style={{ background: 'white', padding: 0, margin: 0, width: '100%' }}>
              <PaymentsByCompanyTemplate
                provider={providerName}
                companyName={companyLabel}
                period={periodLabel}
                reportType={companyReportType}
                exportedAt={new Date().toLocaleString()}
                totals={idx === 0 ? companyTotals : { billed: 0, paid: 0, rejected: 0, balance: 0 }}
                rows={pageRows}
              />
            </div>
          ))
        )}

        {showBroker && brokerPages.length > 0 && (
          brokerPages.map((pageRows, idx) => (
            <div key={`broker-page-${idx}`} className="export-page" style={{ background: 'white', padding: 0, margin: 0, marginTop: showCompany && idx === 0 ? 24 : 0, width: '100%' }}>
              <PaymentsByBrokerTemplate
                provider={providerName}
                brokerName={brokerLabel}
                period={periodLabel}
                reportType={brokerReportType}
                exportedAt={new Date().toLocaleString()}
                totals={idx === 0 ? brokerTotals : { billed: 0, paid: 0, rejected: 0, balance: 0 }}
                rows={pageRows}
              />
            </div>
          ))
        )}
      </div>
    </>
  )
}

export default ExportPreview

