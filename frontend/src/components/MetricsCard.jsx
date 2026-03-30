export default function MetricsCard({ title, value, subtitle, icon, trend, color = 'brand' }) {
  const trendColors = { up: 'text-green-500', down: 'text-red-500', neutral: 'text-gray-400' }
  const trendDir = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral'
  const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→'

  return (
    <div className="card p-6 animate-fade-in hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="text-2xl">{icon}</div>
        {trend !== undefined && (
          <span className={`text-sm font-semibold ${trendColors[trendDir]}`}>
            {trendIcon} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}
