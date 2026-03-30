export const formatDate = (iso) => {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export const formatDuration = (ms) => {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

export const truncateId = (id, chars = 8) => {
  if (!id) return ''
  return id.substring(0, chars) + '...'
}

export const successRate = (byStatus) => {
  const completed = byStatus?.COMPLETED || 0
  const failed = byStatus?.FAILED || 0
  const total = completed + failed
  if (total === 0) return '0.0'
  return ((completed / total) * 100).toFixed(1)
}
