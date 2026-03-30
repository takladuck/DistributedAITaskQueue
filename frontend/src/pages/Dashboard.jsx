import { useState, useCallback } from 'react'
import MetricsCard from '../components/MetricsCard'
import JobsChart from '../components/JobsChart'
import StatusPieChart from '../components/StatusPieChart'
import QueueDepthGauge from '../components/QueueDepthGauge'
import LiveJobFeed from '../components/LiveJobFeed'
import { useMetrics } from '../hooks/useMetrics'
import { useDashboardWebSocket } from '../hooks/useWebSocket'
import { formatDuration } from '../utils/formatters'

export default function Dashboard() {
  const { summary, timeseries, loading, error, refetch } = useMetrics(30000)
  const [liveEvents, setLiveEvents] = useState([])
  const [wsStats, setWsStats] = useState(null)

  const handleWsMessage = useCallback((data) => {
    if (data.event === 'dashboard_update') {
      setWsStats(data)
    } else if (data.event === 'status_update') {
      setLiveEvents((prev) => [data, ...prev].slice(0, 10))
    }
  }, [])

  const { connected } = useDashboardWebSocket(handleWsMessage)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="spinner w-10 h-10" />
      </div>
    )
  }

  const queueDepth = wsStats?.queue_stats?.pending ?? summary?.queue_depth ?? 0

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Real-time overview of your AI task queue</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${connected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {connected ? 'Live' : 'Reconnecting...'}
          </span>
          <button onClick={refetch} className="btn-secondary text-sm">Refresh</button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          icon="🔢"
          title="Total Jobs"
          value={summary?.total_jobs ?? 0}
          subtitle="All time"
        />
        <MetricsCard
          icon="📅"
          title="Jobs Today"
          value={summary?.jobs_last_24h ?? 0}
          subtitle={`${summary?.jobs_last_hour ?? 0} in last hour`}
        />
        <MetricsCard
          icon="✅"
          title="Success Rate"
          value={`${summary?.success_rate ?? 0}%`}
          subtitle="Completed vs failed"
        />
        <MetricsCard
          icon="⚡"
          title="Avg Execution"
          value={formatDuration(summary?.avg_execution_time_ms)}
          subtitle="Per completed job"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <JobsChart data={timeseries} />
        </div>
        <StatusPieChart byStatus={summary?.by_status ?? {}} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <QueueDepthGauge depth={queueDepth} />
        <div className="lg:col-span-2">
          <LiveJobFeed events={liveEvents} />
        </div>
      </div>
    </div>
  )
}
