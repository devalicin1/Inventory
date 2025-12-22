import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type Job, saveJobQr, deleteJobQr } from '../../../api/production-jobs'
import { generateQRCodeDataURL, downloadQRCode, copyQRCodeToClipboard } from '../../../utils/qrcode'
import {
  QrCodeIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { Button } from '../../ui/Button'

interface QRCodeTabProps {
  job: Job
  workspaceId: string
}

export function QRCodeTab({ job, workspaceId }: QRCodeTabProps) {
  const [qrData, setQrData] = useState<{
    localUrl?: string
    remoteUrl?: string
    busy?: boolean
    error?: string | null
    success?: boolean
  }>({
    remoteUrl: job.qrUrl || undefined,
    success: false,
  })
  const queryClient = useQueryClient()

  // Update qrData when job prop changes (e.g., after invalidation)
  useEffect(() => {
    const newQrUrl = job.qrUrl || undefined
    setQrData(prev => {
      // Only update remoteUrl if it actually changed and we don't have a localUrl
      if (newQrUrl !== prev.remoteUrl && !prev.localUrl) {
        return {
          ...prev,
          remoteUrl: newQrUrl,
          error: null,
        }
      }
      return prev
    })
  }, [job.qrUrl])

  const generateMutation = useMutation({
    mutationFn: async () => {
      const code = job.code || job.id
      if (!code) {
        throw new Error('Job code or ID is required to generate QR code')
      }
      const res = await generateQRCodeDataURL(`JOB:${code}`)
      return res
    },
    onSuccess: (result) => {
      setQrData(prev => ({
        ...prev,
        localUrl: result.dataUrl,
        error: null,
        busy: false,
        success: false,
      }))
    },
    onError: (error: Error) => {
      setQrData(prev => ({
        ...prev,
        error: error.message,
        busy: false,
      }))
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!qrData.localUrl) {
        throw new Error('No QR code generated')
      }
      return await saveJobQr(workspaceId, job.id, qrData.localUrl)
    },
    onSuccess: (url) => {
      setQrData(prev => ({
        ...prev,
        remoteUrl: url,
        localUrl: undefined,
        error: null,
        busy: false,
        success: true,
      }))
      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })

      // Clear success message after 3 seconds
      setTimeout(() => {
        setQrData(prev => ({
          ...prev,
          success: false,
        }))
      }, 3000)
    },
    onError: (error: Error) => {
      setQrData(prev => ({
        ...prev,
        error: error.message,
        busy: false,
      }))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteJobQr(workspaceId, job.id)
    },
    onSuccess: () => {
      setQrData({
        remoteUrl: undefined,
        localUrl: undefined,
        error: null,
        success: false,
      })
      queryClient.invalidateQueries({ queryKey: ['job', workspaceId, job.id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', workspaceId] })
    },
    onError: (error: Error) => {
      setQrData(prev => ({
        ...prev,
        error: error.message,
      }))
    },
  })

  const handleGenerate = async () => {
    setQrData(prev => ({ ...prev, busy: true, error: null, success: false }))
    generateMutation.mutate()
  }

  const handleSave = () => {
    if (!qrData.localUrl) {
      setQrData(prev => ({
        ...prev,
        error: 'Please generate a QR code first',
      }))
      return
    }

    // Save directly without confirmation modal
    // Old QR code will be automatically replaced in saveJobQr function
    setQrData(prev => ({ ...prev, busy: true, error: null, success: false }))
    saveMutation.mutate()
  }

  const handleDownload = async () => {
    const url = qrData.localUrl || qrData.remoteUrl
    if (url) {
      try {
        const filename = `QR-Code-${job.code || job.id}.png`
        await downloadQRCode(url, filename)
      } catch (error) {
        setQrData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to download QR code',
        }))
      }
    }
  }

  const handleCopy = async () => {
    const url = qrData.localUrl || qrData.remoteUrl
    if (url) {
      try {
        await copyQRCodeToClipboard(url)
        setQrData(prev => ({ ...prev, error: null }))
      } catch (error) {
        setQrData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to copy to clipboard',
        }))
      }
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this QR code?')) {
      deleteMutation.mutate()
    }
  }

  const isLoading = qrData.busy || generateMutation.isPending || saveMutation.isPending || deleteMutation.isPending
  const hasQRCode = !!(qrData.localUrl || qrData.remoteUrl)

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* QR Code Display */}
        <div className="p-8 flex flex-col items-center justify-center border-b border-gray-100 bg-gray-50/50">
          {hasQRCode ? (
            <img
              src={qrData.localUrl || qrData.remoteUrl || ''}
              alt="QR Code"
              className="w-64 h-64 object-contain bg-white p-4 rounded-xl shadow-sm border border-gray-100"
            />
          ) : (
            <div className="w-64 h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 border border-dashed border-gray-300">
              <div className="text-center">
                <QrCodeIcon className="h-16 w-16 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No QR Code</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 bg-white space-y-4">
          {/* Error Message */}
          {qrData.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{qrData.error}</p>
            </div>
          )}

          {/* Success Message */}
          {qrData.success && !qrData.error && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">QR code saved successfully!</p>
            </div>
          )}

          {/* Job Info */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-900 mb-1">Job Code</p>
            <p className="text-lg font-mono text-gray-700">{job.code || job.id}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {!hasQRCode ? (
              <Button
                onClick={handleGenerate}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <QrCodeIcon className="h-5 w-5" />
                Generate QR Code
              </Button>
            ) : (
              <>
                {qrData.localUrl && (
                  <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    Save QR Code
                  </Button>
                )}
                {!qrData.localUrl && (
                  <Button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <ArrowPathIcon className="h-5 w-5" />
                    Regenerate
                  </Button>
                )}
                <Button
                  onClick={handleDownload}
                  disabled={!hasQRCode || isLoading}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  Download
                </Button>
                <Button
                  onClick={handleCopy}
                  disabled={!hasQRCode || isLoading}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <DocumentDuplicateIcon className="h-5 w-5" />
                  Copy
                </Button>
                {qrData.remoteUrl && (
                  <Button
                    onClick={handleDelete}
                    disabled={isLoading || deleteMutation.isPending}
                    variant="secondary"
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <TrashIcon className="h-5 w-5" />
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Info Text */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> QR code is generated from the job code. If you regenerate the QR code,
              the old one will be replaced automatically when you save.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

