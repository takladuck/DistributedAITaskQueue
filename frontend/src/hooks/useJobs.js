import { useState, useEffect, useCallback } from 'react'
import * as jobsApi from '../api/jobs'

export function useJobs(params = {}) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ total: 0, page: 1, per_page: 20, total_pages: 1 })

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await jobsApi.listJobs(params)
      const { items, ...pag } = res.data
      setJobs(items)
      setPagination(pag)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(params)])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  return { jobs, loading, error, pagination, refetch: fetchJobs }
}
