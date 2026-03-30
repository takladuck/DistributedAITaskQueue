import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listTasks, createTask, deleteTask } from '../api/tasks'
import { TASK_TYPES } from '../utils/constants'
import { formatDate } from '../utils/formatters'
import { useEffect } from 'react'

export default function Tasks() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', task_type: 'CUSTOM', payload: '{}' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const res = await listTasks()
      setTasks(res.data.items || [])
    } catch {
      setError('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTasks() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let payload = {}
      try { payload = JSON.parse(formData.payload) } catch { payload = {} }
      await createTask({ ...formData, payload })
      setShowForm(false)
      setFormData({ name: '', description: '', task_type: 'CUSTOM', payload: '{}' })
      fetchTasks()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    await deleteTask(id).catch(() => {})
    fetchTasks()
  }

  const typeInfo = (type) => TASK_TYPES.find((t) => t.value === type)

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Saved task templates</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card p-6 mb-6 animate-slide-up space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Create Task Template</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name *</label>
            <input id="task-name" required className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="My task template" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <input id="task-desc" className="input" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="What does this task do?" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
            <select id="task-type-sel" className="input" value={formData.task_type} onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}>
              {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Payload (JSON)</label>
            <textarea id="task-payload" rows={4} className="input font-mono text-sm resize-none" value={formData.payload} onChange={(e) => setFormData({ ...formData, payload: e.target.value })} />
          </div>
          <button id="create-task-btn" type="submit" disabled={submitting} className="btn-primary">
            {submitting ? <span className="spinner w-4 h-4" /> : 'Create Task'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner w-8 h-8" /></div>
      ) : tasks.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🗂️</p>
          <p className="font-medium">No task templates yet</p>
          <p className="text-sm mt-1">Create one above to quickly reuse your tasks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => {
            const info = typeInfo(task.task_type)
            return (
              <div key={task.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{info?.icon || '📄'}</span>
                  <div className="flex gap-1">
                    <button
                      id={`use-task-${task.id}`}
                      onClick={() => navigate('/submit', { state: { task } })}
                      className="text-xs px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 transition-colors font-medium"
                    >
                      Use
                    </button>
                    <button
                      id={`del-task-${task.id}`}
                      onClick={() => handleDelete(task.id)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                      Del
                    </button>
                  </div>
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">{task.name}</p>
                {task.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>}
                <p className="text-xs text-gray-400 mt-3">{info?.label} · {formatDate(task.created_at)}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
