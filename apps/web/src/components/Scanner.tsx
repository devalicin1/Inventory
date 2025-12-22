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
        {/* Glass morphism header */}
        <div className="flex items-center justify-between p-4 sm:p-5 bg-black/40 backdrop-blur-xl border-b border-white/10">
          <h2 className="text-lg sm:text-xl font-bold text-white">Scan Barcode/QR</h2>
          <button
            onClick={onClose}
            className="rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md p-2.5 sm:p-3 active:scale-95 transition-all duration-200 border border-white/20 shadow-lg"
          >
            <span className="text-white text-lg sm:text-xl font-bold">✕</span>
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
          {/* Glass morphism scan frame */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="absolute inset-0 bg-black/50" />
            <div className={`relative h-64 w-64 sm:h-72 sm:w-72 transition-all duration-300 ${
              scanAttempts > 10 
                ? 'opacity-100' 
                : 'opacity-80'
            }`}>
              <div className="absolute inset-0 bg-transparent rounded-2xl" style={{ 
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' 
              }} />
              {/* Corner indicators */}
              <div className={`absolute -top-1 -left-1 w-10 h-10 sm:w-12 sm:h-12 border-t-4 border-l-4 rounded-tl-2xl transition-colors duration-300 ${
                scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
              }`} />
              <div className={`absolute -top-1 -right-1 w-10 h-10 sm:w-12 sm:h-12 border-t-4 border-r-4 rounded-tr-2xl transition-colors duration-300 ${
                scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
              }`} />
              <div className={`absolute -bottom-1 -left-1 w-10 h-10 sm:w-12 sm:h-12 border-b-4 border-l-4 rounded-bl-2xl transition-colors duration-300 ${
                scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
              }`} />
              <div className={`absolute -bottom-1 -right-1 w-10 h-10 sm:w-12 sm:h-12 border-b-4 border-r-4 rounded-br-2xl transition-colors duration-300 ${
                scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
              }`} />
              {isScanning && scanAttempts <= 10 && (
                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse" />
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 sm:p-5 bg-gradient-to-br from-red-500/90 to-red-600/90 backdrop-blur-xl border-t border-white/20">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 max-w-md mx-auto">
              <p className="text-white font-semibold mb-3">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-white font-semibold text-sm active:scale-95 transition-all border border-white/30 shadow-lg"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {isScanning && !error && (
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 z-20">
            {scanAttempts > 10 ? (
              <div className="bg-gradient-to-br from-yellow-400/95 to-orange-500/95 backdrop-blur-xl px-5 sm:px-6 py-4 sm:py-5 rounded-2xl sm:rounded-3xl shadow-2xl border border-yellow-300/30 max-w-md mx-auto">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center flex-shrink-0 border border-white/20">
                    <InformationCircleIcon className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-900" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm sm:text-base font-bold text-yellow-900 mb-2">QR code not found</p>
                    <ul className="text-xs sm:text-sm text-yellow-800 space-y-1 font-medium">
                      <li>• Move code closer to camera</li>
                      <li>• Ensure good lighting</li>
                      <li>• Make sure code is fully visible</li>
                      <li>• Hold camera steady</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : scanAttempts > 5 ? (
              <div className="bg-gradient-to-r from-orange-500/90 to-amber-500/90 backdrop-blur-xl px-5 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-3xl shadow-2xl border border-orange-300/30 max-w-md mx-auto">
                <p className="text-sm sm:text-base text-white text-center font-semibold">
                  🔍 Searching... Hold steady and align code in frame
                </p>
              </div>
            ) : (
              <div className="bg-black/60 backdrop-blur-xl px-5 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl max-w-md mx-auto">
                <p className="text-sm sm:text-base text-white text-center font-semibold">
                  📷 Point camera at barcode or QR code
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
