import React from 'react'

type Payment = {
  amount: number
  date?: string
  type: 'paid' | 'rejected'
  reason?: string
}

type Rejection = {
  amount: number
  date?: string
  reason?: string
}

type Row = {
  invoiceNumber?: string
  depositDate?: string
  invoiceMonth?: string
  broker?: string
  subCompany?: string
  billedAmount?: number
  payments?: Payment[]
  rejections?: Rejection[]
  balance?: number
  lastStatus?: string
}

type Totals = {
  billed: number
  paid: number
  rejected: number
  balance: number
}

type Props = {
  provider?: string
  reportType?: string
  brokerName?: string
  period?: string
  exportedAt?: string
  totals: Totals
  rows: Row[]
}

const styles: { [k: string]: React.CSSProperties } = {
  container: { fontFamily: 'Arial, Helvetica, sans-serif', padding: 18, fontSize: 12 },
  headerRow: { display: 'flex', gap: 24, marginBottom: 12 },
  headerBlock: { minWidth: 220 },
  smallLabel: { fontWeight: 600, marginBottom: 4 },
  totalsBox: { border: '1px solid #999', width: 260, padding: 6, marginBottom: 12 },
  totalsTable: { width: '100%', borderCollapse: 'collapse' },
  bigTable: { width: '100%', borderCollapse: 'collapse', marginTop: 8 },
  th: { background: '#2b6fb2', color: 'white', padding: 6, border: '1px solid #999', fontSize: 11 },
  td: { padding: 8, border: '1px solid #999', verticalAlign: 'top', height: 28 },
  tdCenter: { padding: 8, border: '1px solid #999', verticalAlign: 'top', height: 28, textAlign: 'center' as const },
  tdNumeric: { padding: 8, border: '1px solid #999', verticalAlign: 'top', height: 28, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const, fontFamily: 'Arial, Helvetica, sans-serif' },
  observations: { marginTop: 18 },
}

function money(v?: number) {
  if (v === undefined || v === null) return ''
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const PaymentsByBrokerTemplate: React.FC<Props> = ({
  provider = '',
  reportType = 'État de facturation par courtier',
  brokerName = '',
  period = '',
  exportedAt = '',
  totals,
  rows,
}) => {
  return (
    <div style={styles.container} className="template-root">
      <div style={styles.headerRow} className="template-header">
        <div style={styles.headerBlock}>
          <div style={styles.smallLabel}>Prestataire :</div>
          <div>{provider}</div>
          <div style={{ height: 8 }} />
          <div style={styles.smallLabel}>Type d'état :</div>
          <div>{reportType}</div>
          <div style={{ height: 8 }} />
          <div style={styles.smallLabel}>Courtier :</div>
          <div>{brokerName}</div>
        </div>

        <div style={styles.headerBlock}>
          <div style={styles.smallLabel}>Période :</div>
          <div>{period}</div>
          <div style={{ height: 8 }} />
          <div style={styles.smallLabel}>Édité le :</div>
          <div>{exportedAt}</div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={styles.totalsBox}>
            <table style={styles.totalsTable}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700, border: 'none', padding: 4 }}>Indicateur</td>
                  <td style={{ fontWeight: 700, border: 'none', padding: 4 }}>Montant</td>
                </tr>
                <tr>
                  <td style={{ padding: 4 }}>Montant total facturé</td>
                    <td style={{ padding: 4, textAlign: 'right', fontVariantNumeric: 'tabular-nums' as const, fontFamily: 'Arial, Helvetica, sans-serif' }}>{money(totals?.billed)}</td>
                </tr>
                <tr>
                  <td style={{ padding: 4 }}>Montant total payé</td>
                    <td style={{ padding: 4, textAlign: 'right', fontVariantNumeric: 'tabular-nums' as const, fontFamily: 'Arial, Helvetica, sans-serif' }}>{money(totals?.paid)}</td>
                </tr>
                <tr>
                  <td style={{ padding: 4 }}>Montant total rejeté</td>
                    <td style={{ padding: 4, textAlign: 'right', fontVariantNumeric: 'tabular-nums' as const, fontFamily: 'Arial, Helvetica, sans-serif' }}>{money(totals?.rejected)}</td>
                </tr>
                <tr>
                  <td style={{ padding: 4 }}>Solde à percevoir</td>
                    <td style={{ padding: 4, textAlign: 'right', fontVariantNumeric: 'tabular-nums' as const, fontFamily: 'Arial, Helvetica, sans-serif' }}>{money(totals?.balance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <table style={styles.bigTable} className="template-table">
        <thead>
          <tr>
            <th style={{ ...styles.th, textAlign: 'center' }}>N° facture</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Date dépôt</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Mois facture</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Courtier</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Sous-compagnie</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Montant facturé</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Montant payé</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Montant rejeté</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Date(s) paiements</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Solde à percevoir</th>
            <th style={{ ...styles.th, textAlign: 'center' }}>Dernier statut</th>
            <th style={styles.th}>Motif rejet</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const paid = (r.payments || []).filter((p) => p.type === 'paid')
            const rejected = (r.rejections || [])
            const rejectReasons = rejected.map((p) => p.reason).filter(Boolean)
            return (
              <tr key={i}>
                <td style={styles.td}>{r.invoiceNumber}</td>
                <td style={styles.td}>{r.depositDate}</td>
                <td style={styles.td}>{r.invoiceMonth}</td>
                <td style={styles.tdCenter}>{r.broker}</td>
                <td style={styles.tdCenter}>{r.subCompany}</td>
                <td style={styles.tdNumeric}>{money(r.billedAmount)}</td>
                <td style={styles.tdNumeric}>
                  {paid.length === 0 ? '' : paid.map((p, idx) => (
                    <div key={idx} style={{ textAlign: 'right' }}>{money(p.amount)}</div>
                  ))}
                </td>
                <td style={styles.tdNumeric}>
                  {rejected.length === 0 ? '' : rejected.map((p, idx) => (
                    <div key={idx} style={{ textAlign: 'right' }}>{money(p.amount)}</div>
                  ))}
                </td>
                <td style={styles.tdCenter}>
                  {paid.length === 0 ? '' : paid.map((p, idx) => (
                    <div key={idx}>{p.date || ''}</div>
                  ))}
                </td>
                <td style={styles.tdNumeric}>{money(r.balance)}</td>
                <td style={styles.tdCenter}>{r.lastStatus}</td>
                <td style={{ ...styles.td, textAlign: 'left' }}>{rejectReasons.join(', ')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={styles.observations}>
        <div style={{ fontWeight: 700, marginTop: 12 }}>Observations :</div>
        <ul>
          <li>________________________________________________________________________</li>
          <li>________________________________________________________________________</li>
          <li>________________________________________________________________________</li>
        </ul>
      </div>
    </div>
  )
}

export default PaymentsByBrokerTemplate
