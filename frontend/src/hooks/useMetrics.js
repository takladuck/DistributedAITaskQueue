import { useState, useEffect, useCallback } from 'react'
import * as metricsApi from '../api/metrics'

export function useMetrics(autoRefreshMs = 0) {
  const [summary, setSummary] = useState(null)
  const [timeseries, setTimeseries] = useState([])
  const [workerHealth, setWorkerHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setError(null)
    try {
      const [sumRes, tsRes, whRes] = await Promise.all([
        metricsApi.getMetricsSummary(),
        metricsApi.getMetricsTimeseries(),
        metricsApi.getWorkerHealth(),
      ])
      setSummary(sumRes.data.data)
      setTimeseries(tsRes.data.data)
      setWorkerHealth(whRes.data.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    if (autoRefreshMs > 0) {
      const interval = setInterval(fetchAll, autoRefreshMs)
      return () => clearInterval(interval)
    }
  }, [fetchAll, autoRefreshMs])

  return { summary, timeseries, workerHealth, loading, error, refetch: fetchAll }
}
