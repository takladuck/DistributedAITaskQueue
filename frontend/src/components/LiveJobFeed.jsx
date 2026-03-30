import JobStatusBadge from './JobStatusBadge'
import { formatDate } from '../utils/formatters'

export default function LiveJobFeed({ events = [] }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Live Job Feed</h3>
      {events.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Waiting for job events...</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {events.map((ev, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 animate-fade-in"
            >
              <div className="flex items-center gap-3 min-w-0">
                <JobStatusBadge status={ev.status} />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                  {ev.job_id?.substring(0, 8)}...
                </span>
              </div>
              <span className="text-xs text-gray-400 shrink-0 ml-2">
                {formatDate(ev.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
