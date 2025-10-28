import QRCode from 'qrcode'

export async function generateQRCodeDataURL(text: string): Promise<string> {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })
}


