export default function QueueDepthGauge({ depth = 0 }) {
  const getColor = () => {
    if (depth < 10) return { bar: 'bg-green-500', text: 'text-green-600 dark:text-green-400', label: 'Healthy' }
    if (depth < 50) return { bar: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', label: 'Moderate' }
    return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', label: 'Heavy Load' }
  }

  const { bar, text, label } = getColor()
  const pct = Math.min((depth / 100) * 100, 100)

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Queue Depth</h3>
      <div className="flex items-center justify-between mb-3">
        <span className="text-4xl font-bold text-gray-900 dark:text-white">{depth}</span>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full bg-opacity-10 ${text}`}>{label}</span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-700 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-2">Jobs pending + queued — {pct.toFixed(0)}% of capacity</p>
    </div>
  )
}
