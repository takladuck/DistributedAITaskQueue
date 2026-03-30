import client from './client'

export const getMetricsSummary = () => client.get('/metrics/summary')
export const getMetricsTimeseries = () => client.get('/metrics/timeseries')
export const getWorkerHealth = () => client.get('/metrics/worker-health')
