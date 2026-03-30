import client from './client'

export const listJobs = (params) => client.get('/jobs', { params })
export const getJob = (id) => client.get(`/jobs/${id}`)
export const submitJob = (taskId, priority) =>
  client.post('/jobs', { task_id: taskId, priority })
export const cancelJob = (id) => client.post(`/jobs/${id}/cancel`)
export const retryJob = (id) => client.post(`/jobs/${id}/retry`)
export const deleteJob = (id) => client.delete(`/jobs/${id}`)
