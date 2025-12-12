import jsPDF from 'jspdf'
import type { PurchaseOrder } from '../api/purchase-orders'
import { doc as firestoreDoc, getDoc } from 'firebase/firestore'
import { db, storage } from '../lib/firebase'
import { ref, getBytes } from 'firebase/storage'

const COMPANY_LOGO = '/logo.png'

const COLORS = {
  text: [30, 30, 30],
  label: [100, 100, 100],
  accent: [41, 128, 185],
  bgLight: [248, 249, 250],
  border: [220, 220, 220],
}

interface ExportOptions {
  includeItemPhotos?: boolean
  selectedFields?: string[]
}

const DEFAULT_FIELDS = [
  'poNumber',
  'dateOrdered',
  'dateExpected',
  'dateReceived',
  'submittedBy',
  'approvedBy',
  'itemDescription',
  'partNumber',
  'quantity',
  'unitName',
  'unitRate',
  'amount',
  'subtotal',
  'discounts',
  'tax',
  'shipping',
  'companyLogo',
  'lineItem',
  'itemNotes',
]

export async function generatePurchaseOrderPDFBlob(
  po: PurchaseOrder,
  companyInfo: any = {},
  options: ExportOptions = {},
  workspaceId?: string
): Promise<Blob> {
  try {
    console.log('[generatePurchaseOrderPDFBlob] Starting PDF generation:', { po, companyInfo, options })
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = 210
    const pageHeight = 297
    const margin = 15
    let y = margin

    const selectedFields = options.selectedFields || DEFAULT_FIELDS
    const includePhotos = options.includeItemPhotos !== false
    
    console.log('[generatePurchaseOrderPDFBlob] Selected fields:', selectedFields)
    console.log('[generatePurchaseOrderPDFBlob] Include photos:', includePhotos, 'from options:', options.includeItemPhotos)
    console.log('[generatePurchaseOrderPDFBlob] WorkspaceId:', workspaceId)

  // Helper to format date
  const formatDate = (date: Date | any): string => {
    if (!date) return ''
    try {
      let d: Date
      if (date?.toDate) {
        d = date.toDate()
      } else if (date instanceof Date) {
        d = date
      } else if (typeof date === 'string' || typeof date === 'number') {
        d = new Date(date)
      } else {
        return ''
      }
      if (isNaN(d.getTime())) return ''
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return ''
    }
  }

  // Load and draw company logo
  const drawCompanyHeader = async () => {
    let logoY = margin
    let logoHeight = 0
    
    // Try to load logo
    if (selectedFields.includes('companyLogo')) {
      try {
        const logoResponse = await fetch(COMPANY_LOGO)
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob()
          const logoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(logoBlob)
          })
          logoHeight = 12
          doc.addImage(logoDataUrl, 'PNG', margin, logoY, 40, logoHeight)
          logoY += logoHeight + 3
        }
      } catch (e) {
        console.warn('[PDF] Logo could not be loaded:', e)
      }
    }

    // Company Information (below logo or at top if no logo)
    if (companyInfo && Object.keys(companyInfo).length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...COLORS.text)
      doc.text(companyInfo.name || 'Company Name', margin, logoY)
      logoY += 5
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.label)
      
      const companyLines: string[] = []
      if (companyInfo.address1) companyLines.push(companyInfo.address1)
      if (companyInfo.address2) companyLines.push(companyInfo.address2)
      const cityState = [companyInfo.city, companyInfo.state, companyInfo.zipCode].filter(Boolean).join(', ')
      if (cityState) companyLines.push(cityState)
      if (companyInfo.country) companyLines.push(companyInfo.country)
      if (companyInfo.phoneNumber) companyLines.push(`Tel: ${companyInfo.phoneNumber}`)
      if (companyInfo.email) companyLines.push(`Email: ${companyInfo.email}`)
      
      companyLines.forEach((line) => {
        doc.text(line, margin, logoY)
        logoY += 3.5
      })
    }
    
    return logoY
  }

  // Draw company header
  const companyHeaderBottom = await drawCompanyHeader()
  
  // Title "PURCHASE ORDER" on the right side
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...COLORS.text)
  doc.text('PURCHASE ORDER', pageWidth - margin, margin + 8, { align: 'right' })
  
  // PO Details (Right side) - properly aligned
  let poDetailsY = margin + 14
  const rightX = pageWidth - margin
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.label)

  const poLabelWidth = 50
  const poValueX = rightX - poLabelWidth
  
  if (selectedFields.includes('poNumber')) {
    doc.text('PO Number:', poValueX, poDetailsY)
    doc.setTextColor(...COLORS.text)
    doc.setFont('helvetica', 'bold')
    doc.text(po.poNumber || '-', rightX, poDetailsY, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    poDetailsY += 4.5
  }

  if (selectedFields.includes('dateOrdered') && po.dates?.dateOrdered) {
    doc.setTextColor(...COLORS.label)
    doc.text('Date Ordered:', poValueX, poDetailsY)
    doc.setTextColor(...COLORS.text)
    doc.text(formatDate(po.dates.dateOrdered), rightX, poDetailsY, { align: 'right' })
    poDetailsY += 4.5
  }

  if (selectedFields.includes('submittedBy') && po.dates?.submittedBy) {
    doc.setTextColor(...COLORS.label)
    doc.text('Submitted by:', poValueX, poDetailsY)
    doc.setTextColor(...COLORS.text)
    doc.text(po.dates.submittedBy, rightX, poDetailsY, { align: 'right' })
    poDetailsY += 4.5
  }

  if (selectedFields.includes('dateExpected') && po.dates?.dateExpected) {
    doc.setTextColor(...COLORS.label)
    doc.text('Date Expected:', poValueX, poDetailsY)
    doc.setTextColor(...COLORS.text)
    doc.text(formatDate(po.dates.dateExpected), rightX, poDetailsY, { align: 'right' })
    poDetailsY += 4.5
  }

  if (selectedFields.includes('dateReceived') && po.dates?.dateReceived) {
    doc.setTextColor(...COLORS.label)
    doc.text('Date Received:', poValueX, poDetailsY)
    doc.setTextColor(...COLORS.text)
    doc.text(formatDate(po.dates.dateReceived), rightX, poDetailsY, { align: 'right' })
    poDetailsY += 4.5
  }

  if (selectedFields.includes('approvedBy') && po.dates?.approvedBy) {
    doc.setTextColor(...COLORS.label)
    doc.text('Approved by:', poValueX, poDetailsY)
    doc.setTextColor(...COLORS.text)
    doc.text(po.dates.approvedBy, rightX, poDetailsY, { align: 'right' })
    poDetailsY += 4.5
  }

  // Vendor and Shipping Address - start below company header or at a fixed position
  y = Math.max(companyHeaderBottom + 8, margin + 45)
  const colWidth = (pageWidth - 2 * margin) / 2

  // Vendor section with box
  const vendorStartY = y
  doc.setFillColor(...COLORS.bgLight)
  doc.rect(margin, y - 3, colWidth - 5, 35, 'F')
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.rect(margin, y - 3, colWidth - 5, 35, 'S')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.accent)
  doc.text('VENDOR', margin + 3, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.text)
  if (po.vendor) {
    doc.text(po.vendor.name || '', margin + 3, y)
    y += 4
    if (po.vendor.address1) {
      doc.text(po.vendor.address1, margin + 3, y)
      y += 4
    }
    if (po.vendor.address2) {
      doc.text(po.vendor.address2, margin + 3, y)
      y += 4
    }
    const cityState = [po.vendor.city, po.vendor.state, po.vendor.zipCode].filter(Boolean).join(', ')
    if (cityState) {
      doc.text(cityState, margin + 3, y)
      y += 4
    }
    if (po.vendor.country) {
      doc.text(po.vendor.country, margin + 3, y)
    }
  }

  // Shipping Address section with box
  y = vendorStartY
  doc.setFillColor(...COLORS.bgLight)
  doc.rect(margin + colWidth + 5, y - 3, colWidth - 5, 35, 'F')
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.rect(margin + colWidth + 5, y - 3, colWidth - 5, 35, 'S')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.accent)
  doc.text('SHIPPING ADDRESS', margin + colWidth + 8, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.text)
  if (po.shipTo) {
    doc.text(po.shipTo.name || '', margin + colWidth + 8, y)
    y += 4
    if (po.shipTo.address1) {
      doc.text(po.shipTo.address1, margin + colWidth + 8, y)
      y += 4
    }
    if (po.shipTo.address2) {
      doc.text(po.shipTo.address2, margin + colWidth + 8, y)
      y += 4
    }
    const cityState = [po.shipTo.city, po.shipTo.state, po.shipTo.zipCode].filter(Boolean).join(', ')
    if (cityState) {
      doc.text(cityState, margin + colWidth + 8, y)
      y += 4
    }
    if (po.shipTo.country) {
      doc.text(po.shipTo.country, margin + colWidth + 8, y)
    }
  }

  // Line Items Table - start after vendor/shipping sections
  y = Math.max(y + 25, margin + 75)
  const tableTop = y
  const colWidths = {
    lineItem: 15,
    description: includePhotos ? 50 : 60, // Reduce description width if photos are included
    partNumber: 25,
    quantity: 25,
    unitName: 20,
    unitRate: 25,
    amount: 25,
  }
  const tableStartX = margin

  // Table Header with background
  doc.setFillColor(...COLORS.bgLight)
  doc.rect(tableStartX, y - 4, pageWidth - 2 * margin, 7, 'F')
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.rect(tableStartX, y - 4, pageWidth - 2 * margin, 7, 'S')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.accent)
  
  let x = tableStartX + 2
  if (selectedFields.includes('lineItem')) {
    doc.text('LINE ITEM', x, y)
    x += colWidths.lineItem
  }
  if (selectedFields.includes('itemDescription')) {
    doc.text('ITEM DESCRIPTION', x, y)
    x += colWidths.description
  }
  if (selectedFields.includes('partNumber')) {
    doc.text('PART #', x, y)
    x += colWidths.partNumber
  }
  if (selectedFields.includes('quantity')) {
    doc.text('QUANTITY', x, y)
    x += colWidths.quantity
  }
  if (selectedFields.includes('unitName')) {
    doc.text('UNIT NAME', x, y)
    x += colWidths.unitName
  }
  if (selectedFields.includes('unitRate')) {
    doc.text('UNIT RATE', x, y)
    x += colWidths.unitRate
  }
  if (selectedFields.includes('amount')) {
    doc.text('AMOUNT', x, y)
  }

  y += 3
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(tableStartX, y, pageWidth - margin, y)

  // Table Rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.text)
  
  if (Array.isArray(po.lineItems) && po.lineItems.length > 0) {
    // Helper function to load and add product image
    const loadAndAddProductImage = async (productId: string, imageX: number, imageY: number, imageSize: number = 15) => {
      try {
        if (!workspaceId) {
          console.warn(`[PDF] No workspaceId provided, cannot load image for product ${productId}`)
          return false
        }
        const productDoc = await getDoc(firestoreDoc(db, 'workspaces', workspaceId, 'products', productId))
        if (productDoc.exists()) {
          const productData = productDoc.data()
          const imageUrl = productData.imageUrl || productData.image
          
          if (imageUrl) {
            try {
              console.log(`[PDF] Loading image for product ${productId} from ${imageUrl}`)
              
              // Try Firebase Storage SDK first (with proper authentication)
              let imageDataUrl: string
              let imageFormat: 'PNG' | 'JPEG' | 'JPG' = 'PNG'
              
              try {
                // Extract storage path from URL if it's a Firebase Storage URL
                if (imageUrl.includes('firebasestorage.googleapis.com')) {
                  const urlMatch = imageUrl.match(/\/o\/([^?]+)/)
                  if (urlMatch) {
                    const storagePath = decodeURIComponent(urlMatch[1])
                    console.log(`[PDF] Using Firebase Storage SDK for path: ${storagePath}`)
                    const imageRef = ref(storage, storagePath)
                    const imageBytes = await getBytes(imageRef)
                    const imageBlob = new Blob([imageBytes])
                    
                    // Convert blob to data URL
                    imageDataUrl = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onloadend = () => resolve(reader.result as string)
                      reader.onerror = reject
                      reader.readAsDataURL(imageBlob)
                    })
                    
                    // Determine format from blob type or URL
                    if (imageBlob.type === 'image/png' || storagePath.toLowerCase().endsWith('.png')) {
                      imageFormat = 'PNG'
                    } else if (imageBlob.type === 'image/jpeg' || imageBlob.type === 'image/jpg' || 
                              storagePath.toLowerCase().endsWith('.jpg') || storagePath.toLowerCase().endsWith('.jpeg')) {
                      imageFormat = 'JPEG'
                    } else {
                      imageFormat = 'PNG' // Default to PNG
                    }
                    
                    console.log(`[PDF] Successfully loaded image via Firebase Storage SDK for ${productId}`)
                  } else {
                    throw new Error('Could not parse storage path from URL')
                  }
                } else {
                  throw new Error('Not a Firebase Storage URL')
                }
              } catch (storageError) {
                console.log(`[PDF] Firebase Storage SDK failed for ${productId}, trying img element:`, storageError)
                // Fallback: Use img element with canvas
                imageDataUrl = await new Promise<string>((resolve, reject) => {
                  const img = new Image()
                  img.crossOrigin = 'anonymous'
                  
                  const timeout = setTimeout(() => {
                    reject(new Error('Image load timeout'))
                  }, 10000)
                  
                  img.onload = () => {
                    clearTimeout(timeout)
                    try {
                      const canvas = document.createElement('canvas')
                      canvas.width = img.width
                      canvas.height = img.height
                      const ctx = canvas.getContext('2d')
                      if (!ctx) {
                        reject(new Error('Could not get canvas context'))
                        return
                      }
                      ctx.drawImage(img, 0, 0)
                      const dataUrl = canvas.toDataURL('image/png')
                      imageFormat = 'PNG'
                      resolve(dataUrl)
                    } catch (err) {
                      reject(err)
                    }
                  }
                  
                  img.onerror = () => {
                    clearTimeout(timeout)
                    reject(new Error('Image load failed'))
                  }
                  
                  img.src = imageUrl
                })
              }
              
              // Add image to PDF
              doc.addImage(imageDataUrl, imageFormat, imageX, imageY, imageSize, imageSize)
              console.log(`[PDF] Successfully added image for product ${productId}`)
              return true
            } catch (imgError) {
              console.warn(`[PDF] Could not load product image for ${productId}:`, imgError)
              // Don't throw - just return false so PDF generation can continue
            }
          } else {
            console.warn(`[PDF] No imageUrl found for product ${productId}`)
          }
        } else {
          console.warn(`[PDF] Product ${productId} not found in Firestore`)
        }
      } catch (error) {
        console.warn(`[PDF] Could not fetch product ${productId}:`, error)
      }
      return false
    }

    // Process items sequentially to handle async image loading
    for (let index = 0; index < po.lineItems.length; index++) {
      const item = po.lineItems[index]
      
      if (y > pageHeight - 50) {
        doc.addPage()
        y = margin + 10
      }

      const rowStartY = y
      y += 5
      x = tableStartX + 2
      
      if (selectedFields.includes('lineItem')) {
        doc.text(String(index + 1), x, y)
        x += colWidths.lineItem
      }
      if (selectedFields.includes('itemDescription')) {
        const descriptionX = x
        const descriptionY = y
        
        // Add product image if available and includePhotos is true (before description text)
        let imageAdded = false
        if (includePhotos && item.productId && workspaceId) {
          console.log(`[PDF] Attempting to load image for item ${index + 1}, productId: ${item.productId}`)
          try {
            imageAdded = await loadAndAddProductImage(item.productId, descriptionX, descriptionY - 2, 10)
            if (imageAdded) {
              x += 12 // Add space for image
              console.log(`[PDF] Image successfully added for item ${index + 1}`)
            } else {
              console.log(`[PDF] Image not added for item ${index + 1} (image may not exist or failed to load)`)
            }
          } catch (error) {
            console.warn(`[PDF] Error loading image for product ${item.productId}:`, error)
          }
        } else {
          if (!includePhotos) {
            console.log(`[PDF] Photos disabled, skipping image for item ${index + 1}`)
          } else if (!item.productId) {
            console.log(`[PDF] No productId for item ${index + 1}, skipping image`)
          } else if (!workspaceId) {
            console.log(`[PDF] No workspaceId, skipping image for item ${index + 1}`)
          }
        }
        
        const description = item.itemDescription || ''
        // Split long descriptions if needed
        const maxWidth = colWidths.description - (imageAdded ? 14 : 4)
        const lines = doc.splitTextToSize(description, maxWidth)
        doc.text(lines[0] || '', x, y)
        if (lines.length > 1) {
          // Handle multi-line descriptions
          for (let i = 1; i < lines.length; i++) {
            y += 3.5
            doc.text(lines[i], x, y)
          }
        }
        x += colWidths.description
      }
      if (selectedFields.includes('partNumber')) {
        doc.text(item.partNumber || '-', x, y)
        x += colWidths.partNumber
      }
      if (selectedFields.includes('quantity')) {
        doc.text(`${item.orderQuantity}`, x, y)
        x += colWidths.quantity
      }
      if (selectedFields.includes('unitName')) {
        doc.text(item.uom || '-', x, y)
        x += colWidths.unitName
      }
      if (selectedFields.includes('unitRate')) {
        doc.text(item.unitRate.toFixed(6), x, y)
        x += colWidths.unitRate
      }
      if (selectedFields.includes('amount')) {
        doc.text(item.amount.toFixed(2), x, y)
      }
      
      // Add item notes if selected and available
      if (selectedFields.includes('itemNotes') && (item as any).notes) {
        y += 3.5
        doc.setFontSize(7)
        doc.setTextColor(...COLORS.label)
        const notesX = tableStartX + 2
        const notesText = String((item as any).notes || '')
        const notesLines = doc.splitTextToSize(notesText, pageWidth - 2 * margin - 4)
        notesLines.forEach((line: string) => {
          doc.text(`Note: ${line}`, notesX, y)
          y += 3
        })
        doc.setFontSize(8)
        doc.setTextColor(...COLORS.text)
      }

      y += 2
      doc.setDrawColor(240, 240, 240)
      doc.setLineWidth(0.2)
      doc.line(tableStartX, y, pageWidth - margin, y)
    }
  }

  // Order Summary - with box
  y = Math.max(y, pageHeight - 60)
  const summaryBoxWidth = 70
  const summaryBoxX = pageWidth - margin - summaryBoxWidth
  const summaryBoxY = y - 5
  
  doc.setFillColor(...COLORS.bgLight)
  doc.rect(summaryBoxX, summaryBoxY, summaryBoxWidth, 35, 'F')
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.3)
  doc.rect(summaryBoxX, summaryBoxY, summaryBoxWidth, 35, 'S')
  
  let summaryY = summaryBoxY + 8
  const summaryLabelX = summaryBoxX + 3
  const summaryValueX = summaryBoxX + summaryBoxWidth - 3
  
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.label)

  // Calculate subtotal from line items
  const subtotal = Array.isArray(po.lineItems) 
    ? po.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)
    : 0
  
  if (selectedFields.includes('subtotal')) {
    doc.text('Subtotal:', summaryLabelX, summaryY)
    doc.setTextColor(...COLORS.text)
    doc.text(`GBP ${subtotal.toFixed(2)}`, summaryValueX, summaryY, { align: 'right' })
    summaryY += 5
  }

  // Get discounts, tax, shipping from PO if available, otherwise use 0
  const discounts = (po as any).discounts || 0
  const tax = (po as any).tax || 0
  const shipping = (po as any).shipping || 0

  if (selectedFields.includes('discounts')) {
    doc.setTextColor(...COLORS.label)
    doc.text('Discounts:', summaryLabelX, summaryY)
    doc.setTextColor(...COLORS.text)
    doc.text(`GBP ${discounts.toFixed(2)}`, summaryValueX, summaryY, { align: 'right' })
    summaryY += 5
  }

  if (selectedFields.includes('tax')) {
    doc.setTextColor(...COLORS.label)
    doc.text('Tax:', summaryLabelX, summaryY)
    doc.setTextColor(...COLORS.text)
    doc.text(`GBP ${tax.toFixed(2)}`, summaryValueX, summaryY, { align: 'right' })
    summaryY += 5
  }

  if (selectedFields.includes('shipping')) {
    doc.setTextColor(...COLORS.label)
    doc.text('Shipping:', summaryLabelX, summaryY)
    doc.setTextColor(...COLORS.text)
    doc.text(`GBP ${shipping.toFixed(2)}`, summaryValueX, summaryY, { align: 'right' })
    summaryY += 5
  }

  // Total line with separator
  doc.setDrawColor(...COLORS.border)
  doc.setLineWidth(0.5)
  doc.line(summaryBoxX + 3, summaryY, summaryBoxX + summaryBoxWidth - 3, summaryY)
  summaryY += 3
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.text)
  doc.text('ORDER TOTAL:', summaryLabelX, summaryY)
  doc.text(`GBP ${po.orderTotal.toFixed(2)}`, summaryValueX, summaryY, { align: 'right' })
  
  // Reset font to normal
  doc.setFont('helvetica', 'normal')

    console.log('[generatePurchaseOrderPDFBlob] PDF generation completed')
    const blob = doc.output('blob')
    console.log('[generatePurchaseOrderPDFBlob] Blob created:', blob.size, 'bytes')
    return blob
  } catch (error) {
    console.error('[generatePurchaseOrderPDFBlob] Error generating PDF:', error)
    throw error
  }
}

export async function downloadPurchaseOrderPDF(
  po: PurchaseOrder,
  companyInfo: any = {},
  options: ExportOptions = {},
  workspaceId?: string
): Promise<void> {
  try {
    console.log('[downloadPurchaseOrderPDF] Starting PDF generation:', { po, companyInfo, options })
    const blob = await generatePurchaseOrderPDFBlob(po, companyInfo, options, workspaceId)
    console.log('[downloadPurchaseOrderPDF] PDF blob created:', blob)
    
    const url = URL.createObjectURL(blob)
    const filename = `PO_${po.poNumber}_${new Date().toISOString().split('T')[0]}.pdf`
    
    console.log('[downloadPurchaseOrderPDF] Creating download link:', filename)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    
    document.body.appendChild(link)
    
    try {
      link.click()
      console.log('[downloadPurchaseOrderPDF] Download triggered')
      // Clean up after a short delay
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link)
        }
        URL.revokeObjectURL(url)
      }, 100)
    } catch (clickError) {
      console.warn('[downloadPurchaseOrderPDF] Programmatic click failed, opening in new window:', clickError)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } catch (error) {
    console.error('[downloadPurchaseOrderPDF] PDF download error:', error)
    throw new Error(`PDF indirilemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
  }
}
