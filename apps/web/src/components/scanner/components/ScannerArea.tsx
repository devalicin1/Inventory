import { QrCodeIcon, MagnifyingGlassIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import type { ScanMode } from '../types'

interface ScannerAreaProps {
  scanMode: ScanMode
  setScanMode: (mode: ScanMode) => void
  manualCode: string
  setManualCode: (code: string) => void
  onManualSubmit: (e: React.FormEvent) => void
  videoRef: React.RefObject<HTMLVideoElement | null>
  isScanning: boolean
  cameraError: string | null
  scanAttempts: number
  onRetryCamera: () => void
}

export function ScannerArea({
  scanMode,
  setScanMode,
  manualCode,
  setManualCode,
  onManualSubmit,
  videoRef,
  isScanning,
  cameraError,
  scanAttempts,
  onRetryCamera,
}: ScannerAreaProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Camera View */}
      <div className="bg-gray-900 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl aspect-[3/4] sm:aspect-[4/3] relative flex flex-col items-center justify-center text-white">
        {scanMode === 'camera' ? (
          <>
            {cameraError ? (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-4 sm:p-6 z-20">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                  <ExclamationTriangleIcon className="h-8 w-8 sm:h-10 sm:w-10 text-red-400" />
                </div>
                <p className="text-sm sm:text-base text-red-300 text-center mb-2 font-medium px-4">{cameraError}</p>
                <p className="text-xs sm:text-sm text-gray-400 text-center mb-4 sm:mb-6 px-4">Grant camera permission or use manual entry</p>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full px-4 sm:px-0 sm:w-auto">
                  <button
                    onClick={() => setScanMode('manual')}
                    className="w-full sm:w-auto px-6 py-3 sm:py-3.5 bg-gray-700 text-white rounded-xl font-semibold text-sm sm:text-base active:bg-gray-600 touch-manipulation"
                  >
                    Manual Entry
                  </button>
                  <button
                    onClick={onRetryCamera}
                    className="w-full sm:w-auto px-6 py-3 sm:py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-sm sm:text-base active:bg-blue-700 touch-manipulation"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                  disablePictureInPicture
                  controls={false}
                />
                {/* Scan Frame Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="absolute inset-0 bg-black/40" />
                  
                  <div className={`w-[80%] sm:w-[75%] max-w-[280px] aspect-square relative z-10 transition-all duration-300 ${
                    scanAttempts > 10 ? 'animate-pulse' : ''
                  }`}>
                    <div className="absolute inset-0 bg-transparent rounded-xl sm:rounded-2xl" style={{ 
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' 
                    }} />
                    
                    <div className={`absolute -top-1 -left-1 w-8 h-8 sm:w-10 sm:h-10 border-t-3 sm:border-t-4 border-l-3 sm:border-l-4 rounded-tl-lg sm:rounded-tl-xl transition-colors duration-300 ${
                      scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
                    }`} />
                    <div className={`absolute -top-1 -right-1 w-8 h-8 sm:w-10 sm:h-10 border-t-3 sm:border-t-4 border-r-3 sm:border-r-4 rounded-tr-lg sm:rounded-tr-xl transition-colors duration-300 ${
                      scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
                    }`} />
                    <div className={`absolute -bottom-1 -left-1 w-8 h-8 sm:w-10 sm:h-10 border-b-3 sm:border-b-4 border-l-3 sm:border-l-4 rounded-bl-lg sm:rounded-bl-xl transition-colors duration-300 ${
                      scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
                    }`} />
                    <div className={`absolute -bottom-1 -right-1 w-8 h-8 sm:w-10 sm:h-10 border-b-3 sm:border-b-4 border-r-3 sm:border-r-4 rounded-br-lg sm:rounded-br-xl transition-colors duration-300 ${
                      scanAttempts > 10 ? 'border-yellow-400' : 'border-blue-400'
                    }`} />
                    
                    {isScanning && scanAttempts <= 10 && (
                      <div className="absolute inset-x-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse" />
                    )}
                  </div>
                </div>
                
                {/* Scanning status */}
                <div className="absolute bottom-0 left-0 right-0 z-20 p-3 sm:p-4">
                  {scanAttempts > 10 ? (
                    <div className="bg-yellow-500 px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl shadow-lg">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <InformationCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-900 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-left">
                          <p className="text-xs sm:text-sm font-bold text-yellow-900 mb-1 sm:mb-2">QR code not found</p>
                          <ul className="text-[10px] sm:text-xs text-yellow-800 space-y-0.5 sm:space-y-1">
                            <li>• Move code closer to camera</li>
                            <li>• Ensure good lighting</li>
                            <li>• Hold steady</li>
                          </ul>
                          <button
                            onClick={() => setScanMode('manual')}
                            className="mt-2 sm:mt-3 w-full py-2 sm:py-2.5 bg-yellow-900/20 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold text-yellow-900 active:bg-yellow-900/30 touch-manipulation"
                          >
                            Use Manual Entry
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : scanAttempts > 5 ? (
                    <div className="bg-orange-500/95 backdrop-blur px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl">
                      <p className="text-xs sm:text-sm text-white text-center font-medium">
                        🔍 Searching... Hold steady
                      </p>
                    </div>
                  ) : (
                    <div className="bg-black/70 backdrop-blur px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl">
                      <p className="text-xs sm:text-sm text-white text-center font-medium">
                        📷 Align QR code or barcode in frame
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-center p-6 sm:p-8 flex flex-col items-center justify-center h-full">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-800 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 sm:mb-4">
              <QrCodeIcon className="h-12 w-12 sm:h-14 sm:w-14 text-gray-500" />
            </div>
            <p className="text-gray-400 text-base sm:text-lg font-medium mb-1 sm:mb-2">Manual Entry Mode</p>
            <p className="text-gray-500 text-xs sm:text-sm px-4">Type code in the field below</p>
          </div>
        )}

        {/* Mode Toggle Button */}
        <button
          onClick={() => setScanMode(scanMode === 'camera' ? 'manual' : 'camera')}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/20 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl active:bg-white/30 z-20 transition-all touch-manipulation"
          title={scanMode === 'camera' ? 'Switch to manual entry' : 'Switch to camera'}
        >
          {scanMode === 'camera' ? (
            <MagnifyingGlassIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          ) : (
            <QrCodeIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          )}
        </button>
      </div>

      {/* Manual Input */}
      <form onSubmit={onManualSubmit} className="space-y-2.5 sm:space-y-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-6 sm:w-6 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Enter job code or SKU..."
            className="w-full pl-12 sm:pl-14 pr-4 sm:pr-5 py-4 sm:py-5 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-base sm:text-lg font-medium placeholder:text-gray-400 bg-white shadow-sm"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={!manualCode.trim()}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 touch-manipulation"
        >
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <MagnifyingGlassIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            <span>Search</span>
          </div>
        </button>
      </form>
    </div>
  )
}

