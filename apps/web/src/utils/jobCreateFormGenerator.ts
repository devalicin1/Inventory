import jsPDF from 'jspdf'
import { generateQRCodeDataURL } from './qrcode' // Önceki dosyalardaki QR fonksiyonu

// --- TİPLER ---
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

// --- RENK PALETİ (Kurumsal Uyumlu) ---
const COLORS = {
  text: [30, 30, 30],
  label: [100, 100, 100],
  accent: [106, 13, 173],    // Bu form için Mor/Purple aksan (Ayırt edici olması için)
  bgLight: [248, 249, 250],  // Çok açık gri
  border: [220, 220, 220],   // Gri Çerçeve
  highlight: [243, 235, 255] // Açık mor vurgu arka planı
}

import { LOGO_PDF_URL } from './logo'
const COMPANY_LOGO = LOGO_PDF_URL

export async function generateJobCreateFormPDFBlob(overrides: JobCreateFormOverrides = {}): Promise<Blob> {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const pageWidth = 210
    const pageHeight = 297
    const margin = 15
    let currentY = margin

    // --- YARDIMCI FONKSİYONLAR ---

    const checkPageBreak = (requiredHeight: number) => {
      if (currentY + requiredHeight > pageHeight - margin) {
        doc.addPage()
        currentY = margin
        return true
      }
      return false
    }

    const drawDataBlock = (label: string, value: string, x: number, y: number, width: number, highlight = false) => {
      // Highlight background opsiyonu
      if (highlight) {
        doc.setFillColor(COLORS.highlight[0], COLORS.highlight[1], COLORS.highlight[2])
        doc.rect(x - 2, y - 2, width + 2, 9, 'F')
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
      doc.text(label.toUpperCase(), x, y)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
      
      const splitValue = doc.splitTextToSize(value || '-', width)
      doc.text(splitValue, x, y + 4)
      return splitValue.length * 4
    }

    const drawBox = (x: number, y: number, w: number, h: number, title?: string) => {
      doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
      doc.setLineWidth(0.3)
      doc.rect(x, y, w, h)
      
      if (title) {
          doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2])
          doc.rect(x, y, w, 7, 'F')
          doc.rect(x, y, w, 7, 'S')
          
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
          doc.text(title.toUpperCase(), x + 3, y + 4.5)
      }
    }

    // --- HEADER ---
    const drawHeader = async () => {
      try {
        const res = await fetch(COMPANY_LOGO)
        if (res.ok) {
          const blob = await res.blob()
          const reader = new FileReader()
          const dataUrl = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(String(reader.result))
            reader.readAsDataURL(blob)
          })
          doc.addImage(dataUrl, 'PNG', margin, margin, 30, 12)
        }
      } catch {}

      const titleY = margin + 5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
      doc.text('JOB SHEET / CREATE ORDER', pageWidth - margin - 4, titleY, { align: 'right' })

      doc.setFontSize(9)
      doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
      const dateStr = overrides.date || new Date().toLocaleDateString('en-GB')
      doc.text(`ORDER REF: ${overrides.orderNo || 'DRAFT'}  |  DATE: ${dateStr}`, pageWidth - margin - 4, titleY + 6, { align: 'right' })

      // QR Code
      try {
        const qrData = `JobCreate:${overrides.orderNo || ''};Date:${dateStr}`
        const qrResult = await generateQRCodeDataURL(qrData, { scale: 6 }) // Increased for better scanning
        doc.addImage(qrResult.dataUrl, 'PNG', pageWidth - margin - 20, margin - 2, 18, 18) // Increased size
      } catch (e) {}

      currentY += 20
    }

    await drawHeader()

    // --- 1. ÖZET ŞERİDİ (Top Strip) ---
    const stripHeight = 16
    doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2])
    doc.rect(margin, currentY, pageWidth - margin * 2, stripHeight, 'F')
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
    doc.rect(margin, currentY, pageWidth - margin * 2, stripHeight, 'S')

    const colW = (pageWidth - margin * 2) / 4
    let stripX = margin + 4
    const stripY = currentY + 5

    drawDataBlock('Order Date', overrides.date || new Date().toLocaleDateString('en-GB'), stripX, stripY, colW)
    drawDataBlock('Order No', overrides.orderNo || '-', stripX + colW, stripY, colW)
    drawDataBlock('Required By', overrides.required || 'ASAP', stripX + colW * 2, stripY, colW, true)
    drawDataBlock('Price Quoted', overrides.priceQuoted || 'TBC', stripX + colW * 3, stripY, colW)

    currentY += stripHeight + 6

    // --- 2. İŞ VE BOYUT DETAYLARI (Two Boxes) ---
    const jobBoxH = 55
    const boxW = (pageWidth - margin * 2 - 5) / 2
    
    // SOL KUTU: İş Bilgileri
    drawBox(margin, currentY, boxW, jobBoxH, 'Job Description')
    let leftX = margin + 4
    let leftY = currentY + 12

    // Title (Uzun olabilir)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
    doc.text('TITLE / DESCRIPTION', leftX, leftY)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
    const titleLines = doc.splitTextToSize(overrides.title || '-', boxW - 8)
    doc.text(titleLines, leftX, leftY + 4)
    
    leftY += titleLines.length * 4 + 6 // Dinamik boşluk

    drawDataBlock('Style', overrides.style || '-', leftX, leftY, boxW - 8)
    leftY += 12
    drawDataBlock('Working To', overrides.workingTo || '-', leftX, leftY, boxW - 8)
    leftY += 12
    drawDataBlock('Number Up', String(overrides.numberUp || '-'), leftX, leftY, boxW - 8)

    // SAĞ KUTU: Boyutlar ve Malzeme
    drawBox(margin + boxW + 5, currentY, boxW, jobBoxH, 'Dimensions & Material')
    let rightX = margin + boxW + 9
    let rightY = currentY + 12

    drawDataBlock('Material', overrides.material || '-', rightX, rightY, boxW - 8, true)
    rightY += 12
    
    // Boyut Birleştirme
    const finishedSize = `${overrides.sizeW || '?'} x ${overrides.sizeL || '?'} x ${overrides.sizeH || '?'}`
    drawDataBlock('Finished Size (W x L x H)', finishedSize, rightX, rightY, boxW - 8)
    rightY += 12
    
    const formeSize = `${overrides.formeW || '?'} x ${overrides.formeL || '?'}`
    drawDataBlock('Forme Size (W x L)', formeSize, rightX, rightY, boxW - 8)
    rightY += 12
    
    const boardSize = `${overrides.boardW || '?'} x ${overrides.boardL || '?'}`
    drawDataBlock('Board Size (W x L)', boardSize, rightX, rightY, boxW - 8)

    currentY += jobBoxH + 6

    // --- 3. TEKNİK SPESİFİKASYONLAR (Grid Layout) ---
    const specsH = 45
    drawBox(margin, currentY, pageWidth - margin * 2, specsH, 'Technical Specifications')
    
    let specX = margin + 4
    let specY = currentY + 12
    const specColW = (pageWidth - margin * 2) / 3

    // Satır 1
    drawDataBlock('Machine', overrides.machine || '-', specX, specY, specColW)
    drawDataBlock('Scoring Rule Height', overrides.scoringRuleHeight || '-', specX + specColW, specY, specColW)
    drawDataBlock('Nicks', overrides.nicks || '-', specX + specColW * 2, specY, specColW)
    
    // Satır 2
    specY += 14
    drawDataBlock('Spare Rule', overrides.spareRule || '-', specX, specY, specColW)
    drawDataBlock('Patch Up Sheet', overrides.patchUpSheet || '-', specX + specColW, specY, specColW)
    drawDataBlock('Counters', overrides.counters || '-', specX + specColW * 2, specY, specColW)

    // Satır 3
    specY += 14
    drawDataBlock('Stripping Tooling', overrides.strippingTooling || '-', specX, specY, specColW)
    // Boş alan kalırsa diye ek bilgi eklenebilir

    currentY += specsH + 6

    // --- 4. NOTLAR (Full Width) ---
    const notes = overrides.note || 'No additional notes provided.'
    const notesH = 35
    checkPageBreak(notesH)

    drawBox(margin, currentY, pageWidth - margin * 2, notesH, 'Additional Notes')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
    const noteLines = doc.splitTextToSize(notes, pageWidth - margin * 2 - 8)
    doc.text(noteLines, margin + 4, currentY + 12)

    currentY += notesH + 6

    // --- FOOTER & İMZALAR ---
    const footerH = 35
    let footerY = pageHeight - footerH - 10
    if (currentY > footerY) { doc.addPage(); footerY = pageHeight - footerH - 10 }

    const sigW = (pageWidth - margin * 2) / 2
    const sigH = 20

    const drawSigBox = (title: string, x: number) => {
        doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]); doc.rect(x, footerY, sigW - 5, sigH)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
        doc.text(title, x + 2, footerY + 4)
        doc.setDrawColor(200, 200, 200); doc.line(x + 5, footerY + sigH - 6, x + sigW - 10, footerY + sigH - 6)
    }

    drawSigBox('REQUESTED BY', margin)
    drawSigBox('APPROVED BY', margin + sigW)

    // Alt Bilgi Çizgisi
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

    doc.setFontSize(7)
    doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]) // Mor Aksan Rengi
    doc.setFont('helvetica', 'bold')
    doc.text(`Generated via Create Form`, margin, pageHeight - 8) // Watermark benzeri

    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'normal')
    doc.text(new Date().toLocaleString(), pageWidth / 2, pageHeight - 8, { align: 'center' })
    doc.text('Page 1 of 1', pageWidth - margin, pageHeight - 8, { align: 'right' })

    return doc.output('blob')
  } catch (error) {
    console.error('Create Form PDF error:', error)
    throw error
  }
}

export async function downloadJobCreateFormPDF(overrides?: JobCreateFormOverrides): Promise<void> {
  const blob = await generateJobCreateFormPDFBlob(overrides)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Job_Create_Form_${overrides?.orderNo || 'New'}_${new Date().toISOString().split('T')[0]}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}