import { type FC, useState, useRef } from 'react'
import { 
  DocumentTextIcon, 
  ArrowDownTrayIcon, 
  ArrowUpTrayIcon,
  TrashIcon,
  PhotoIcon,
  DocumentIcon,
  FolderIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import type { Job, JobAttachment } from '../../../api/production-jobs'
import { uploadJobAttachment, deleteJobAttachment } from '../../../api/production-jobs'
import { useSessionStore } from '../../../state/sessionStore'

interface FilesTabProps {
  job: Job
  onJobUpdate?: () => void
}

// Attachment categories configuration
const ATTACHMENT_CATEGORIES = [
  { id: 'invoice', label: 'Invoice', icon: DocumentTextIcon, color: 'text-green-600 bg-green-50 border-green-200' },
  { id: 'artwork', label: 'Artwork', icon: PhotoIcon, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'spec', label: 'Specification', icon: DocumentIcon, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'other', label: 'Other', icon: FolderIcon, color: 'text-gray-600 bg-gray-50 border-gray-200' },
]

interface UploadState {
  isUploading: boolean
  progress: number
  fileName: string | null
  status: 'idle' | 'uploading' | 'success' | 'error'
  message: string | null
}

export const FilesTab: FC<FilesTabProps> = ({ job, onJobUpdate }) => {
  const { workspaceId } = useSessionStore()
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    fileName: null,
    status: 'idle',
    message: null
  })
  const [attachments, setAttachments] = useState<JobAttachment[]>(job.attachments || [])
  const [selectedCategory, setSelectedCategory] = useState<string>('invoice')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // System generated files (non-deletable)
  const systemFiles: Array<{ name: string; url: string; type: string; category: string }> = []

  if ((job as any).jobPdfUrl) {
    systemFiles.push({
      name: `Production Job Order - ${job.code || job.id}.pdf`,
      url: (job as any).jobPdfUrl,
      type: 'pdf',
      category: 'system',
    })
  }

  if (job.qrUrl) {
    systemFiles.push({
      name: `QR Code - ${job.code || job.id}.png`,
      url: job.qrUrl,
      type: 'image',
      category: 'system',
    })
  }

  if (job.barcodeUrl) {
    systemFiles.push({
      name: `Barcode - ${job.code || job.id}.png`,
      url: job.barcodeUrl,
      type: 'image',
      category: 'system',
    })
  }

  // Group attachments by category
  const groupedAttachments = ATTACHMENT_CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = attachments.filter(a => a.category === cat.id)
    return acc
  }, {} as Record<string, JobAttachment[]>)

  const getFileIcon = (type: string, size: 'sm' | 'lg' = 'lg') => {
    const sizeClass = size === 'sm' ? 'h-5 w-5' : 'h-8 w-8'
    if (type === 'pdf') {
      return <DocumentTextIcon className={`${sizeClass} text-red-500`} />
    }
    if (type === 'image') {
      return <PhotoIcon className={`${sizeClass} text-blue-500`} />
    }
    return <DocumentIcon className={`${sizeClass} text-gray-500`} />
  }

  const getCategoryConfig = (categoryId: string) => {
    return ATTACHMENT_CATEGORIES.find(c => c.id === categoryId) || ATTACHMENT_CATEGORIES[3]
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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !workspaceId || !job.id) return

    // Start upload
    setUploadState({
      isUploading: true,
      progress: 0,
      fileName: file.name,
      status: 'uploading',
      message: 'Preparing upload...'
    })

    // Simulate progress (since Firebase doesn't provide upload progress for small files easily)
    const progressInterval = setInterval(() => {
      setUploadState(prev => ({
        ...prev,
        progress: Math.min(prev.progress + 15, 90),
        message: prev.progress < 30 ? 'Uploading file...' : prev.progress < 60 ? 'Processing...' : 'Almost done...'
      }))
    }, 200)

    try {
      const uploaded = await uploadJobAttachment(workspaceId, job.id, file, selectedCategory)
      
      clearInterval(progressInterval)
      setUploadState({
        isUploading: false,
        progress: 100,
        fileName: file.name,
        status: 'success',
        message: 'File uploaded successfully!'
      })
      
      setAttachments(prev => [...prev, uploaded])
      onJobUpdate?.()

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadState({
          isUploading: false,
          progress: 0,
          fileName: null,
          status: 'idle',
          message: null
        })
      }, 3000)

    } catch (err) {
      clearInterval(progressInterval)
      console.error('File upload failed', err)
      setUploadState({
        isUploading: false,
        progress: 0,
        fileName: file.name,
        status: 'error',
        message: 'Upload failed. Please try again.'
      })
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (attachment: JobAttachment) => {
    if (!workspaceId || !job.id) return

    setDeletingId(attachment.id)
    try {
      await deleteJobAttachment(workspaceId, job.id, attachment)
      setAttachments(prev => prev.filter(a => a.id !== attachment.id))
      onJobUpdate?.()
    } catch (err) {
      console.error('Delete failed', err)
      alert('Failed to delete file. Please try again.')
    } finally {
      setDeletingId(null)
      setShowDeleteConfirm(null)
    }
  }

  const totalAttachments = attachments.length

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Document Files</h3>
              <p className="text-sm text-gray-600 mt-1">
                Attach invoices, artwork, specifications or any related documents to this job.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Category Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type:</span>
                <select
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={uploadState.isUploading}
                >
                  {ATTACHMENT_CATEGORIES.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Upload Button */}
              <label className={`
                inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg shadow-sm cursor-pointer transition-all
                ${uploadState.isUploading 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                }
              `}>
                <ArrowUpTrayIcon className="h-4 w-4" />
                <span>{uploadState.isUploading ? 'Uploading...' : 'Upload File'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploadState.isUploading || !workspaceId}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Upload Progress */}
        {uploadState.status !== 'idle' && (
          <div className={`p-4 border-b ${
            uploadState.status === 'success' ? 'bg-green-50 border-green-100' :
            uploadState.status === 'error' ? 'bg-red-50 border-red-100' :
            'bg-blue-50 border-blue-100'
          }`}>
            <div className="flex items-center gap-3">
              {uploadState.status === 'uploading' && (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
              )}
              {uploadState.status === 'success' && (
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              )}
              {uploadState.status === 'error' && (
                <ExclamationCircleIcon className="h-5 w-5 text-red-600" />
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-sm font-medium truncate ${
                    uploadState.status === 'success' ? 'text-green-700' :
                    uploadState.status === 'error' ? 'text-red-700' :
                    'text-blue-700'
                  }`}>
                    {uploadState.fileName}
                  </p>
                  {uploadState.status === 'uploading' && (
                    <span className="text-xs text-blue-600 ml-2">{uploadState.progress}%</span>
                  )}
                </div>
                
                {uploadState.status === 'uploading' && (
                  <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadState.progress}%` }}
                    />
                  </div>
                )}
                
                <p className={`text-xs mt-1 ${
                  uploadState.status === 'success' ? 'text-green-600' :
                  uploadState.status === 'error' ? 'text-red-600' :
                  'text-blue-600'
                }`}>
                  {uploadState.message}
                </p>
              </div>

              {(uploadState.status === 'success' || uploadState.status === 'error') && (
                <button
                  onClick={() => setUploadState({ ...uploadState, status: 'idle', message: null })}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              <span className="font-semibold text-gray-900">{totalAttachments}</span> uploaded files
            </span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-600">
              <span className="font-semibold text-gray-900">{systemFiles.length}</span> system files
            </span>
          </div>
        </div>
      </div>

      {/* System Generated Files */}
      {systemFiles.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FolderIcon className="h-4 w-4" />
              System Generated Files
            </h4>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {systemFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(file.type, 'sm')}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{file.type.toUpperCase()} • Auto-generated</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => window.open(file.url, '_blank')}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDownload(file.url, file.name)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Download"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Files by Category */}
      {ATTACHMENT_CATEGORIES.map(category => {
        const categoryAttachments = groupedAttachments[category.id] || []
        if (categoryAttachments.length === 0) return null

        const CategoryIcon = category.icon
        const catConfig = getCategoryConfig(category.id)

        return (
          <div key={category.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className={`px-5 py-3 border-b flex items-center justify-between ${catConfig.color}`}>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CategoryIcon className="h-4 w-4" />
                {category.label}
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/60">
                  {categoryAttachments.length}
                </span>
              </h4>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(att.fileType, 'sm')}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{att.name}</p>
                        <p className="text-xs text-gray-500">
                          {att.fileType.toUpperCase()} • {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Uploaded'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => window.open(att.url, '_blank')}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDownload(att.url, att.name)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(att.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                        disabled={deletingId === att.id}
                      >
                        {deletingId === att.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent" />
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Delete Confirmation */}
                    {showDeleteConfirm === att.id && (
                      <div className="absolute inset-0 bg-white/95 flex items-center justify-center rounded-lg border-2 border-red-200">
                        <div className="text-center p-4">
                          <p className="text-sm font-medium text-gray-900 mb-3">Delete this file?</p>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(att)}
                              className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {/* Empty State */}
      {totalAttachments === 0 && systemFiles.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">No files yet</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
            Get started by uploading invoices, artwork, specifications or any other documents related to this job.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            Upload your first file
          </button>
        </div>
      )}
    </div>
  )
}
