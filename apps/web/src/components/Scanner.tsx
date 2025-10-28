import { useState, useRef, useEffect } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

interface ScannerProps {
  onScan: (result: string) => void
  onClose: () => void
}

export function Scanner({ onScan, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reader = useRef<BrowserMultiFormatReader | null>(null)

  useEffect(() => {
    reader.current = new BrowserMultiFormatReader()
    
    const startScanning = async () => {
      try {
        setIsScanning(true)
        setError(null)
        
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const deviceId = devices[0]?.deviceId
        
        if (!deviceId) {
          throw new Error('No camera found')
        }

        await reader.current!.decodeFromVideoDevice(deviceId, videoRef.current!, (result, err) => {
          if (result) {
            onScan(result.getText())
            setIsScanning(false)
          }
          if (err && !(err instanceof Error && err.name === 'NotFoundException')) {
            console.error('Scan error:', err)
          }
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start camera')
        setIsScanning(false)
      }
    }

    startScanning()

    return () => {
      // Cleanup handled by component unmount
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
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-48 w-48 border-2 border-white rounded-lg opacity-50" />
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

        {isScanning && (
          <div className="p-4 text-center text-white">
            <p>Point camera at barcode or QR code</p>
          </div>
        )}
      </div>
    </div>
  )
}
