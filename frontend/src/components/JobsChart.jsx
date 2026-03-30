import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function JobsChart({ data = [] }) {
  const isDark = document.documentElement.classList.contains('dark')
  const gridColor = isDark ? '#374151' : '#f3f4f6'
  const textColor = isDark ? '#9ca3af' : '#6b7280'

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Jobs per Hour (Last 24h)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 10, fill: textColor }}
            tickLine={false}
            axisLine={false}
            interval={3}
          />
          <YAxis tick={{ fontSize: 10, fill: textColor }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#111827' : '#fff',
              border: '1px solid ' + (isDark ? '#374151' : '#e5e7eb'),
              borderRadius: '12px',
              fontSize: '12px',
            }}
            labelStyle={{ color: isDark ? '#f9fafb' : '#111827', fontWeight: 600 }}
          />
          <Bar dataKey="count" fill="#6172f3" radius={[4, 4, 0, 0]} name="Jobs" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
