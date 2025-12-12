import { useEffect, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { ScanMode } from '../types'

interface UseCameraScannerProps {
  scanMode: ScanMode
  videoRef: React.RefObject<HTMLVideoElement | null>
  setIsScanning: (isScanning: boolean) => void
  setCameraError: (error: string | null) => void
  setScanAttempts: (attempts: number | ((prev: number) => number)) => void
  setLastScanTime: (time: number) => void
  setLastScannedCode: (code: string | null) => void
  lastScannedCode: string | null
  onScanSuccess: (code: string) => void
  enabled?: boolean
}

export function useCameraScanner({
  scanMode,
  videoRef,
  setIsScanning,
  setCameraError,
  setScanAttempts,
  setLastScanTime,
  setLastScannedCode,
  lastScannedCode,
  onScanSuccess,
  enabled = true,
}: UseCameraScannerProps) {
  const reader = useRef<BrowserMultiFormatReader | null>(null)
  const hasProcessedScan = useRef(false)

  useEffect(() => {
    if (!enabled || scanMode !== 'camera' || !videoRef.current) {
      if (reader.current) {
        try {
          ;(reader.current as any).reset()
        } catch (e) {
          // Ignore reset errors
        }
        reader.current = null
      }
      setIsScanning(false)
      setCameraError(null)
      hasProcessedScan.current = false
      return
    }

    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      setCameraError('Camera access requires HTTPS. Please use a secure connection.')
      setIsScanning(false)
      return
    }

    if (reader.current) {
      try {
        ;(reader.current as any).reset()
      } catch (e) {
        console.warn('Error resetting existing scanner:', e)
      }
      reader.current = null
    }
    
    if (videoRef.current) {
      const existingStream = videoRef.current.srcObject as MediaStream
      if (existingStream) {
        existingStream.getTracks().forEach(track => {
          track.stop()
        })
        videoRef.current.srcObject = null
      }
    }
    
    reader.current = new BrowserMultiFormatReader()
    setScanAttempts(0)
    setLastScanTime(Date.now())
    hasProcessedScan.current = false
    
    const startScanning = async () => {
      try {
        setIsScanning(true)
        setCameraError(null)

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280, min: 640, max: 1920 },
              height: { ideal: 720, min: 480, max: 1080 },
              frameRate: { ideal: 30, max: 30 }
            } 
          })
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
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        
        if (devices.length === 0) {
          throw new Error('No camera found. Please check your device permissions.')
        }

        let deviceId = devices[devices.length - 1]?.deviceId
        const backCamera = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('facing back')
        )
        if (backCamera) {
          deviceId = backCamera.deviceId
        } else if (devices.length > 1) {
          deviceId = devices[devices.length - 1].deviceId
        } else if (devices.length > 0) {
          deviceId = devices[0].deviceId
        }

        if (!deviceId || !videoRef.current) {
          throw new Error('Camera not available')
        }

        if (videoRef.current) {
          videoRef.current.setAttribute('playsinline', 'true')
          videoRef.current.setAttribute('webkit-playsinline', 'true')
          videoRef.current.muted = true
          videoRef.current.autoplay = true
        }

        await reader.current!.decodeFromVideoDevice(
          deviceId, 
          videoRef.current, 
          (result, err) => {
            if (result) {
              if (hasProcessedScan.current) {
                return
              }
              hasProcessedScan.current = true

              const scannedCode = result.getText().trim()
              
              if (lastScannedCode === scannedCode) {
                return
              }
              
              setLastScannedCode(scannedCode)
              setScanAttempts(0)
              setLastScanTime(Date.now())
              
              if (videoRef.current) {
                const stream = videoRef.current.srcObject as MediaStream
                if (stream) {
                  stream.getTracks().forEach(track => {
                    track.stop()
                  })
                  videoRef.current.srcObject = null
                }
              }
              
              if (reader.current) {
                try {
                  ;(reader.current as any).reset()
                } catch (e) {
                  console.warn('Error resetting scanner:', e)
                }
                reader.current = null
              }
              
              setIsScanning(false)
              
              setTimeout(() => {
                hasProcessedScan.current = false
              }, 100)
              
              onScanSuccess(scannedCode)
              
              setTimeout(() => {
                setLastScannedCode(null)
              }, 3000)
            }
            if (err) {
              if (err instanceof Error && err.name === 'NotFoundException') {
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
        
        setCameraError(errorMessage)
        setIsScanning(false)
        console.error('Camera error:', err)
      }
    }

    startScanning()

    return () => {
      if (reader.current) {
        try {
          ;(reader.current as any).reset()
        } catch (e) {
          console.warn('Error resetting scanner:', e)
        }
        reader.current = null
      }
      
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
      setCameraError(null)
    }
  }, [enabled, scanMode, videoRef, setIsScanning, setCameraError, setScanAttempts, setLastScanTime, setLastScannedCode, lastScannedCode, onScanSuccess])
}

