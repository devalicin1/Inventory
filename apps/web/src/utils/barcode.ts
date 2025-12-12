import JsBarcode from 'jsbarcode'

// Standard label sizes in millimeters (width x height)
export const LABEL_SIZES = {
  '50x30': { width: 50, height: 30, name: '50x30mm (Small)' },
  '100x50': { width: 100, height: 50, name: '100x50mm (Medium)' },
  '105x74': { width: 105, height: 74, name: '105x74mm (A7)' },
  '148x105': { width: 148, height: 105, name: '148x105mm (A6)' },
  '210x148': { width: 210, height: 148, name: '210x148mm (A5)' },
  'custom': { width: 100, height: 50, name: 'Custom' },
} as const

export type LabelSize = keyof typeof LABEL_SIZES

// Standard paper sizes in millimeters
export const PAPER_SIZES = {
  'A4': { width: 210, height: 297, name: 'A4 (210x297mm)' },
  'A5': { width: 148, height: 210, name: 'A5 (148x210mm)' },
  'Letter': { width: 216, height: 279, name: 'Letter (8.5"x11")' },
  'Custom': { width: 210, height: 297, name: 'Custom' },
} as const

export type PaperSize = keyof typeof PAPER_SIZES

export interface BarcodeContentOptions {
  includeSKU?: boolean
  includeProductName?: boolean
  includePrice?: boolean
  includeCategory?: boolean
  includeSubcategory?: boolean
  includeUOM?: boolean
  includeQuantityBox?: boolean
  includePcsPerBox?: boolean
  includeMaterialSeries?: boolean
  includeBoardType?: boolean
  includeGSM?: boolean
  includeDimensions?: boolean
  includeCAL?: boolean
  includeMinStock?: boolean
  includeReorderPoint?: boolean
  includeMinLevelBox?: boolean
  includeStatus?: boolean
  includeGroup?: boolean
  includeTags?: boolean
  includeNotes?: boolean
  customText?: string
}

export interface BarcodeOptions {
  format?: 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC' | 'ITF14'
  labelSize?: LabelSize
  paperSize?: PaperSize
  customWidth?: number // mm
  customHeight?: number // mm
  dpi?: number // dots per inch (default 300 for printing)
  showText?: boolean // Show barcode value below barcode
  content?: BarcodeContentOptions
  productData?: {
    sku?: string
    name?: string
    price?: number
    category?: string
    subcategory?: string
    uom?: string
    quantityBox?: number
    pcsPerBox?: number
    materialSeries?: string
    boardType?: string
    gsm?: string
    dimensionsWxLmm?: string
    cal?: string
    minStock?: number
    reorderPoint?: number
    minLevelBox?: number
    status?: string
    groupName?: string
    tags?: string[]
    notes?: string
  }
}

export interface BarcodeResult {
  dataUrl: string
  width: number // pixels
  height: number // pixels
  labelWidth: number // mm
  labelHeight: number // mm
}

// Convert mm to pixels at given DPI
function mmToPixels(mm: number, dpi: number = 300): number {
  const inches = mm / 25.4
  return Math.round(inches * dpi)
}

// Convert pixels to mm at given DPI
function pixelsToMm(pixels: number, dpi: number = 300): number {
  const inches = pixels / dpi
  return inches * 25.4
}

// Check if SKU is human-readable/understandable
function isSKUReadable(sku: string | undefined): boolean {
  if (!sku || sku.trim().length === 0) return false
  
  const trimmed = sku.trim()
  
  // If it's too long (likely a Firebase ID or random string), not readable
  if (trimmed.length > 20) return false
  
  // If it contains only alphanumeric characters and common separators, it's likely readable
  // Firebase IDs are typically 20-28 characters of random alphanumeric
  // If it looks like a Firebase ID (exactly 20-28 chars, random pattern), it's not readable
  if (trimmed.length >= 20 && trimmed.length <= 28) {
    // Check if it looks like a random string (high entropy)
    const hasPattern = /^[A-Z0-9]+$/i.test(trimmed)
    if (hasPattern && trimmed.length >= 20) {
      // Likely a Firebase ID or random string
      return false
    }
  }
  
  // If it has spaces, dashes, or other readable separators, it's likely readable
  if (/[\s\-_\/]/.test(trimmed)) return true
  
  // If it's short and has a mix of letters and numbers, it's likely readable
  if (trimmed.length <= 15 && /[A-Za-z]/.test(trimmed) && /[0-9]/.test(trimmed)) return true
  
  // If it's very short (like a simple code), it's readable
  if (trimmed.length <= 10) return true
  
  // Default: if it's not obviously unreadable, consider it readable
  return true
}

export async function generateBarcodeDataURL(
  text: string,
  options: BarcodeOptions = {}
): Promise<BarcodeResult> {
  const {
    format = 'CODE128',
    labelSize = '100x50',
    paperSize = 'A4',
    customWidth,
    customHeight,
    dpi = 300,
    showText = true,
    content = {},
    productData = {},
  } = options

  // Determine label dimensions
  let labelWidth: number
  let labelHeight: number

  if (labelSize === 'custom' && customWidth && customHeight) {
    labelWidth = customWidth
    labelHeight = customHeight
  } else {
    const size = LABEL_SIZES[labelSize]
    labelWidth = size.width
    labelHeight = size.height
  }

  // Convert to pixels
  const labelWidthPx = mmToPixels(labelWidth, dpi)
  const labelHeightPx = mmToPixels(labelHeight, dpi)

  // Check if SKU is readable to determine if we should show barcode value
  const sku = productData.sku || text
  const isReadable = isSKUReadable(sku)
  const shouldShowBarcodeText = showText && isReadable

  // Calculate barcode height (typically 30-40% of label height)
  // For printing, use consistent proportions
  const barcodeHeightRatio = labelSize === '50x30' ? 0.4 : 0.35 // Taller for small labels
  const barcodeHeight = Math.round(labelHeightPx * barcodeHeightRatio)
  
  // Margins optimized for printing - ensure minimum printable area
  const horizontalMargin = Math.max(Math.round(labelWidthPx * 0.05), 8) // At least 8px
  const topMargin = Math.max(Math.round(labelHeightPx * 0.04), 6) // At least 6px
  const bottomMargin = Math.max(Math.round(labelHeightPx * 0.04), 6)
  const verticalSpacing = Math.round(labelHeightPx * 0.025) // Consistent vertical spacing

  // Create SVG with proper dimensions
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', labelWidthPx.toString())
  svg.setAttribute('height', labelHeightPx.toString())
  svg.setAttribute('viewBox', `0 0 ${labelWidthPx} ${labelHeightPx}`)

  // Create a group for the barcode content
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('transform', `translate(${horizontalMargin}, ${topMargin})`)

  // Generate barcode with optimized settings for printing
  const barcodeWidth = labelWidthPx - (horizontalMargin * 2)
  JsBarcode(g, text, {
    format,
    displayValue: shouldShowBarcodeText, // Only show if SKU is readable
    margin: 0,
    height: barcodeHeight,
    width: labelSize === '50x30' ? 1.5 : 2, // Thinner bars for small labels
    fontSize: Math.round(labelHeightPx * 0.065), // Optimized font size
    textMargin: Math.round(labelHeightPx * 0.012),
    background: '#ffffff',
    lineColor: '#000000',
  })

  svg.appendChild(g)

  // Helper function to add text to label with proper spacing
  const addText = (
    textGroup: SVGGElement,
    text: string,
    currentY: number,
    fontSize: number,
    fontWeight: 'normal' | 'bold' = 'normal',
    color: string = '#333333',
    lineSpacing: number = 0.02
  ): number => {
    if (!text || text.trim().length === 0) return currentY
    
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    textEl.setAttribute('x', (labelWidthPx / 2).toString())
    textEl.setAttribute('y', currentY.toString())
    textEl.setAttribute('text-anchor', 'middle')
    textEl.setAttribute('font-family', 'Arial, sans-serif')
    textEl.setAttribute('font-size', Math.round(labelHeightPx * fontSize).toString())
    if (fontWeight === 'bold') {
      textEl.setAttribute('font-weight', 'bold')
    }
    textEl.setAttribute('fill', color)
    
    // Calculate max width based on label width and font size
    const maxWidth = labelWidthPx - (horizontalMargin * 2)
    const charWidth = labelHeightPx * fontSize * 0.6 // Approximate character width
    const maxChars = Math.floor(maxWidth / charWidth)
    
    // Truncate long text intelligently
    let displayText = text
    if (text.length > maxChars) {
      displayText = text.substring(0, maxChars - 3) + '...'
    }
    
    textEl.textContent = displayText
    textGroup.appendChild(textEl)
    
    // Return next Y position with proper spacing
    return currentY + Math.round(labelHeightPx * (fontSize + lineSpacing))
  }

  // Add additional content if specified
  const hasContent = content.includeProductName || content.includeSKU || content.includePrice || 
    content.includeCategory || content.includeSubcategory || content.includeUOM || 
    content.includeQuantityBox || content.includePcsPerBox || content.includeMaterialSeries || 
    content.includeBoardType || content.includeGSM || content.includeDimensions || 
    content.includeCAL || content.includeMinStock || content.includeReorderPoint || 
    content.includeMinLevelBox || content.includeStatus || content.includeGroup || 
    content.includeTags || content.includeNotes || content.customText

  if (hasContent) {
    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    // Start text below barcode with proper spacing
    // Account for barcode text if shown, plus spacing
    const barcodeTextHeight = shouldShowBarcodeText ? Math.round(labelHeightPx * 0.07) : 0
    const textY = topMargin + barcodeHeight + barcodeTextHeight + (shouldShowBarcodeText ? Math.round(labelHeightPx * 0.04) : Math.round(labelHeightPx * 0.03))
    let currentY = textY

    // Product name (bold, larger) - always at top if included
    if (content.includeProductName && productData.name) {
      currentY = addText(textGroup, productData.name, currentY, 0.065, 'bold', '#000000', 0.025)
    }

    // SKU - only show if readable
    if (content.includeSKU && productData.sku && isReadable) {
      currentY = addText(textGroup, `SKU: ${productData.sku}`, currentY, 0.05, 'normal', '#333333', 0.02)
    }

    // Price (bold, blue)
    if (content.includePrice && productData.price !== undefined) {
      currentY = addText(textGroup, `£${productData.price.toFixed(2)}`, currentY, 0.06, 'bold', '#0066cc', 0.025)
    }

    // Category
    if (content.includeCategory && productData.category) {
      currentY = addText(textGroup, productData.category, currentY, 0.045, 'normal', '#666666', 0.02)
    }

    // Subcategory
    if (content.includeSubcategory && productData.subcategory) {
      currentY = addText(textGroup, productData.subcategory, currentY, 0.04, 'normal', '#666666', 0.02)
    }

    // UOM
    if (content.includeUOM && productData.uom) {
      currentY = addText(textGroup, `UOM: ${productData.uom}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Quantity Box
    if (content.includeQuantityBox && productData.quantityBox !== undefined) {
      currentY = addText(textGroup, `Qty: ${productData.quantityBox}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Pcs Per Box
    if (content.includePcsPerBox && productData.pcsPerBox !== undefined) {
      currentY = addText(textGroup, `Pcs/Box: ${productData.pcsPerBox}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Material Series
    if (content.includeMaterialSeries && productData.materialSeries) {
      currentY = addText(textGroup, `Material: ${productData.materialSeries}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Board Type
    if (content.includeBoardType && productData.boardType) {
      currentY = addText(textGroup, `Board: ${productData.boardType}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // GSM
    if (content.includeGSM && productData.gsm) {
      currentY = addText(textGroup, `GSM: ${productData.gsm}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Dimensions
    if (content.includeDimensions && productData.dimensionsWxLmm) {
      currentY = addText(textGroup, `Size: ${productData.dimensionsWxLmm}mm`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // CAL
    if (content.includeCAL && productData.cal) {
      currentY = addText(textGroup, `CAL: ${productData.cal}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Min Stock
    if (content.includeMinStock && productData.minStock !== undefined) {
      currentY = addText(textGroup, `Min Stock: ${productData.minStock}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Reorder Point
    if (content.includeReorderPoint && productData.reorderPoint !== undefined) {
      currentY = addText(textGroup, `Reorder: ${productData.reorderPoint}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Min Level Box
    if (content.includeMinLevelBox && productData.minLevelBox !== undefined) {
      currentY = addText(textGroup, `Min Level: ${productData.minLevelBox}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Status
    if (content.includeStatus && productData.status) {
      currentY = addText(textGroup, `Status: ${productData.status}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Group
    if (content.includeGroup && productData.groupName) {
      currentY = addText(textGroup, `Group: ${productData.groupName}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Tags
    if (content.includeTags && productData.tags && productData.tags.length > 0) {
      const tagsText = productData.tags.join(', ')
      currentY = addText(textGroup, `Tags: ${tagsText}`, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    // Notes
    if (content.includeNotes && productData.notes) {
      currentY = addText(textGroup, productData.notes, currentY, 0.035, 'normal', '#666666', 0.018)
    }

    // Custom text
    if (content.customText) {
      currentY = addText(textGroup, content.customText, currentY, 0.04, 'normal', '#666666', 0.018)
    }

    svg.appendChild(textGroup)
  }

  const xml = new XMLSerializer().serializeToString(svg)
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  // Render SVG to canvas to get PNG data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = labelWidthPx
      canvas.height = labelHeightPx
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas not supported'))
      
      // White background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      ctx.drawImage(img, 0, 0)
      const out = canvas.toDataURL('image/png', 1.0)
      URL.revokeObjectURL(url)
      resolve(out)
    }
    img.onerror = reject
    img.src = url
  })

  return {
    dataUrl,
    width: labelWidthPx,
    height: labelHeightPx,
    labelWidth,
    labelHeight,
  }
}

// Download barcode function
export function downloadBarcode(url: string, filename: string): Promise<void> {
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
              throw new Error(`Failed to fetch barcode: ${response.statusText}`)
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
            console.error('Barcode indirme hatası:', error)
            reject(new Error('Barcode indirilemedi'))
          })
      }
    } catch (error) {
      console.error('Barcode indirme hatası:', error)
      reject(new Error('Barcode indirilemedi'))
    }
  })
}

// Legacy function for backward compatibility
export async function generateBarcodeDataURLLegacy(text: string): Promise<string> {
  const result = await generateBarcodeDataURL(text)
  return result.dataUrl
}


