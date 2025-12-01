import { useState, useRef, useEffect } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

interface ScannerProps {
  onScan: (result: string) => void
  onClose: () => void
}

export function Scanner({ onScan, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanAttempts, setScanAttempts] = useState(0) // Track scan attempts for user feedback
  const reader = useRef<BrowserMultiFormatReader | null>(null)

  useEffect(() => {
    // Check HTTPS requirement for camera access
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      setError('Camera access requires HTTPS. Please use a secure connection.')
      setIsScanning(false)
      return
    }

    // Initialize reader with hints for better small QR code detection
    reader.current = new BrowserMultiFormatReader()
    
    // Reset scan tracking
    setScanAttempts(0)
    
    const startScanning = async () => {
      try {
        setIsScanning(true)
        setError(null)
        setScanAttempts(0)

        // First, request camera permission explicitly for mobile devices
        // Use higher resolution for better small QR code detection while maintaining performance
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment', // Prefer back camera on mobile
              width: { ideal: 1280, min: 640, max: 1920 }, // Higher resolution for small QR codes
              height: { ideal: 720, min: 480, max: 1080 },
              frameRate: { ideal: 30, max: 30 } // Limit frame rate for better performance
            } 
          })
          // Stop the stream immediately - we'll use the reader's stream
          stream.getTracks().forEach(track => track.stop())
        } catch (permissionError) {
          if (permissionError instanceof Error) {
            if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
              throw new Error('Camera permission denied. Please allow camera access in your browser settings and try again.')
            } else if (permissionError.name === 'NotFoundError' || permissionError.name === 'DevicesNotFoundError') {
              throw new Error('No camera found on this device.')
            } else if (permissionError.name === 'NotReadableError' || permissionError.name === 'TrackStartError') {
              throw new Error('Camera is already in use by another application.')
            }
          }
          throw permissionError
        }
        
        // Wait a bit for video element to be ready
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        
        // Prefer back camera on mobile
        let deviceId = devices[devices.length - 1]?.deviceId
        const backCamera = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('facing back')
        )
        if (backCamera) {
          deviceId = backCamera.deviceId
        } else if (devices.length > 0) {
          deviceId = devices[0].deviceId
        }
        
        if (!deviceId) {
          throw new Error('No camera found. Please check your device permissions.')
        }

        // Ensure video element has required attributes for mobile
        if (videoRef.current) {
          videoRef.current.setAttribute('playsinline', 'true')
          videoRef.current.setAttribute('webkit-playsinline', 'true')
          videoRef.current.muted = true
          videoRef.current.autoplay = true
        }

        // Start decoding from video device with enhanced detection for small QR codes
        await reader.current!.decodeFromVideoDevice(
          deviceId, 
          videoRef.current!, 
          (result, err) => {
            if (result) {
              setScanAttempts(0) // Reset on success
              
              // Stop camera immediately after successful scan
              if (reader.current) {
                try {
                  reader.current.reset()
                } catch (e) {
                  console.warn('Error resetting scanner:', e)
                }
              }
              
              // Stop all video tracks to ensure camera is fully closed
              if (videoRef.current) {
                const stream = videoRef.current.srcObject as MediaStream
                if (stream) {
                  stream.getTracks().forEach(track => {
                    track.stop()
                  })
                  videoRef.current.srcObject = null
                }
              }
              
              setIsScanning(false)
              onScan(result.getText())
            }
            if (err) {
              if (err instanceof Error && err.name === 'NotFoundException') {
                // NotFoundException is normal when no code is detected
                // Increment attempts for user feedback
                setScanAttempts(prev => prev + 1)
              } else {
                console.error('Scan error:', err)
              }
            }
          }
        )
      } catch (err) {
        let errorMessage = 'Failed to start camera'
        
        if (err instanceof Error) {
          if (err.message.includes('permission')) {
            errorMessage = err.message
          } else if (err.message.includes('No camera')) {
            errorMessage = err.message
          } else if (err.message.includes('already in use')) {
            errorMessage = err.message
          } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.'
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMessage = 'No camera found on this device.'
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMessage = 'Camera is already in use. Please close other applications using the camera.'
          } else {
            errorMessage = err.message || errorMessage
          }
        }
        
        setError(errorMessage)
        setIsScanning(false)
        console.error('Camera error:', err)
      }
    }

    startScanning()

    return () => {
      if (reader.current) {
        try {
          reader.current.reset()
        } catch (e) {
          // Ignore reset errors
        }
        reader.current = null
      }
      
      // Stop all video tracks to ensure camera is fully closed
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop()
          })
          videoRef.current.srcObject = null
        }
      }
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between p-4 text-white">
          <h2 className="text-lg font-semibold">Scan Barcode/QR</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-white/20 p-2 hover:bg-white/30"
          >
            ✕
          </button>
        </div>
        
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
            disablePictureInPicture
            controls={false}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`h-48 w-48 border-2 rounded-lg transition-all duration-300 ${
              scanAttempts > 10 
                ? 'border-yellow-400 shadow-lg shadow-yellow-400/50 animate-pulse opacity-100' 
                : 'border-white opacity-50'
            }`} />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500 text-white">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 rounded bg-white/20 px-3 py-1 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {isScanning && !error && (
          <div className="p-4 text-center">
            {scanAttempts > 10 ? (
              <div className="bg-yellow-500/90 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg text-left max-w-md mx-auto">
                <div className="flex items-start gap-3">
                  <InformationCircleIcon className="h-5 w-5 text-yellow-900 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900 mb-1">QR kod bulunamadı</p>
                    <ul className="text-xs text-yellow-800 space-y-1">
                      <li>• QR kodu kameraya daha yakın tutun</li>
                      <li>• Işığın yeterli olduğundan emin olun</li>
                      <li>• QR kodun tamamının görünür olduğundan emin olun</li>
                      <li>• Kamerayı sabit tutun</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : scanAttempts > 5 ? (
              <div className="bg-orange-500/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg text-white">
                <p className="text-xs text-center">
                  QR kod aranıyor... Kamerayı sabit tutun ve QR kodu kare içine hizalayın
                </p>
              </div>
            ) : (
              <p className="text-white">Point camera at barcode or QR code</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
