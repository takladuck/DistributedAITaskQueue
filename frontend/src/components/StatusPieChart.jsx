import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { JOB_STATUSES } from '../utils/constants'

const STATUS_COLORS = {
  PENDING: '#9ca3af',
  QUEUED: '#3b82f6',
  RUNNING: '#f59e0b',
  COMPLETED: '#22c55e',
  FAILED: '#ef4444',
  CANCELLED: '#6b7280',
}

export default function StatusPieChart({ byStatus = {} }) {
  const data = Object.entries(byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ name: status, value: count }))

  if (data.length === 0) {
    return (
      <div className="card p-6 flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">No jobs yet</p>
      </div>
    )
  }

  const isDark = document.documentElement.classList.contains('dark')

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Jobs by Status</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map(({ name }) => (
              <Cell key={name} fill={STATUS_COLORS[name] || '#9ca3af'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#111827' : '#fff',
              border: '1px solid ' + (isDark ? '#374151' : '#e5e7eb'),
              borderRadius: '12px',
              fontSize: '12px',
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
