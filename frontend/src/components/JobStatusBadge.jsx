import { JOB_STATUSES } from '../utils/constants'

export default function JobStatusBadge({ status }) {
  const config = JOB_STATUSES[status] || JOB_STATUSES.PENDING
  return (
    <span className={`badge ${config.color}`}>
      {status === 'RUNNING' && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse mr-1" />
      )}
      {config.label}
    </span>
  )
}
