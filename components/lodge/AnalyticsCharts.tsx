'use client'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { T } from '@/lib/designTokens'

const DONUT_COLORS = [T.gold, T.info, T.inkFaint]

const tooltipStyle = { background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: '6px', fontFamily: T.body, fontSize: '0.78rem', color: T.ink }

export function AnalyticsCharts({
  trendData, pipelineData, demographicsData, totalKnownAge, unknownAge,
}: {
  trendData: { month: string; attendance: number; dues: number }[]
  pipelineData: { stage: string; count: number }[]
  demographicsData: { name: string; value: number }[]
  totalKnownAge: number
  unknownAge: number
}) {
  const cardStyle: React.CSSProperties = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.25rem' }
  const titleStyle: React.CSSProperties = { fontFamily: T.display, fontSize: '0.9rem', color: T.ink, marginBottom: '1rem' }
  const axisStyle = { fontFamily: T.mono, fontSize: 10, fill: T.inkFaint }

  return (
    <div className="lodgeos-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
      {/* Attendance trend */}
      <div style={cardStyle}>
        <div style={titleStyle}>Attendance Trend</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="month" tick={axisStyle} axisLine={{ stroke: T.border }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={28} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: T.inkFaint }} />
            <Line type="monotone" dataKey="attendance" stroke={T.info} strokeWidth={2} dot={{ r: 3, fill: T.info }} name="Present" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Dues collection trend */}
      <div style={cardStyle}>
        <div style={titleStyle}>Dues Collection Trend</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="month" tick={axisStyle} axisLine={{ stroke: T.border }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => `$${v}`} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: T.inkFaint }} formatter={(v: number) => [`$${v}`, 'Collected']} />
            <Bar dataKey="dues" fill={T.gold} radius={[4, 4, 0, 0]} name="Collected" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Degree pipeline */}
      <div style={cardStyle}>
        <div style={titleStyle}>Degree Pipeline</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={pipelineData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
            <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="stage" tick={{ ...axisStyle, fontSize: 10.5 }} axisLine={false} tickLine={false} width={110} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill={T.gold} radius={[0, 4, 4, 0]} name="Members" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Demographics */}
      <div style={cardStyle}>
        <div style={titleStyle}>Member Demographics</div>
        {totalKnownAge === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: T.inkFaint, fontStyle: 'italic', fontSize: '0.82rem' }}>
            No members have a date of birth on file yet. Age demographics will appear here once entered on member profiles.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={demographicsData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {demographicsData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v} (${Math.round((v / totalKnownAge) * 100)}%)`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
              {demographicsData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: T.body, fontSize: '0.75rem', color: T.inkFaint }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
            {unknownAge > 0 && (
              <div style={{ textAlign: 'center', fontFamily: T.mono, fontSize: '10px', color: T.inkFainter, marginTop: '8px', fontStyle: 'italic' }}>
                {unknownAge} member{unknownAge !== 1 ? 's' : ''} without a date of birth on file, not shown above
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
