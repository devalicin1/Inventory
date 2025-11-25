import { type FC } from 'react'
import { DocumentTextIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import type { Job } from '../../../api/production-jobs'

interface FilesTabProps {
  job: Job
}

export const FilesTab: FC<FilesTabProps> = ({ job }) => {
  const files: Array<{ name: string; url: string; type: string; size?: string }> = []

  if ((job as any).jobPdfUrl) {
    files.push({
      name: `Production Job Order - ${job.code || job.id}.pdf`,
      url: (job as any).jobPdfUrl,
      type: 'pdf',
    })
  }

  if (job.qrUrl) {
    files.push({
      name: `QR Code - ${job.code || job.id}.png`,
      url: job.qrUrl,
      type: 'image',
    })
  }

  if (job.barcodeUrl) {
    files.push({
      name: `Barcode - ${job.code || job.id}.png`,
      url: job.barcodeUrl,
      type: 'image',
    })
  }

  const getFileIcon = (type: string) => {
    if (type === 'pdf') {
      return <DocumentTextIcon className="h-8 w-8 text-red-500" />
    }
    return <DocumentTextIcon className="h-8 w-8 text-blue-500" />
  }

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8">
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No files attached</h3>
        <p className="mt-1 text-sm text-gray-500">Files and attachments will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Files</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {file.type.toUpperCase()} • {file.size || 'Automatically generated'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(file.url, '_blank')}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="View"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDownload(file.url, file.name)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Download"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

