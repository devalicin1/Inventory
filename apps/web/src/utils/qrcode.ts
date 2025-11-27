import QRCode from 'qrcode'

export interface QRCodeOptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  margin?: number
  scale?: number
  width?: number
  color?: {
    dark?: string
    light?: string
  }
}

export interface QRCodeResult {
  dataUrl: string
  size: number
  text: string
}

export async function generateQRCodeDataURL(
  text: string, 
  options: QRCodeOptions = {}
): Promise<QRCodeResult> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('QR kod için metin gerekli')
    }

    const defaultOptions = {
      errorCorrectionLevel: 'M' as const,
      margin: 2,
      scale: 8,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      ...options
    }

    const dataUrl = await QRCode.toDataURL(text, defaultOptions)
    
    // Calculate size from data URL
    const size = defaultOptions.scale * 25 + (defaultOptions.margin * 2 * defaultOptions.scale)
    
    return {
      dataUrl,
      size,
      text: text.trim()
    }
  } catch (error) {
    console.error('QR kod oluşturma hatası:', error)
    throw new Error(`QR kod oluşturulamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
  }
}

export async function generateQRCodeSVG(text: string, options: QRCodeOptions = {}): Promise<string> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('QR kod için metin gerekli')
    }

    const defaultOptions = {
      errorCorrectionLevel: 'M' as const,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      ...options
    }

    return await QRCode.toString(text, {
      type: 'svg',
      ...defaultOptions
    })
  } catch (error) {
    console.error('QR kod SVG oluşturma hatası:', error)
    throw new Error(`QR kod SVG oluşturulamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
  }
}

export function downloadQRCode(url: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // If it's already a data URL, use it directly
      if (url.startsWith('data:')) {
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        resolve()
      } else {
        // For external URLs (like Firebase Storage), fetch as blob and download
        fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to fetch QR code: ${response.statusText}`)
            }
            return response.blob()
          })
          .then(blob => {
            const blobUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = blobUrl
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            // Clean up the blob URL
            window.URL.revokeObjectURL(blobUrl)
            resolve()
          })
          .catch(error => {
            console.error('QR kod indirme hatası:', error)
            reject(new Error('QR kod indirilemedi'))
          })
      }
    } catch (error) {
      console.error('QR kod indirme hatası:', error)
      reject(new Error('QR kod indirilemedi'))
    }
  })
}

export function copyQRCodeToClipboard(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // If it's already a data URL, use it directly
      if (url.startsWith('data:')) {
        fetch(url)
          .then(res => res.blob())
          .then(blob => {
            const item = new ClipboardItem({ 'image/png': blob })
            return navigator.clipboard.write([item])
          })
          .then(() => resolve())
          .catch(reject)
      } else {
        // For external URLs (like Firebase Storage), load via image and convert to canvas
        const img = new Image()
        img.crossOrigin = 'anonymous' // Enable CORS for image loading
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              reject(new Error('Canvas context not available'))
              return
            }
            ctx.drawImage(img, 0, 0)
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('Failed to convert image to blob'))
                return
              }
              const item = new ClipboardItem({ 'image/png': blob })
              navigator.clipboard.write([item])
                .then(() => resolve())
                .catch(reject)
            }, 'image/png')
          } catch (error) {
            reject(error)
          }
        }
        
        img.onerror = () => {
          reject(new Error('Failed to load image. CORS might be blocking the request.'))
        }
        
        img.src = url
      }
    } catch (error) {
      reject(new Error('QR kod panoya kopyalanamadı'))
    }
  })
}


