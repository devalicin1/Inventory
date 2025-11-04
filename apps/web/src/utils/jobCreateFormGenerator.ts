import jsPDF from 'jspdf'

export type JobCreateFormOverrides = {
  date?: string
  orderNo?: string
  style?: string
  workingTo?: string
  sizeW?: number | string
  sizeL?: number | string
  sizeH?: number | string
  numberUp?: number | string
  title?: string
  formeW?: number | string
  formeL?: number | string
  material?: string
  machine?: string
  scoringRuleHeight?: string
  nicks?: string
  spareRule?: string
  patchUpSheet?: string
  counters?: string
  strippingTooling?: string
  boardW?: number | string
  boardL?: number | string
  priceQuoted?: string
  required?: string
  note?: string
}

export async function generateJobCreateFormPDFBlob(overrides: JobCreateFormOverrides = {}): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  const line = 6
  let yLeft = margin
  let yRight = margin

  // Styles similar to existing Download PDF, but distinct color accents
  const styles = {
    headerFill: [248, 249, 250],
    headerTitle: [20, 60, 120],
    subTitle: [90, 90, 90],
    sectionRule: [200, 200, 200],
    label: [80, 80, 80],
    value: [0, 0, 0],
    accent: [106, 13, 173], // purple accent to distinguish
  }

  const drawSectionTitleLeft = (title: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(styles.value[0], styles.value[1], styles.value[2])
    doc.text(title, margin, yLeft)
    doc.setDrawColor(styles.sectionRule[0], styles.sectionRule[1], styles.sectionRule[2])
    doc.line(margin, yLeft + 1, pageWidth - margin, yLeft + 1)
    yLeft += 6
  }

  const drawSectionTitleRight = (title: string, x: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(styles.value[0], styles.value[1], styles.value[2])
    doc.text(title, x, yRight)
    doc.setDrawColor(styles.sectionRule[0], styles.sectionRule[1], styles.sectionRule[2])
    doc.line(x, yRight + 1, pageWidth - margin, yRight + 1)
    yRight += 6
  }

  const drawLabelValueLeft = (label: string, value: string, x: number, width = 80) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(styles.label[0], styles.label[1], styles.label[2])
    doc.text(label, x, yLeft)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(styles.value[0], styles.value[1], styles.value[2])
    const lines = doc.splitTextToSize(value || '-', width)
    doc.text(lines, x + 40, yLeft)
    yLeft += Math.max(line, lines.length * 4 + 2)
  }

  // Header with light background and distinct badge
  doc.setFillColor(styles.headerFill[0], styles.headerFill[1], styles.headerFill[2])
  doc.rect(0, 0, pageWidth, 38, 'F')

  // Try to draw company logo on the left
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
      doc.addImage(dataUrl, 'PNG', margin, 8, 24, 12)
    }
  } catch {}

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(styles.headerTitle[0], styles.headerTitle[1], styles.headerTitle[2])
  const titleText = 'BALL PACKAGING LIMITED'
  doc.text(titleText, pageWidth / 2, 16, { align: 'center' })
  doc.setFontSize(12)
  doc.setTextColor(styles.subTitle[0], styles.subTitle[1], styles.subTitle[2])
  doc.text('CREATE PRODUCTION ORDER', pageWidth / 2, 24, { align: 'center' })

  // Purple badge to denote different form
  // QR code at far right
  const qrSize = 20
  const qrX = pageWidth - margin - qrSize
  const qrY = 9

  // QR code on header right (encodes order no + date)
  try {
    const qrData = encodeURIComponent(`Order:${overrides.orderNo || ''};Date:${overrides.date || ''}`)
    const qrRes = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=${qrSize*3}x${qrSize*3}&data=${qrData}`)
    if (qrRes.ok) {
      const blob = await qrRes.blob()
      const reader = new FileReader()
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      doc.addImage(dataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
    }
  } catch {}

  yLeft = 35
  yRight = 35

  // Columns
  const leftX = margin
  const rightX = pageWidth / 2

  // First block (left) - ORDER INFO
  drawSectionTitleLeft('ORDER INFORMATION')
  drawLabelValueLeft('ORDER DATE', (overrides.date || new Date().toISOString().split('T')[0]) as string, leftX)
  drawLabelValueLeft('ORDER NO', String(overrides.orderNo || ''), leftX)
  drawLabelValueLeft('STYLE', String(overrides.style || ''), leftX)
  drawLabelValueLeft('WORKING TO', String(overrides.workingTo || ''), leftX)
  drawLabelValueLeft('SIZE', `${overrides.sizeW || ''}  x  ${overrides.sizeL || ''}  x  ${overrides.sizeH || ''}`, leftX)
  drawLabelValueLeft('NUMBER UP', String(overrides.numberUp || ''), leftX)
  drawLabelValueLeft('TITLE', String(overrides.title || ''), leftX)
  drawLabelValueLeft('FORME SIZE', `${overrides.formeW || ''}  x  ${overrides.formeL || ''}`, leftX)

  // SPECIFICATIONS subsection
  drawSectionTitleLeft('SPECIFICATIONS')
  drawLabelValueLeft('MATERIAL', String(overrides.material || ''), leftX)

  // PROCESS & OTHER DETAILS (right column)
  // Right block
  yRight = 35 // align with top
  const saveY = yRight
  const drawRight = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(styles.label[0], styles.label[1], styles.label[2])
    doc.text(label, rightX, yRight)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(styles.value[0], styles.value[1], styles.value[2])
    const lines = doc.splitTextToSize(value || '-', 70)
    doc.text(lines, rightX + 45, yRight)
    yRight += Math.max(line, lines.length * 4 + 2)
  }

  drawSectionTitleRight('PROCESS & OTHER DETAILS', rightX)
  drawRight('MACHINE', String(overrides.machine || ''))
  drawRight('SCORING RULE HEIGHT', String(overrides.scoringRuleHeight || ''))
  drawRight('NICKS', String(overrides.nicks || ''))
  drawRight('SPARE RULE', String(overrides.spareRule || ''))
  drawRight('PATCH UP SHEET', String(overrides.patchUpSheet || ''))
  drawRight('COUNTERS', String(overrides.counters || ''))
  drawRight('STRIPPING TOOLING', String(overrides.strippingTooling || ''))
  drawRight('BOARD SIZE', `${overrides.boardW || ''}  x  ${overrides.boardL || ''}`)
  drawRight('PRICE QUOTED', String(overrides.priceQuoted || ''))
  drawRight('REQUIRED', String(overrides.required || ''))
  drawRight('NOTE', String(overrides.note || ''))

  // Watermark text at bottom-right to distinguish
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(styles.accent[0], styles.accent[1], styles.accent[2])
  doc.text('Generated via Create Form', pageWidth - margin, pageHeight - 7, { align: 'right' })

  return doc.output('blob')
}

export async function downloadJobCreateFormPDF(overrides?: JobCreateFormOverrides): Promise<void> {
  const blob = await generateJobCreateFormPDFBlob(overrides)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Job_Create_Form_${new Date().toISOString().split('T')[0]}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}


