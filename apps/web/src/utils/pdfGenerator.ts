import jsPDF from 'jspdf'
import { generateQRCodeDataURL } from './qrcode'
import type { Job } from '../api/production-jobs'

const COMPANY_LOGO = '/logo.png'

export async function generateJobPDFBlob(job: Job): Promise<Blob> {
  try {
    // Create PDF in portrait A4 format
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Constants for A4 page
    const pageWidth = 210
    const pageHeight = 297
    const margin = 12
    const contentWidth = pageWidth - (margin * 2)
    let currentY = margin

    // Helper to check if we need a page break
    const checkPageBreak = (requiredHeight: number): boolean => {
      if (currentY + requiredHeight > pageHeight - margin) {
        doc.addPage()
        currentY = margin
        return true
      }
      return false
    }

    // Header Section - Compact and professional
    const drawHeader = async () => {
      // Company logo and title section
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
          doc.addImage(logoDataUrl, 'PNG', margin, currentY, 25, 10)
        } else {
          throw new Error('Logo fetch failed')
        }
      } catch (error) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('INVENTORY SYSTEM', margin, currentY + 6)
      }

      // Document title (leave space for QR on the far right)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(44, 62, 80)
      doc.text('PRODUCTION ORDER', pageWidth - margin - 18, currentY + 6, { align: 'right' })

      // NEW / REPEAT badge next to logo
      const badgeLabel = job.isRepeat ? 'REPEAT' : 'NEW'
      const badgeColors = job.isRepeat ? { r: 59, g: 130, b: 246 } : { r: 16, g: 185, b: 129 }
      const badgeX = margin + 28
      const badgeY = currentY + 1
      doc.setFillColor(badgeColors.r, badgeColors.g, badgeColors.b)
      doc.roundedRect(badgeX, badgeY, 20, 7, 1.5, 1.5, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(badgeLabel, badgeX + 10, badgeY + 4, { align: 'center' })
      doc.setTextColor(44, 62, 80)

      // QR Code - positioned to the far right, not overlapping title
      const qrCodeText = job.code || job.id
      const qrResult = await generateQRCodeDataURL(qrCodeText, { scale: 4 })
      doc.addImage(qrResult.dataUrl, 'PNG', pageWidth - margin - 12, currentY - 1, 12, 12)

      currentY += 15
    }

    await drawHeader()

    // Divider line
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(margin, currentY, pageWidth - margin, currentY)
    currentY += 8

    // Compact section template
    const createCompactSection = (title: string, contentHeight: number = 0) => {
      checkPageBreak(contentHeight + 15)
      
      // Section title with subtle background
    doc.setFillColor(248, 249, 250)
    doc.rect(margin, currentY, contentWidth, 8, 'F')
      
      doc.setTextColor(44, 62, 80)
    doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 3, currentY + 6)
      
      // Add small breathing space below headers for readability
    currentY += 13
    }

    // Job Overview - Critical information first
    createCompactSection('JOB OVERVIEW', 25)

    // Use fixed 3-column grid anchors for perfect alignment
    const third = contentWidth / 3
    const colX = [margin, margin + third, margin + third * 2]

    // Build quantity extras (pallets, total pieces)
    const pcsPerBox = job.packaging?.pcsPerBox
    const boxesPerPallet = job.packaging?.boxesPerPallet
    const plannedBoxes = job.packaging?.plannedBoxes ?? (job.unit === 'box' ? job.quantity : undefined)
    const palletsCalc = job.packaging?.plannedPallets ?? (plannedBoxes && boxesPerPallet ? Math.ceil(plannedBoxes / boxesPerPallet) : undefined)
    const totalPieces = pcsPerBox && (plannedBoxes ?? (job.unit === 'box' ? job.quantity : undefined)) ? pcsPerBox * (plannedBoxes ?? job.quantity) : undefined
    const qtyExtras: string[] = []
    if (palletsCalc) qtyExtras.push(`${palletsCalc} pallets`)
    if (totalPieces) qtyExtras.push(`${totalPieces} pcs`)
    const quantityDisplay = `${job.quantity} ${job.unit || ''}`.trim() + (qtyExtras.length ? ` (${qtyExtras.join(', ')})` : '')

    // Main job info (row 1)
    const row1 = [
      { label: 'Job Code:', value: job.code || 'N/A' },
      { label: 'Product:', value: job.productName || job.sku || 'N/A' },
      { label: 'Quantity:', value: quantityDisplay },
    ] as const

    row1.forEach((item, index) => {
      const xPos = colX[index]
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 100, 100)
      doc.text(item.label, xPos, currentY)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(item.value, xPos, currentY + 4.5) // value on next line to avoid overlap
    })

    currentY += 8

    // Secondary job info (row 2) uses same anchors
    const row2 = [
      { label: 'Priority:', value: getPriorityLabel(job.priority) },
      { label: 'Status:', value: formatStatus(job.status) },
      { label: 'Due Date:', value: formatDate(job.dueDate) },
    ] as const

    row2.forEach((item, index) => {
      const xPos = colX[index]
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 100, 100)
      doc.text(item.label, xPos, currentY)
      doc.setFont('helvetica', 'normal')
      if (item.label === 'Priority:') {
        const c = getPriorityColor(job.priority)
        doc.setTextColor(c.r, c.g, c.b)
      } else {
        doc.setTextColor(0, 0, 0)
      }
      doc.text(item.value, xPos, currentY + 4.5)
      doc.setTextColor(0, 0, 0)
    })

    currentY += 14

    // Two-column layout for detailed information
    const columnWidth = contentWidth / 2
    const leftColumn = margin
    const rightColumn = margin + columnWidth + 5

    // Removed ORDER DETAILS section; status badges shown in header

    // Customer Information - Left Column
    createCompactSection('CUSTOMER INFORMATION', 20)
    const leftSectionTop = currentY - 10
    const leftFieldsStartY = currentY
    let lineY = currentY

    const addLeftField = (label: string, value?: string | number) => {
      if (value === undefined || value === null || value === '') return
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 100, 100)
      doc.text(label, leftColumn, lineY)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(String(value), leftColumn + 24, lineY)
      lineY += 4.5
    }

    addLeftField('Customer:', job.customer.name)
    addLeftField('Order No:', job.customer.orderNo)
    addLeftField('Estimate No:', job.customer.estNo)
    addLeftField('Customer PO:', job.customer.ref)
    // keep currentY aligned to last printed line
    currentY = lineY

    // Production Timeline - Right Column
    doc.setFillColor(248, 249, 250)
    doc.rect(rightColumn, leftSectionTop, columnWidth - 5, 6, 'F')
    
    doc.setTextColor(44, 62, 80)
      doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('PRODUCTION TIMELINE', rightColumn + 3, leftSectionTop + 4)

    const timelineInfo = [
      { label: 'Planned Start:', value: job.plannedStart ? formatDate(job.plannedStart) : 'Not set' },
      { label: 'Planned End:', value: job.plannedEnd ? formatDate(job.plannedEnd) : 'Not set' },
    ]

    // Align Planned dates roughly with the left column's first line, slightly lower
    const timelineStartY = leftFieldsStartY + 1
    timelineInfo.forEach((item, index) => {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 100, 100)
      doc.text(item.label, rightColumn, timelineStartY + (index * 4))
      
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(item.value, rightColumn + 28, timelineStartY + (index * 4))
    })

    currentY += 15

    // BOM Materials - Compact table
    if (job.bom && job.bom.length > 0) {
      createCompactSection('REQUIRED MATERIALS', job.bom.length * 4 + 12)

      // Compact table header
      doc.setFillColor(44, 62, 80)
      doc.rect(leftColumn, currentY, contentWidth, 4, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      
      doc.text('SKU', leftColumn + 2, currentY + 2.5)
      doc.text('MATERIAL', leftColumn + 35, currentY + 2.5)
      doc.text('QTY', leftColumn + 120, currentY + 2.5)
      doc.text('UNIT', leftColumn + 140, currentY + 2.5)
      
      currentY += 6

      // Table rows
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      
      job.bom.slice(0, 8).forEach((item) => { // Limit to 8 items for single page
        if (currentY + 4 > pageHeight - 30) return
        
        doc.setFontSize(8)
        
        // Truncate long text
        const skuText = (item.sku || 'N/A').length > 15 ? (item.sku || 'N/A').substring(0, 12) + '...' : (item.sku || 'N/A')
        doc.text(skuText, leftColumn + 2, currentY + 2.5)
        
        const materialName = item.name.length > 35 ? item.name.substring(0, 32) + '...' : item.name
        doc.text(materialName, leftColumn + 35, currentY + 2.5)
        
        doc.text(`${item.qtyRequired}`, leftColumn + 120, currentY + 2.5)
        doc.text(item.uom, leftColumn + 140, currentY + 2.5)
        
        currentY += 4
      })

      // Show "+X more" if there are more items
      if (job.bom.length > 8) {
        doc.setFontSize(7)
        doc.setTextColor(100, 100, 100)
        doc.text(`+${job.bom.length - 8} more items...`, leftColumn + 2, currentY + 2.5)
        currentY += 4
      }

      currentY += 8
    }

    // Production Specifications - Compact two-column layout
    if (job.productionSpecs && Object.keys(job.productionSpecs).length > 0) {
      const specs = job.productionSpecs
      createCompactSection('PRODUCTION SPECIFICATIONS', 40)

      // Helper function to add spec line
      const addSpecLine = (label: string, value: any, column: number) => {
        if (value === undefined || value === null || value === '') return
        
        const xPos = column === 1 ? leftColumn : rightColumn
        const yPos = currentY
        
      doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(100, 100, 100)
        doc.text(label, xPos, yPos)
        
      doc.setFont('helvetica', 'normal')
        doc.setTextColor(0, 0, 0)
        let displayValue: string
        if (typeof value === 'object') {
          const w = (value as any).width
          const l = (value as any).length
          const h = (value as any).height
          const parts: string[] = []
          if (w !== undefined) parts.push(String(w))
          if (l !== undefined) parts.push(String(l))
          if (h !== undefined) parts.push(String(h))
          displayValue = parts.length > 0 ? parts.join(' x ') + ' mm' : '[n/a]'
        } else {
          displayValue = String(value)
        }
        doc.text(displayValue, xPos + 20, yPos)
        
      currentY += 3.5
      }

      let tempY = currentY

      // Left column specs
      if (specs.size) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(44, 62, 80)
        doc.text('Dimensions (mm):', leftColumn, currentY)
        currentY += 3
        addSpecLine('W:', specs.size.width, 1)
        addSpecLine('L:', specs.size.length, 1)
        addSpecLine('H:', specs.size.height, 1)
        currentY += 3
      }

      if (specs.sheetSize || (specs as any).sheet) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(44, 62, 80)
        doc.text('Sheet Size (mm):', leftColumn, currentY)
        currentY += 3
        const sheetObj: any = (specs as any).sheetSize || (specs as any).sheet
        addSpecLine('Width:', sheetObj?.width, 1)
        addSpecLine('Length:', sheetObj?.length, 1)
        currentY += 3
      }

      if (specs.formeSize || (specs as any).forme) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(44, 62, 80)
        doc.text('Forme Dimensions (mm):', leftColumn, currentY)
        currentY += 3
        const formeObj: any = (specs as any).formeSize || (specs as any).forme
        addSpecLine('Width:', formeObj?.width, 1)
        addSpecLine('Length:', formeObj?.length, 1)
        currentY += 3
      }

      // Capture left column end to balance heights
      const leftColumnEndY = currentY
      // Right column specs
      currentY = tempY

      if (specs.numberUp || specs.printedColors || specs.board) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(44, 62, 80)
        doc.text('Parameters:', rightColumn, currentY)
        currentY += 3
        
        addSpecLine('Number Up:', specs.numberUp, 2)
         // Colors intentionally omitted from printout
        addSpecLine('Board:', specs.board, 2)
        if ((specs as any).gsm) addSpecLine('GSM:', (specs as any).gsm, 2)
        addSpecLine('Microns:', specs.microns, 2)
        addSpecLine('Varnish:', specs.varnish, 2)
         // Cut To duplicated elsewhere; omit here for cleaner layout
        addSpecLine('Sheets (incl. wastage):', specs.sheetsToUse, 2)
        if (specs.sheetSize) addSpecLine('Material Size:', specs.sheetSize, 2)
        if (specs.yield) addSpecLine('Yield:', specs.yield, 2)
        if ((specs as any).tags && Array.isArray((specs as any).tags) && (specs as any).tags.length > 0) {
          addSpecLine('Tags:', (specs as any).tags.join(', '), 2)
        }
      }

      // Ensure both columns align visually (use tallest of left/right)
      currentY = Math.max(currentY, leftColumnEndY, tempY + 22)
      currentY += 8
    }

    // Packaging & Delivery - Combined section
    const packaging = job.packaging
    const hasPackaging = !!(packaging && Object.keys(packaging).length > 0)
    const hasDelivery = job.deliveryAddress || job.deliveryMethod || job.outerType

    if (hasPackaging || hasDelivery) {
      createCompactSection('PACKAGING & DELIVERY', 25)

      // Calculate summary values
      const sumPcsPerBox = job.packaging?.pcsPerBox
      const sumBoxes = job.packaging?.plannedBoxes ?? (job.unit === 'box' ? job.quantity : undefined)
      const sumBoxesPerPallet = job.packaging?.boxesPerPallet
      const sumPallets = job.packaging?.plannedPallets ?? (sumBoxes && sumBoxesPerPallet ? Math.ceil(sumBoxes / sumBoxesPerPallet) : undefined)
      const sumTotalPcs = sumPcsPerBox && sumBoxes ? sumPcsPerBox * sumBoxes : undefined

      // Two-column grid
      const labelOffset = 32
      let leftY = currentY
      let rightY = currentY

      // Left column summary
      const leftRows: Array<{label: string; value: string}> = [
        { label: 'Total Box/PCS', value: `${sumBoxes ?? '—'} box / ${sumTotalPcs ?? '—'} pcs` },
        { label: 'Pallets', value: sumPallets !== undefined ? String(sumPallets) : '—' },
        { label: 'Pcs/Box', value: sumPcsPerBox !== undefined ? String(sumPcsPerBox) : '—' },
        { label: 'Boxes/Pallet', value: sumBoxesPerPallet !== undefined ? String(sumBoxesPerPallet) : '—' },
      ]
      leftRows.forEach((row) => {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(100, 100, 100)
        doc.text(row.label + ':', leftColumn, leftY)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0, 0, 0)
        doc.text(row.value, leftColumn + labelOffset, leftY)
        leftY += 4
      })

      // Right column delivery
      if (hasDelivery) {
        if (job.deliveryMethod) {
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(100, 100, 100)
          doc.text('Delivery Method:', rightColumn, rightY)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(0, 0, 0)
          doc.text(job.deliveryMethod, rightColumn + labelOffset, rightY)
          rightY += 4
        }

        if (job.deliveryAddress) {
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(100, 100, 100)
          doc.text('Address:', rightColumn, rightY)
          rightY += 3
          const addrLines = doc.splitTextToSize(job.deliveryAddress, columnWidth - labelOffset - 5)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(0, 0, 0)
          // ensure address aligns to same x for all lines
          const addrX = rightColumn + labelOffset
          addrLines.forEach((line: string, i: number) => {
            doc.text(line, addrX, rightY + i * 3)
          })
          rightY += addrLines.length * 3
        }

        // Delivery Date (same as due date)
        if (job.dueDate) {
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(100, 100, 100)
          doc.text('Delivery Date:', rightColumn, rightY + 3)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(0, 0, 0)
          doc.text(formatFullDate(job.dueDate), rightColumn + labelOffset, rightY + 3)
          rightY += 6
        }
      }

      currentY = Math.max(leftY, rightY) + 6
    }

    // Planned Output - Compact table
    if (job.output && job.output.length > 0) {
      createCompactSection('PLANNED OUTPUT', job.output.length * 4 + 12)

      // Table header
      doc.setFillColor(44, 62, 80)
      doc.rect(leftColumn, currentY, contentWidth, 4, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      
      doc.text('SKU', leftColumn + 2, currentY + 2.5)
      doc.text('PRODUCT', leftColumn + 35, currentY + 2.5)
      doc.text('QTY', leftColumn + 120, currentY + 2.5)
      doc.text('UOM', leftColumn + 140, currentY + 2.5)
      
      currentY += 6

      // Table rows
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      
      job.output.slice(0, 6).forEach((item) => { // Limit to 6 items
        if (currentY + 4 > pageHeight - 30) return
        
        doc.setFontSize(7)
        
        const skuText = (item.sku || 'N/A').length > 15 ? (item.sku || 'N/A').substring(0, 12) + '...' : (item.sku || 'N/A')
        doc.text(skuText, leftColumn + 2, currentY + 2.5)
        
        const productName = item.name.length > 35 ? item.name.substring(0, 32) + '...' : item.name
        doc.text(productName, leftColumn + 35, currentY + 2.5)
        
        const qtyValue = (item as any).qtyPlanned ?? (item as any).quantity ?? (item as any).qty ?? 0
        doc.text(String(qtyValue), leftColumn + 120, currentY + 2.5)
        doc.text(item.uom || job.unit || '', leftColumn + 140, currentY + 2.5)
        
        currentY += 4
      })

      if (job.output.length > 6) {
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text(`+${job.output.length - 6} more items...`, leftColumn + 2, currentY + 2.5)
        currentY += 4
      }

      currentY += 8
    }

    // Notes Section - Compact
    if (job.notes) {
      createCompactSection('SPECIAL INSTRUCTIONS', 20)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      
      const notesLines = doc.splitTextToSize(job.notes, contentWidth - 10)
      
      // Notes with subtle background
      doc.setFillColor(255, 253, 231)
      doc.rect(margin, currentY, contentWidth, notesLines.length * 3.5 + 4, 'F')
      
      doc.setDrawColor(241, 196, 15)
      doc.setLineWidth(0.2)
      doc.rect(margin, currentY, contentWidth, notesLines.length * 3.5 + 4)
      
      notesLines.forEach((line: string, index: number) => {
        doc.text(line, margin + 3, currentY + 3 + (index * 3.5))
      })
      
      currentY += notesLines.length * 3.5 + 8
    }

    // Footer
    const addFooter = () => {
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
      
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.setFont('helvetica', 'normal')
      
      // Left: Document info
      doc.text(`Job: ${job.code || job.id}`, margin, pageHeight - 8)
      
      // Center: Generation info
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
      
      // Right: Page info
      const pageCount = doc.getNumberOfPages()
      doc.text(`Page 1 of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
    }

    addFooter()

    // Return PDF as Blob
    const pdfBlob = doc.output('blob')
    return pdfBlob

  } catch (error) {
    console.error('PDF generation error:', error)
    throw new Error(`PDF oluşturulamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
  }
}

export async function downloadJobPDF(job: Job): Promise<void> {
  const blob = await generateJobPDFBlob(job)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Production_Order_${job.code || job.id}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function getPriorityLabel(priority: number): string {
  const labels: Record<number, string> = {
    1: 'CRITICAL',
    2: 'HIGH', 
    3: 'MEDIUM',
    4: 'LOW',
    5: 'VERY LOW',
  }
  return labels[priority] || 'UNKNOWN'
}

function getPriorityColor(priority: number): { r: number; g: number; b: number } {
  const colors: Record<number, { r: number; g: number; b: number }> = {
    1: { r: 220, g: 38, b: 38 },   // Red
    2: { r: 234, g: 88, b: 12 },   // Orange
    3: { r: 202, g: 138, b: 4 },   // Yellow
    4: { r: 22, g: 163, b: 74 },   // Green
    5: { r: 107, g: 114, b: 128 }, // Gray
  }
  return colors[priority] || { r: 107, g: 114, b: 128 }
}

function formatStatus(status: string): string {
  return status.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
}

function formatDate(date: any): string {
  if (!date) return 'Not set'
  
  try {
    let d: Date
    if (typeof date === 'string') {
      d = new Date(date)
    } else if (typeof date === 'number') {
      d = new Date(date)
    } else if (date?.seconds) {
      d = new Date(date.seconds * 1000)
    } else if (date instanceof Date) {
      d = date
    } else {
      return 'Invalid date'
    }

    if (isNaN(d.getTime())) {
      return 'Invalid date'
    }

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'Invalid date'
  }
}

// Full date with weekday, e.g., "Sat, Nov 22, 2025"
function formatFullDate(date: any): string {
  if (!date) return 'Not set'
  try {
    let d: Date
    if (typeof date === 'string') d = new Date(date)
    else if (typeof date === 'number') d = new Date(date)
    else if ((date as any)?.seconds) d = new Date((date as any).seconds * 1000)
    else if (date instanceof Date) d = date
    else return 'Invalid date'

    if (isNaN(d.getTime())) return 'Invalid date'
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return 'Invalid date'
  }
}