import client from './client'

export const register = (email, password) =>
  client.post('/auth/register', { email, password })

export const login = (email, password) =>
  client.post('/auth/login', { email, password })

export const refresh = (refresh_token) =>
  client.post('/auth/refresh', { refresh_token })

export const getMe = () => client.get('/auth/me')
