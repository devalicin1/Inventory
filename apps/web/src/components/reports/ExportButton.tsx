import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

interface ExportButtonProps {
  onExport: () => void
  isLoading?: boolean
  disabled?: boolean
  filename?: string
}

export function ExportButton({ 
  onExport, 
  isLoading = false, 
  disabled = false,
  filename = 'report'
}: ExportButtonProps) {
  return (
    <button
      onClick={onExport}
      disabled={disabled || isLoading}
      className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
        disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
      {isLoading ? 'Exporting...' : `Export ${filename}`}
    </button>
  )
}
