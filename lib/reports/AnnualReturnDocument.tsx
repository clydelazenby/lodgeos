import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

/**
 * Grand Lodge Annual Return — assembled entirely from data already in
 * the system (petitions, degree_progress, tenant_members, payments)
 * rather than a Secretary manually re-tallying a year of scattered
 * notes. This is the single highest-leverage report in the app: the
 * data plumbing already existed, the report itself was the only
 * missing piece.
 *
 * Honest gap, not hidden: the schema has no distinct "deceased" or
 * "demitted" status — tenant_members only has is_active (true/false).
 * A member who died and one who simply stopped renewing look identical
 * in this data. This report cannot distinguish them and does not
 * pretend to; it reports "became inactive during the period" as one
 * category rather than fabricating a breakdown the data doesn't
 * support. If a jurisdiction's return form requires that distinction,
 * the schema needs a real status field added — see the note at the
 * bottom of the generated PDF.
 */

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  header: { marginBottom: 24, borderBottom: '2 solid #1a1a1a', paddingBottom: 12 },
  lodgeName: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 9, color: '#555', marginBottom: 2 },
  periodLabel: { fontSize: 10, marginTop: 8, fontWeight: 700 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 8, backgroundColor: '#f0f0f0', padding: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottom: '0.5 solid #ddd' },
  label: { flex: 1 },
  value: { width: 60, textAlign: 'right', fontWeight: 700 },
  table: { marginTop: 6 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#e8e8e8', padding: 4, fontWeight: 700 },
  tableRow: { flexDirection: 'row', padding: 4, borderBottom: '0.5 solid #eee' },
  col1: { flex: 2 }, col2: { flex: 1 }, col3: { flex: 1.5 },
  note: { fontSize: 8, color: '#777', marginTop: 24, borderTop: '0.5 solid #ccc', paddingTop: 8, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, fontSize: 7, color: '#999', textAlign: 'center' },
})

export type AnnualReturnData = {
  lodgeName: string
  lodgeNumber: string
  jurisdiction: string | null
  periodStart: string
  periodEnd: string
  generatedAt: string
  memberCounts: { activeStart: number; activeEnd: number; becameInactive: number }
  degreesConferredEA: number
  degreesConferredFC: number
  degreesConferredMM: number
  petitionsReceived: number
  petitionsApproved: number
  petitionsDenied: number
  petitionsPending: number
  duesCollectedTotal: number
  conferralDetail: { name: string; degree: string; date: string }[]
}

export function AnnualReturnDocument({ data }: { data: AnnualReturnData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.lodgeName}>{data.lodgeName} #{data.lodgeNumber}</Text>
          {data.jurisdiction && <Text style={styles.subtitle}>{data.jurisdiction}</Text>}
          <Text style={styles.periodLabel}>Annual Return — {data.periodStart} to {data.periodEnd}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Membership</Text>
          <View style={styles.row}><Text style={styles.label}>Active members, start of period</Text><Text style={styles.value}>{data.memberCounts.activeStart}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Active members, end of period</Text><Text style={styles.value}>{data.memberCounts.activeEnd}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Became inactive during period (see note)</Text><Text style={styles.value}>{data.memberCounts.becameInactive}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Degrees Conferred</Text>
          <View style={styles.row}><Text style={styles.label}>Entered Apprentice</Text><Text style={styles.value}>{data.degreesConferredEA}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Fellowcraft</Text><Text style={styles.value}>{data.degreesConferredFC}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Master Mason</Text><Text style={styles.value}>{data.degreesConferredMM}</Text></View>

          {data.conferralDetail.length > 0 && (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>Brother</Text><Text style={styles.col2}>Degree</Text><Text style={styles.col3}>Date</Text>
              </View>
              {data.conferralDetail.map((c, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.col1}>{c.name}</Text><Text style={styles.col2}>{c.degree}</Text><Text style={styles.col3}>{c.date}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Petitions</Text>
          <View style={styles.row}><Text style={styles.label}>Received during period</Text><Text style={styles.value}>{data.petitionsReceived}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Approved</Text><Text style={styles.value}>{data.petitionsApproved}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Denied</Text><Text style={styles.value}>{data.petitionsDenied}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Still pending as of report date</Text><Text style={styles.value}>{data.petitionsPending}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Finance Summary</Text>
          <View style={styles.row}><Text style={styles.label}>Dues collected during period</Text><Text style={styles.value}>${data.duesCollectedTotal.toLocaleString()}</Text></View>
        </View>

        <Text style={styles.note}>
          Note on membership status: this system currently records only whether a member is active or
          inactive — it does not yet distinguish death, demit, suspension, or other reasons for a status
          change. The "became inactive" figure above is a single combined count for all such cases during
          the period. If your jurisdiction's return requires this breakdown, it must currently be determined
          manually by cross-referencing lodge records, or a status field should be added to the system to
          track it going forward. This report does not fabricate a breakdown the underlying data does not
          support.
        </Text>

        <Text style={styles.footer} fixed>
          Generated by LodgeOS on {data.generatedAt} — for internal preparation only, not a substitute for your jurisdiction's official return form.
        </Text>
      </Page>
    </Document>
  )
}
