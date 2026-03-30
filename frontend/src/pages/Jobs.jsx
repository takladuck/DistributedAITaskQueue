import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobs } from '../hooks/useJobs'
import JobStatusBadge from '../components/JobStatusBadge'
import { formatDate, formatDuration, truncateId } from '../utils/formatters'
import { cancelJob, retryJob, deleteJob } from '../api/jobs'

const STATUS_OPTIONS = ['PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']

export default function Jobs() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [actionLoading, setActionLoading] = useState(null)

  const params = { page, sort_by: sortBy, ...(statusFilter ? { status: statusFilter } : {}) }
  const { jobs, loading, error, pagination, refetch } = useJobs(params)

  const handleAction = async (action, jobId) => {
    setActionLoading(jobId + action)
    try {
      if (action === 'cancel') await cancelJob(jobId)
      else if (action === 'retry') await retryJob(jobId)
      else if (action === 'delete') await deleteJob(jobId)
      await refetch()
    } catch {
      // silently ignore — could show toast
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkCancel = async () => {
    for (const id of selected) await cancelJob(id).catch(() => {})
    setSelected([])
    refetch()
  }

  const toggleSelect = (id) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jobs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{pagination.total} total jobs</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.length > 0 && (
            <button onClick={handleBulkCancel} className="btn-danger text-sm">
              Cancel {selected.length} selected
            </button>
          )}
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="input text-sm w-auto"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            id="filter-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input text-sm w-auto"
          >
            <option value="created_at">Newest</option>
            <option value="priority">Priority</option>
            <option value="execution_time_ms">Execution Time</option>
          </select>
          <button onClick={refetch} className="btn-secondary text-sm">Refresh</button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner w-8 h-8" /></div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium">No jobs found</p>
            <p className="text-sm mt-1">Submit a job to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" onChange={(e) => setSelected(e.target.checked ? jobs.map((j) => j.id) : [])} />
                  </th>
                  {['ID', 'Type', 'Status', 'Priority', 'Submitted', 'Exec Time', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); toggleSelect(job.id) }}>
                      <input type="checkbox" checked={selected.includes(job.id)} onChange={() => {}} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{truncateId(job.id)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{job.task_id ? '—' : '—'}</td>
                    <td className="px-4 py-3"><JobStatusBadge status={job.status} /></td>
                    <td className="px-4 py-3">
                      <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{job.priority}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(job.created_at)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDuration(job.execution_time_ms)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {(job.status === 'PENDING' || job.status === 'QUEUED') && (
                          <button
                            id={`cancel-${job.id}`}
                            onClick={() => handleAction('cancel', job.id)}
                            disabled={actionLoading === job.id + 'cancel'}
                            className="text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                        {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
                          <button
                            id={`retry-${job.id}`}
                            onClick={() => handleAction('retry', job.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 transition-colors"
                          >
                            Retry
                          </button>
                        )}
                        <button
                          id={`delete-${job.id}`}
                          onClick={() => handleAction('delete', job.id)}
                          className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 transition-colors"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="btn-secondary text-sm">← Prev</button>
          <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {pagination.total_pages}</span>
          <button disabled={page === pagination.total_pages} onClick={() => setPage(page + 1)} className="btn-secondary text-sm">Next →</button>
        </div>
      )}
    </div>
  )
}
