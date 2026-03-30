import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TASK_TYPES, PRIORITY_LABELS } from '../utils/constants'
import { createTask } from '../api/tasks'
import { submitJob } from '../api/jobs'

const LANGUAGE_OPTIONS = ['Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Rust', 'C++', 'C#']

export default function Submit() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState(null)
  const [priority, setPriority] = useState(5)
  const [formData, setFormData] = useState({})
  const [taskName, setTaskName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleTypeSelect = (type) => {
    setSelectedType(type)
    setStep(2)
    setFormData({})
  }

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Create task template + submit job
      const taskRes = await createTask({
        name: taskName || `${selectedType} - ${new Date().toLocaleTimeString()}`,
        task_type: selectedType,
        payload: formData,
      })
      const jobRes = await submitJob(taskRes.data.id, priority)
      navigate(`/jobs/${jobRes.data.id}`)
    } catch (err) {
      setError(err.message || 'Failed to submit job')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Submit Job</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose an AI task type and configure your job</p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Task type selection */}
      <div className="card p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center">1</span>
          Select Task Type
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TASK_TYPES.map((t) => (
            <button
              key={t.value}
              id={`task-type-${t.value}`}
              onClick={() => handleTypeSelect(t.value)}
              className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-100  ${
                selectedType === t.value
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700'
              }`}
            >
              <span className="text-2xl block mb-2">{t.icon}</span>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{t.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Configure */}
      {selectedType && (
        <form onSubmit={handleSubmit} className="space-y-4 animate-slide-up">
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center">2</span>
              Configure Job
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Job Name <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="job-name"
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="input"
                  placeholder="My task..."
                />
              </div>

              {/* Dynamic fields per task type */}
              {(selectedType === 'TEXT_SUMMARIZE' || selectedType === 'SENTIMENT_ANALYSIS') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="field-text"
                    rows={6}
                    className="input font-mono text-sm resize-none"
                    placeholder="Paste your text here..."
                    required
                    onChange={(e) => handleChange('text', e.target.value)}
                  />
                </div>
              )}

              {selectedType === 'TEXT_SUMMARIZE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Length: <span className="text-brand-500 font-bold">{formData.max_length || 150} words</span>
                  </label>
                  <input
                    id="field-max-length"
                    type="range"
                    min={50}
                    max={500}
                    step={10}
                    value={formData.max_length || 150}
                    onChange={(e) => handleChange('max_length', parseInt(e.target.value))}
                    className="w-full accent-brand-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>50 words</span><span>500 words</span>
                  </div>
                </div>
              )}

              {selectedType === 'CODE_REVIEW' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Language</label>
                    <select
                      id="field-language"
                      className="input"
                      onChange={(e) => handleChange('language', e.target.value)}
                      defaultValue="Python"
                    >
                      {LANGUAGE_OPTIONS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Code <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="field-code"
                      rows={10}
                      className="input font-mono text-sm resize-none"
                      placeholder="Paste your code here..."
                      required
                      onChange={(e) => handleChange('code', e.target.value)}
                    />
                  </div>
                </>
              )}

              {selectedType === 'DATA_EXTRACTION' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Text</label>
                    <textarea
                      id="field-text-extract"
                      rows={5}
                      className="input text-sm resize-none"
                      placeholder="Text to extract data from..."
                      required
                      onChange={(e) => handleChange('text', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Fields to Extract <span className="text-xs text-gray-400">(comma separated)</span>
                    </label>
                    <input
                      id="field-fields"
                      type="text"
                      className="input text-sm"
                      placeholder="name, email, phone, date..."
                      required
                      onChange={(e) => handleChange('fields', e.target.value.split(',').map((f) => f.trim()).filter(Boolean))}
                    />
                  </div>
                </>
              )}

              {selectedType === 'CUSTOM' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Prompt <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="field-prompt"
                    rows={8}
                    className="input text-sm resize-none"
                    placeholder="Enter any prompt for Gemini AI..."
                    required
                    onChange={(e) => handleChange('prompt', e.target.value)}
                  />
                </div>
              )}

              {/* Priority slider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority: <span className="text-brand-500 font-bold">{priority} — {PRIORITY_LABELS[priority]}</span>
                </label>
                <input
                  id="field-priority"
                  type="range"
                  min={1}
                  max={10}
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value))}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 — Low</span><span>5 — Medium</span><span>10 — Critical</span>
                </div>
              </div>
            </div>
          </div>

          <button
            id="submit-job-btn"
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            {loading ? <><span className="spinner w-5 h-5" /> Submitting...</> : '🚀 Submit Job'}
          </button>
        </form>
      )}
    </div>
  )
}
