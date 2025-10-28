import JsBarcode from 'jsbarcode'

export async function generateBarcodeDataURL(text: string): Promise<string> {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, text, {
    format: 'CODE128',
    displayValue: false,
    margin: 2,
    height: 80,
  })

  const xml = new XMLSerializer().serializeToString(svg)
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  // Render SVG to canvas to get PNG data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas not supported'))
      ctx.drawImage(img, 0, 0)
      const out = canvas.toDataURL('image/png')
      URL.revokeObjectURL(url)
      resolve(out)
    }
    img.onerror = reject
    img.src = url
  })

  return dataUrl
}


