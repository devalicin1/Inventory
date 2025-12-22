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
    <div className="space-y-4 sm:space-y-5">
      {/* Camera View with Glass Morphism */}
      <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-3xl sm:rounded-[2rem] overflow-hidden shadow-2xl shadow-black/50 aspect-[3/4] sm:aspect-[4/3] flex flex-col items-center justify-center text-white ring-2 ring-white/10">
        {scanMode === 'camera' ? (
          <>
            {cameraError ? (
              <div className="absolute inset-0 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-6 z-20">
                {/* Glass error card */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl max-w-sm w-full mx-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500/30 to-red-600/30 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 sm:mb-6 mx-auto ring-2 ring-red-400/20">
                    <ExclamationTriangleIcon className="h-8 w-8 sm:h-10 sm:w-10 text-red-300" />
                  </div>
                  <p className="text-sm sm:text-base text-red-200 text-center mb-2 font-semibold px-4">{cameraError}</p>
                  <p className="text-xs sm:text-sm text-gray-400 text-center mb-6 sm:mb-8 px-4">Grant camera permission or use manual entry</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => setScanMode('manual')}
                      className="w-full px-6 py-3.5 bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/20 text-white rounded-xl font-semibold text-sm sm:text-base active:scale-95 transition-all touch-manipulation shadow-lg"
                    >
                      Manual Entry
                    </button>
                    <button
                      onClick={onRetryCamera}
                      className="w-full px-6 py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold text-sm sm:text-base active:scale-95 transition-all touch-manipulation shadow-lg shadow-blue-500/30"
                    >
                      Retry Camera
                    </button>
                  </div>
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
                
                {/* Scanning status with glass morphism */}
                <div className="absolute bottom-0 left-0 right-0 z-20 p-3 sm:p-4">
                  {scanAttempts > 10 ? (
                    <div className="bg-gradient-to-br from-yellow-400/90 to-orange-500/90 backdrop-blur-xl px-4 sm:px-5 py-3 sm:py-4 rounded-2xl sm:rounded-3xl shadow-2xl border border-yellow-300/30">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center flex-shrink-0 ring-2 ring-white/20">
                          <InformationCircleIcon className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-900" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm sm:text-base font-bold text-yellow-900 mb-2 sm:mb-3">QR code not found</p>
                          <ul className="text-xs sm:text-sm text-yellow-800 space-y-1 sm:space-y-1.5 mb-3 sm:mb-4 font-medium">
                            <li>• Move code closer to camera</li>
                            <li>• Ensure good lighting</li>
                            <li>• Hold steady</li>
                          </ul>
                          <button
                            onClick={() => setScanMode('manual')}
                            className="w-full py-2.5 sm:py-3 bg-white/30 hover:bg-white/40 backdrop-blur-md rounded-xl text-xs sm:text-sm font-bold text-yellow-900 active:scale-95 transition-all touch-manipulation border border-white/30 shadow-lg"
                          >
                            Use Manual Entry
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : scanAttempts > 5 ? (
                    <div className="bg-gradient-to-r from-orange-500/90 to-amber-500/90 backdrop-blur-xl px-4 sm:px-5 py-3 sm:py-4 rounded-2xl sm:rounded-3xl border border-orange-300/30 shadow-2xl">
                      <p className="text-sm sm:text-base text-white text-center font-semibold flex items-center justify-center gap-2">
                        <span className="animate-pulse">🔍</span>
                        Searching... Hold steady
                      </p>
                    </div>
                  ) : (
                    <div className="bg-black/60 backdrop-blur-xl px-4 sm:px-5 py-3 sm:py-4 rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl">
                      <p className="text-sm sm:text-base text-white text-center font-semibold flex items-center justify-center gap-2">
                        <span>📷</span>
                        Align QR code or barcode in frame
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-center p-6 sm:p-8 flex flex-col items-center justify-center h-full">
            {/* Glass morphism icon container */}
            <div className="relative mb-4 sm:mb-5">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-600/40 to-gray-700/40 rounded-3xl blur-2xl" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-white/10 backdrop-blur-xl rounded-3xl sm:rounded-[2rem] flex items-center justify-center border border-white/20 ring-2 ring-white/10">
                <QrCodeIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300" />
              </div>
            </div>
            <p className="text-gray-300 text-lg sm:text-xl font-bold mb-2 sm:mb-3">Manual Entry Mode</p>
            <p className="text-gray-400 text-sm sm:text-base px-4 font-medium">Type code in the field below</p>
          </div>
        )}

        {/* Mode Toggle Button with glass morphism */}
        <button
          onClick={() => setScanMode(scanMode === 'camera' ? 'manual' : 'camera')}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 bg-white/15 hover:bg-white/25 backdrop-blur-xl p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl active:scale-90 z-20 transition-all duration-200 touch-manipulation border border-white/20 shadow-xl ring-1 ring-white/10"
          title={scanMode === 'camera' ? 'Switch to manual entry' : 'Switch to camera'}
        >
          {scanMode === 'camera' ? (
            <MagnifyingGlassIcon className="h-6 w-6 sm:h-7 sm:w-7 text-white drop-shadow-lg" />
          ) : (
            <QrCodeIcon className="h-6 w-6 sm:h-7 sm:w-7 text-white drop-shadow-lg" />
          )}
        </button>
      </div>

      {/* Manual Input with glass morphism */}
      <form onSubmit={onManualSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/40 shadow-xl -z-10" />
          <MagnifyingGlassIcon className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-7 sm:w-7 text-blue-500 pointer-events-none z-10" />
          <input
            type="text"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Enter job code or SKU..."
            className="relative w-full pl-14 sm:pl-16 pr-5 sm:pr-6 py-4 sm:py-5 bg-white/50 backdrop-blur-md border-2 border-white/40 rounded-2xl sm:rounded-3xl focus:ring-4 focus:ring-blue-500/30 focus:border-blue-400 outline-none text-base sm:text-lg font-semibold placeholder:text-gray-500 shadow-inner transition-all duration-200"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={!manualCode.trim()}
          className="relative w-full group overflow-hidden bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-bold text-base sm:text-lg shadow-xl shadow-blue-500/40 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 touch-manipulation border border-white/20"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <div className="relative flex items-center justify-center gap-3">
            <MagnifyingGlassIcon className="h-6 w-6 sm:h-7 sm:w-7 drop-shadow-lg" />
            <span>Search</span>
          </div>
        </button>
      </form>
    </div>
  )
}

