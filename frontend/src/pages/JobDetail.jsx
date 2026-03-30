import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { getJob } from '../api/jobs'
import { cancelJob, retryJob } from '../api/jobs'
import { useJobWebSocket } from '../hooks/useWebSocket'
import JobStatusBadge from '../components/JobStatusBadge'
import { formatDate, formatDuration } from '../utils/formatters'

const STEPS = ['Submitted', 'Queued', 'Running', 'Processing', 'Done']
const STATUS_STEP = { PENDING: 0, QUEUED: 1, RUNNING: 2, COMPLETED: 4, FAILED: 4, CANCELLED: 0 }

function ProgressStep({ label, index, currentStep, status }) {
  const isDone = index < currentStep || (index === 4 && status === 'COMPLETED')
  const isActive = index === currentStep && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)
  const isFailed = index === currentStep && status === 'FAILED'

  return (
    <div className="flex flex-col items-center flex-1">
      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
        isDone ? 'border-green-500 bg-green-500 text-white' :
        isActive ? 'border-brand-500 bg-brand-50 dark:bg-brand-950 text-brand-600 animate-pulse-fast' :
        isFailed ? 'border-red-500 bg-red-500 text-white' :
        'border-gray-200 dark:border-gray-700 text-gray-400'
      }`}>
        {isDone ? '✓' : index + 1}
      </div>
      <span className={`text-xs mt-1 font-medium ${isActive ? 'text-brand-600 dark:text-brand-400' : isDone ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}

function ResultRenderer({ job }) {
  const { result, status, error_message } = job

  if (status === 'FAILED') {
    return (
      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <p className="font-semibold text-red-700 dark:text-red-400 mb-1">Error</p>
        <p className="text-sm text-red-600 dark:text-red-300 font-mono">{error_message}</p>
      </div>
    )
  }

  if (!result) return null

  // TEXT_SUMMARIZE
  if (result.summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Summary</p>
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{result.summary}</p>
          <p className="text-xs text-gray-400 mt-2">{result.summary_length} words</p>
        </div>
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Stats</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Original: <b>{result.original_length}</b> words</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Summary: <b>{result.summary_length}</b> words</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Reduction: <b>{result.original_length > 0 ? Math.round((1 - result.summary_length / result.original_length) * 100) : 0}%</b>
          </p>
        </div>
      </div>
    )
  }

  // SENTIMENT_ANALYSIS
  if (result.sentiment) {
    const colors = { POSITIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', NEGATIVE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', NEUTRAL: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' }
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold px-4 py-2 rounded-xl ${colors[result.sentiment] || colors.NEUTRAL}`}>{result.sentiment}</span>
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Confidence: {Math.round((result.confidence || 0) * 100)}%</p>
            <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full">
              <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(result.confidence || 0) * 100}%` }} />
            </div>
          </div>
        </div>
        {result.key_phrases?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {result.key_phrases.map((phrase, i) => (
              <span key={i} className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{phrase}</span>
            ))}
          </div>
        )}
        {result.brief_explanation && <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{result.brief_explanation}"</p>}
      </div>
    )
  }

  // CODE_REVIEW
  if (result.issues !== undefined) {
    const severityColor = { ERROR: 'text-red-600 bg-red-50 dark:bg-red-900/20', WARNING: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20', INFO: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' }
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">Score:</p>
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{result.score}/10</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{result.summary}</p>
        {result.issues?.length > 0 && (
          <div className="space-y-2">
            {result.issues.map((issue, i) => (
              <div key={i} className={`flex gap-3 p-3 rounded-lg text-sm ${severityColor[issue.severity] || 'bg-gray-50'}`}>
                <span className="font-semibold shrink-0">L{issue.line}</span>
                <span className="font-semibold shrink-0">[{issue.severity}]</span>
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        )}
        {result.suggestions?.map((s, i) => (
          <p key={i} className="text-sm text-gray-600 dark:text-gray-300">💡 {s}</p>
        ))}
      </div>
    )
  }

  // DATA_EXTRACTION
  if (result && typeof result === 'object' && !result.response) {
    return (
      <table className="w-full text-sm border-collapse">
        <tbody>
          {Object.entries(result).map(([k, v]) => (
            <tr key={k} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2 pr-4 font-semibold text-gray-700 dark:text-gray-300 capitalize">{k}</td>
              <td className="py-2 text-gray-600 dark:text-gray-400">{v === null ? <span className="text-gray-400 italic">Not found</span> : String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  // CUSTOM
  if (result.response) {
    return <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{result.response}</ReactMarkdown></div>
  }

  return <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-4 rounded-xl overflow-auto">{JSON.stringify(result, null, 2)}</pre>
}

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchJob = useCallback(async () => {
    try {
      const res = await getJob(id)
      setJob(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchJob() }, [fetchJob])

  // Tick elapsed time while RUNNING
  useEffect(() => {
    if (job?.status !== 'RUNNING' || !job?.started_at) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(job.started_at).getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [job?.status, job?.started_at])

  // Live WebSocket updates
  useJobWebSocket(id, (data) => {
    if (data.event === 'status_update' && data.job_id === id) {
      setJob((prev) => prev ? { ...prev, status: data.status, result: data.result ?? prev.result, error_message: data.error ?? prev.error_message } : prev)
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(data.status)) fetchJob()
    }
  })

  const handleCancel = async () => {
    setActionLoading(true)
    try { await cancelJob(id); await fetchJob() } catch { } finally { setActionLoading(false) }
  }

  const handleRetry = async () => {
    setActionLoading(true)
    try { await retryJob(id); await fetchJob() } catch { } finally { setActionLoading(false) }
  }

  const copyResult = () => {
    navigator.clipboard.writeText(JSON.stringify(job?.result, null, 2))
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="spinner w-10 h-10" /></div>
  if (error || !job) return <div className="p-6 text-red-500">{error || 'Job not found'}</div>

  const currentStep = STATUS_STEP[job.status] ?? 0

  return (
    <div className="p-6 max-w-3xl mx-auto animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/jobs')} className="btn-secondary text-sm">← Back</button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white font-mono">{id.substring(0, 8)}...</h1>
            <JobStatusBadge status={job.status} />
            <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
              Priority {job.priority}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(job.status === 'PENDING' || job.status === 'QUEUED') && (
            <button onClick={handleCancel} disabled={actionLoading} className="btn-danger text-sm">Cancel</button>
          )}
          {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
            <button onClick={handleRetry} disabled={actionLoading} className="btn-primary text-sm">Retry</button>
          )}
          {job.result && (
            <button onClick={copyResult} className="btn-secondary text-sm">Copy JSON</button>
          )}
        </div>
      </div>

      {/* Progress tracker */}
      <div className="card p-6">
        <div className="flex items-center mb-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <ProgressStep label={label} index={i} currentStep={currentStep} status={job.status} />
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 transition-all ${i < currentStep ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>
        {job.status === 'RUNNING' && (
          <div className="flex items-center gap-3 mt-4 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20">
            <div className="spinner w-5 h-5" />
            <span className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
              AI is processing... ({elapsed}s elapsed)
            </span>
          </div>
        )}
      </div>

      {/* Result */}
      {(job.result || job.error_message) && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Result</h2>
          <ResultRenderer job={job} />
        </div>
      )}

      {/* Metadata */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Execution Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            ['Created', formatDate(job.created_at)],
            ['Queued', formatDate(job.queued_at)],
            ['Started', formatDate(job.started_at)],
            ['Completed', formatDate(job.completed_at)],
            ['Exec Time', formatDuration(job.execution_time_ms)],
            ['Retry Count', `${job.retry_count} / ${job.max_retries}`],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-gray-400 text-xs mb-0.5">{label}</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
