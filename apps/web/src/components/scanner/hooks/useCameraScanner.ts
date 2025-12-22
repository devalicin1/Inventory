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

  // 1. Stable Refs to avoid restarting the effect when these change
  const onScanSuccessRef = useRef(onScanSuccess)
  const lastScannedCodeRef = useRef(lastScannedCode)
  const scanAttemptsRef = useRef(0) // Internal tracking to avoid state dependency

  // Keep refs synced
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess
  }, [onScanSuccess])

  useEffect(() => {
    lastScannedCodeRef.current = lastScannedCode
  }, [lastScannedCode])

  // Reset internal attempts when enabled toggles
  useEffect(() => {
    if (enabled) {
      scanAttemptsRef.current = 0
    }
  }, [enabled])

  useEffect(() => {
    // 2. Minimal Dependency Array
    // Only restart if:
    // - enabled status changes
    // - scanMode changes (camera vs manual)
    // - video element is re-created
    if (!enabled || scanMode !== 'camera' || !videoRef.current) {
      if (reader.current) {
        try {
          // Use type assertion for undocumented reset method if needed, or just standard cleanup
          (reader.current as any).reset()
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
      setCameraError('Camera access requires HTTPS.')
      setIsScanning(false)
      return
    }

    let isMounted = true // 3. Concurrency Safety

    // Cleanup existing reader
    if (reader.current) {
      try {
        (reader.current as any).reset()
      } catch (e) { }
      reader.current = null
    }

    // Cleanup existing stream manually to be safe
    if (videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }

    reader.current = new BrowserMultiFormatReader()
    hasProcessedScan.current = false
    setLastScanTime(Date.now())

    const startScanning = async () => {
      if (!isMounted) return
      setIsScanning(true)
      setCameraError(null)

      if (!videoRef.current) return

      // Mobile video attributes
      videoRef.current.setAttribute('playsinline', 'true')
      videoRef.current.setAttribute('webkit-playsinline', 'true')
      videoRef.current.muted = true
      videoRef.current.autoplay = true

      const handleScanResult = (result: any, err: any) => {
        if (!isMounted) return

        if (result) {
          if (hasProcessedScan.current) return

          const scannedCode = result.getText().trim()

          // Compare with REF, not state dependency
          if (lastScannedCodeRef.current === scannedCode) return

          hasProcessedScan.current = true

          // Update state (will trigger re-render but NOT re-run of this effect)
          setLastScannedCode(scannedCode)
          setLastScanTime(Date.now())

          // Stop the stream? User requested stability. 
          // If we stop stream here, we might need to restart it later manually.
          // For now, let's keep the behavior of "Scan -> Success -> Close/Pause"
          // But perform cleanup safely.

          if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream
            stream.getTracks().forEach(t => t.stop())
            videoRef.current.srcObject = null
          }

          if (reader.current) {
            (reader.current as any).reset()
            reader.current = null
          }

          setIsScanning(false)

          // Debounce flag reset
          setTimeout(() => {
            if (isMounted) hasProcessedScan.current = false
          }, 100)

          // Call stable callback
          onScanSuccessRef.current(scannedCode)

          // Clear validation cooldown
          setTimeout(() => {
            if (isMounted) setLastScannedCode(null)
          }, 3000)
        }
        if (err) {
          if (err.name === 'NotFoundException') {
            // Just noise, ignore or log sparingly
          }
        }
      }

      try {
        // 4. Soft Constraints
        // { ideal: 'environment' } is much friendlier to Android drivers than just 'environment'
        await reader.current!.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' }
            }
          },
          videoRef.current,
          handleScanResult
        )
      } catch (firstError: any) {
        if (!isMounted) return
        console.warn('Ideal environment camera failed, attempting fallback...', firstError)

        try {
          if (!reader.current) return // Safety check

          // Fallback: simple video request
          await reader.current.decodeFromConstraints(
            { video: true },
            videoRef.current,
            handleScanResult
          )
        } catch (secondError: any) {
          if (!isMounted) return
          console.error('Camera fallback failed:', secondError)

          let errorType = secondError.name || 'UnknownError'
          let errorMessage = secondError.message || JSON.stringify(secondError)

          setCameraError(`CAM_ERR_V3.2: [${errorType}] ${errorMessage}`)
          setIsScanning(false)
        }
      }
    }

    startScanning()

    return () => {
      isMounted = false
      // Strict Cleanup on Unmount / Dep Change
      if (reader.current) {
        try {
          (reader.current as any).reset()
        } catch (e) { }
        reader.current = null
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(t => t.stop())
        videoRef.current.srcObject = null
      }
      setIsScanning(false)
      setCameraError(null)
    }
  }, [enabled, scanMode, videoRef, setIsScanning, setCameraError, setLastScannedCode, setLastScanTime]) // REMOVED: onScanSuccess, lastScannedCode, etc.
}
