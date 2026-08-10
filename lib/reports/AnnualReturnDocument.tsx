import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

/**
 * Grand Lodge Annual Return — assembled entirely from data already in
 * the system (petitions, degree_progress, tenant_members, payments)
 * rather than a Secretary manually re-tallying a year of scattered
 * notes. This is the single highest-leverage report in the app: the
 * data plumbing already existed, the report itself was the only
 * missing piece.
 *
 * THE LOSSES BREAKDOWN IS REAL NOW. This used to carry a printed
 * apology: tenant_members had only is_active, so a brother who died and
 * one who simply stopped renewing were indistinguishable, and the
 * return reported a single combined "became inactive" figure. Migration
 * 025 added the reason and the date it took effect, so demits,
 * suspensions, expulsions and deaths are counted separately and each is
 * confined to the year being reported.
 *
 * What has NOT changed is the principle underneath that apology.
 * Memberships that went inactive before the lodge began recording
 * reasons are reported as unaccounted, on their own line, rather than
 * being distributed across the four real categories to make the columns
 * add up. A fabricated breakdown on a Grand Lodge return is worse than
 * an honest gap, and the Secretary is the only one who can close it.
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
  memberCounts: {
    activeStart: number
    activeEnd: number
    becameInactive: number
    losses: { demitted: number; suspended: number; expelled: number; deceased: number }
    unaccountedLosses: number
  }
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
          <View style={styles.row}><Text style={styles.label}>Losses during period (total)</Text><Text style={styles.value}>{data.memberCounts.becameInactive}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Losses, by Cause</Text>
          <View style={styles.row}><Text style={styles.label}>Demitted</Text><Text style={styles.value}>{data.memberCounts.losses.demitted}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Suspended</Text><Text style={styles.value}>{data.memberCounts.losses.suspended}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Expelled</Text><Text style={styles.value}>{data.memberCounts.losses.expelled}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Died</Text><Text style={styles.value}>{data.memberCounts.losses.deceased}</Text></View>
          {data.memberCounts.unaccountedLosses > 0 && (
            <View style={styles.row}><Text style={styles.label}>Inactive, cause or date not recorded (see note)</Text><Text style={styles.value}>{data.memberCounts.unaccountedLosses}</Text></View>
          )}
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
          {data.memberCounts.unaccountedLosses > 0
            ? `Note on membership status: ${data.memberCounts.unaccountedLosses} membership(s) are recorded as inactive without a cause or an effective date. These predate the lodge recording why a brother left the rolls, and they are shown on their own line rather than being distributed across the four causes above — this report does not fabricate a breakdown the underlying data does not support. Setting the cause and date on those records in the Members page will bring them into the figures. The four causes above count only changes whose effective date falls inside the period.`
            : 'Note on membership status: the causes above count only changes whose effective date falls inside the reporting period. Every inactive membership in this lodge has a recorded cause and date.'}
        </Text>

        <Text style={styles.footer} fixed>
          Generated by LodgeOS on {data.generatedAt} — for internal preparation only, not a substitute for your jurisdiction's official return form.
        </Text>
      </Page>
    </Document>
  )
}
