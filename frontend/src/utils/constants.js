export const TASK_TYPES = [
  {
    value: 'TEXT_SUMMARIZE',
    label: 'Text Summarize',
    icon: '📝',
    description: 'Condense long text into concise summaries',
  },
  {
    value: 'SENTIMENT_ANALYSIS',
    label: 'Sentiment Analysis',
    icon: '💬',
    description: 'Detect positive, negative, or neutral sentiment',
  },
  {
    value: 'CODE_REVIEW',
    label: 'Code Review',
    icon: '💻',
    description: 'AI-powered code quality and issue analysis',
  },
  {
    value: 'DATA_EXTRACTION',
    label: 'Data Extraction',
    icon: '🔍',
    description: 'Extract structured fields from unstructured text',
  },
  {
    value: 'CUSTOM',
    label: 'Custom Prompt',
    icon: '✨',
    description: 'Send any freeform prompt to Gemini AI',
  },
]

export const JOB_STATUSES = {
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  QUEUED: { label: 'Queued', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  RUNNING: { label: 'Running', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
}

export const PRIORITY_LABELS = {
  1: 'Low', 2: 'Low', 3: 'Low',
  4: 'Medium', 5: 'Medium', 6: 'Medium',
  7: 'High', 8: 'High',
  9: 'Critical', 10: 'Critical',
}
