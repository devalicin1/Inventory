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

export function downloadQRCode(dataUrl: string, filename: string): void {
  try {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('QR kod indirme hatası:', error)
    throw new Error('QR kod indirilemedi')
  }
}

export function copyQRCodeToClipboard(dataUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Convert data URL to blob
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const item = new ClipboardItem({ 'image/png': blob })
          navigator.clipboard.write([item])
            .then(() => resolve())
            .catch(reject)
        })
        .catch(reject)
    } catch (error) {
      reject(new Error('QR kod panoya kopyalanamadı'))
    }
  })
}


