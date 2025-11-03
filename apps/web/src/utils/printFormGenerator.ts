import jsPDF from 'jspdf'
import type { Job } from '../api/production-jobs'

export type PrintFormOverrides = {
  date?: string
  contact?: string
  orderNo?: string
  jobRef?: string
  jobTitle?: string
  minSheetsRequired?: number | string
  sheetsAvailable?: string
  boardWidth?: number | string
  boardLength?: number | string
  material?: string
  microns?: number | string
  colours?: number | string
  process?: number | string
  varnish?: string
  specialInstructions?: string
  whenRequired?: string
  plates?: string
  priceAgreed?: string
  platesNote?: string
  alert1?: string
  alert2?: string
  alert3?: string
}

export async function generatePrintFormPDFBlob(job: Job, overrides: PrintFormOverrides = {}): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  const sectionSpacing = 8
  const lineSpacing = 5
  let y = margin

  // Styles
  const styles = {
    header: { size: 16, color: [20, 60, 120] },
    sectionTitle: { size: 12, color: [0, 0, 0] },
    label: { size: 9, color: [80, 80, 80] },
    value: { size: 10, color: [0, 0, 0] },
    highlight: { color: [255, 245, 157] },
    warning: { color: [220, 53, 69] },
    success: { color: [40, 167, 69] }
  }

  const drawSectionTitle = (title: string, yPos: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(styles.sectionTitle.size)
    doc.setTextColor(styles.sectionTitle.color[0], styles.sectionTitle.color[1], styles.sectionTitle.color[2])
    doc.text(title, margin, yPos)
    // Underline
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, yPos + 1, pageWidth - margin, yPos + 1)
    return yPos + sectionSpacing
  }

  const drawField = (label: string, value: string, x: number, yPos: number, width = 85, isHighlighted = false) => {
    const fieldHeight = isHighlighted ? 8 : 0
    
    if (isHighlighted) {
      doc.setFillColor(styles.highlight.color[0], styles.highlight.color[1], styles.highlight.color[2])
      // Slightly smaller pill to avoid touching the next row
      doc.roundedRect(x - 2, yPos - 5, width + 4, fieldHeight, 2, 2, 'F')
    }

    // Label
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(styles.label.size)
    doc.setTextColor(styles.label.color[0], styles.label.color[1], styles.label.color[2])
    doc.text(label, x, yPos)
    
    // Value
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(styles.value.size)
    doc.setTextColor(styles.value.color[0], styles.value.color[1], styles.value.color[2])
    
    const maxWidth = width - 5
    const lines = doc.splitTextToSize(value || '-', maxWidth)
    doc.text(lines, x, yPos + lineSpacing)
    
    // Ensure enough gap after highlighted pills
    const used = (lines.length * lineSpacing) + (isHighlighted ? fieldHeight / 2 : 0)
    return yPos + used + 6
  }

  const drawTwoColumns = (
    leftLabel: string,
    leftValue: string,
    rightLabel: string,
    rightValue: string,
    yPos: number,
    options?: { leftW?: number; rightW?: number; leftHighlight?: boolean; rightHighlight?: boolean }
  ) => {
    const leftW = options?.leftW ?? 90
    const rightW = options?.rightW ?? 90
    const leftY = drawField(leftLabel, leftValue, leftCol, yPos, leftW, options?.leftHighlight)
    const rightY = drawField(rightLabel, rightValue, rightCol, yPos, rightW, options?.rightHighlight)
    return Math.max(leftY, rightY) + 2
  }

  const drawInfoBox = (messages: string[], yPos: number, type: 'warning' | 'info' = 'info') => {
    const boxPadding = 3
    const lineHeight = 4
    // no icon
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    
    if (type === 'warning') {
      doc.setFillColor(255, 243, 205)
      doc.setDrawColor(255, 193, 7)
      doc.setTextColor(133, 100, 4)
    } else {
      doc.setFillColor(229, 246, 253)
      doc.setDrawColor(23, 162, 184)
      doc.setTextColor(12, 84, 96)
    }
    
    // Calculate box height
    const boxHeight = messages.length * lineHeight + boxPadding * 2
    
    // Draw box
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, boxHeight, 3, 3, 'FD')
    
    // Draw messages
    messages.forEach((message, index) => {
      doc.text('•', margin + boxPadding, yPos + boxPadding + (index * lineHeight) + 3)
      doc.text(message, margin + boxPadding + 6, yPos + boxPadding + (index * lineHeight) + 3)
    })
    
    return yPos + boxHeight + sectionSpacing
  }

  // Header with improved styling
  doc.setFillColor(248, 249, 250)
  doc.rect(0, 0, pageWidth, 25, 'F')
  // Company logo (if accessible)
  try {
    const res = await fetch('/logo.png')
    if (res.ok) {
      const blob = await res.blob()
      const reader = new FileReader()
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      doc.addImage(dataUrl, 'PNG', margin, 6, 24, 10)
    }
  } catch {}
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(styles.header.size)
  doc.setTextColor(styles.header.color[0], styles.header.color[1], styles.header.color[2])
  doc.text('BALL PACKAGING LIMITED', pageWidth / 2, 15, { align: 'center' })
  
  doc.setFontSize(12)
  doc.setTextColor(100, 100, 100)
  doc.text('PRINT PRODUCTION ORDER', pageWidth / 2, 22, { align: 'center' })
  
  y = 35

  // Job Information Section
  y = drawSectionTitle('JOB INFORMATION', y)

  const leftCol = margin
  const rightCol = pageWidth / 2 + 10
  
  // First row
  y = drawTwoColumns(
    'Date',
    overrides.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    'Contact',
    overrides.contact || 'Deniz Nayir',
    y
  )

  // Second row
  y = drawTwoColumns(
    'Order No.', overrides.orderNo || job.customer?.orderNo || '-',
    'Job Ref.', overrides.jobRef || job.code || job.id,
    y
  )

  // Job Title (full width)
  y = drawField('Job Title', overrides.jobTitle || job.productName || job.sku || '-', leftCol, y, pageWidth - margin * 2)

  y += sectionSpacing

  // Production Requirements Section
  y = drawSectionTitle('PRODUCTION REQUIREMENTS', y)

  // Calculate sheet requirements
  const bomSheets = Array.isArray((job as any).bom)
    ? (job as any).bom
        .filter((b: any) => {
          const u = String(b.uom || '').toLowerCase()
          return u === 'sht' || u === 'sheet' || u === 'sheets'
        })
        .reduce((sum: number, b: any) => sum + Number(b.qtyRequired || 0), 0)
    : 0
  const sheetsToUse = bomSheets || (job.productionSpecs as any)?.sheetsToUse || 0
  const minSheets = overrides.minSheetsRequired ?? Math.max(0, Number(sheetsToUse) - 400)

  // Sheet requirements row
  y = drawTwoColumns(
    'Min Sheets Required', String(minSheets),
    'Sheets Available', String(overrides.sheetsAvailable || 'IMMEDIATELY'),
    y,
    { leftW: 90, rightW: 90, leftHighlight: true, rightHighlight: true }
  )

  // Board specifications
  const sheet = (job.productionSpecs as any)?.sheet || (job.productionSpecs as any)?.sheetSize
  const boardW = overrides.boardWidth ?? (sheet?.width ?? '-')
  const boardL = overrides.boardLength ?? (sheet?.length ?? '-')
  
  y = drawField('Board Size', `${boardW} × ${boardL}`, leftCol, y, 85, true)

  // Material row
  y = drawTwoColumns(
    'Material', overrides.material || (job.productionSpecs as any)?.board || '-',
    'Microns', String(overrides.microns ?? (job.productionSpecs as any)?.microns ?? '-'),
    y
  )

  // Printing specs row
  const colours = Number(overrides.colours ?? (job.productionSpecs as any)?.printedColors ?? 0)
  const process = overrides.process ?? colours
  
  y = drawTwoColumns('Colors', `${colours}`, 'Process', `${process}`, y)

  // Varnish
  y = drawField('Varnish', overrides.varnish || (job.productionSpecs as any)?.varnish || 'None', leftCol, y)

  y += sectionSpacing

  // Special Instructions Section
  y = drawSectionTitle('SPECIAL INSTRUCTIONS & NOTES', y)

  const notes = (overrides.specialInstructions ?? job.notes) || 'No special instructions'
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(200, 200, 200)
  const notesBoxHeight = 30
  doc.roundedRect(margin, y, pageWidth - margin * 2, notesBoxHeight, 3, 3, 'FD')
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(styles.value.size)
  doc.setTextColor(styles.value.color[0], styles.value.color[1], styles.value.color[2])
  
  const lines = doc.splitTextToSize(notes, pageWidth - margin * 2 - 10)
  lines.forEach((line: string, index: number) => {
    if (index < 5) { // Limit to 5 lines to avoid overlap
      doc.text(line, margin + 5, y + 8 + (index * 5))
    }
  })
  
  y += notesBoxHeight + 5

  // Important Information Section
  y = drawSectionTitle('IMPORTANT INFORMATION', y)

  // Plates information
  const plateText = `${overrides.plates || 'NEW PLATES'}${overrides.platesNote ? ` (${overrides.platesNote})` : ' (please use a cut blanket)'}`
  y = drawField('Plates Status', plateText, leftCol, y, pageWidth - margin * 2, true)

  y += 2

  // Delivery information
  y = drawField('When Required', (overrides.whenRequired || (job as any).whenRequired || 'URGENT').toString(), leftCol, y)

  // Price information
  y = drawField('Price Agreed', String(overrides.priceAgreed || 'To be confirmed'), leftCol, y)

  y += sectionSpacing

  // Critical Instructions Box
  y = drawInfoBox([
    overrides.alert1 || 'RETURN ALL MAKE-READYS ON TOP OF A PALLET',
    overrides.alert2 || '15mm GRIP REQUIRED TO FIRST CUT & SIDELAY OPERATORS SIDE',
    overrides.alert3 || 'QUALITY CHECKS MUST BE PERFORMED BEFORE DELIVERY'
  ], y, 'warning')

  // No footer text for cleaner output

  return doc.output('blob')
}

export async function downloadPrintFormPDF(job: Job, overrides?: PrintFormOverrides): Promise<void> {
  const blob = await generatePrintFormPDFBlob(job, overrides)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Print_Order_${job.code || job.id}_${new Date().toISOString().split('T')[0]}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}