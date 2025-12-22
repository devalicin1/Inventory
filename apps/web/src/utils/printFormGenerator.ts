import jsPDF from 'jspdf'
import type { Job } from '../api/production-jobs'

import { LOGO_PDF_URL } from './logo'
const COMPANY_LOGO = LOGO_PDF_URL

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

// --- RENK PALETİ (Diğer formlarla uyumlu) ---
const COLORS = {
  text: [30, 30, 30],
  label: [100, 100, 100],
  accent: [41, 128, 185],    // Kurumsal Mavi
  bgLight: [248, 249, 250],  // Çok açık gri
  border: [220, 220, 220],   // Gri Çerçeve
  warning: {
    bg: [255, 252, 235],     // Açık Sarı Arka Plan
    border: [245, 230, 180], // Sarı Çerçeve
    text: [180, 100, 0]      // Koyu Sarı/Turuncu Metin
  },
  highlight: [231, 245, 255] // Mavi vurgu
}

export async function generatePrintFormPDFBlob(job: Job, overrides: PrintFormOverrides = {}): Promise<Blob> {
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

    const drawDataBlock = (label: string, value: string, x: number, y: number, width: number, colorOverride?: number[], highlight = false) => {
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
      if (colorOverride) doc.setTextColor(colorOverride[0], colorOverride[1], colorOverride[2])
      else doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
      
      const splitValue = doc.splitTextToSize(value || '-', width)
      doc.text(splitValue, x, y + 4)
      return splitValue.length * 4
    }

    const drawBox = (x: number, y: number, w: number, h: number, title?: string, filledHeader = true) => {
      doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
      doc.setLineWidth(0.3)
      doc.rect(x, y, w, h)
      
      if (title) {
          if (filledHeader) {
            doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2])
            doc.rect(x, y, w, 7, 'F')
            doc.rect(x, y, w, 7, 'S')
          }
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
      doc.setFontSize(20)
      doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
      doc.text('PRINT ORDER', pageWidth - margin - 4, titleY, { align: 'right' })

      doc.setFontSize(9)
      doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
      const dateStr = overrides.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      doc.text(`JOB ID: ${overrides.jobRef || job.code || job.id}  |  DATE: ${dateStr}`, pageWidth - margin - 4, titleY + 6, { align: 'right' })

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

    drawDataBlock('Contact Person', overrides.contact || 'Deniz Nayir', stripX, stripY, colW)
    drawDataBlock('When Required', overrides.whenRequired || (job as any).whenRequired || 'URGENT', stripX + colW, stripY, colW, COLORS.warning.text)
    drawDataBlock('Price Agreed', overrides.priceAgreed || 'TBC', stripX + colW * 2, stripY, colW)
    drawDataBlock('Order No', overrides.orderNo || job.customer?.orderNo || '-', stripX + colW * 3, stripY, colW)

    currentY += stripHeight + 6

    // --- 2. İŞ DETAYLARI (Job Info) ---
    const jobBoxH = 25
    drawBox(margin, currentY, pageWidth - margin * 2, jobBoxH, 'Job Information')
    
    const jobContentY = currentY + 12
    // Job Title tüm genişliği kaplar
    drawDataBlock('Job Title / Description', overrides.jobTitle || job.productName || job.sku || '-', margin + 4, jobContentY, pageWidth - margin * 2 - 8)
    
    currentY += jobBoxH + 6

    // --- 3. ÜRETİM GEREKSİNİMLERİ (Grid Layout) ---
    const specsBoxH = 55
    drawBox(margin, currentY, pageWidth - margin * 2, specsBoxH, 'Production & Material Specifications')
    
    let specX = margin + 4
    let specY = currentY + 12
    const specColW = (pageWidth - margin * 2) / 3

    // -- Hesaplamalar --
    const bomSheets = Array.isArray((job as any).bom)
    ? (job as any).bom.filter((b: any) => {
          const u = String(b.uom || '').toLowerCase()
          return u === 'sht' || u === 'sheet' || u === 'sheets'
      }).reduce((sum: number, b: any) => sum + Number(b.qtyRequired || 0), 0)
    : 0
    const sheetsToUse = bomSheets || (job.productionSpecs as any)?.sheetsToUse || 0
    const minSheets = overrides.minSheetsRequired ?? Math.max(0, Number(sheetsToUse) - 400)
    
    const sheet = (job.productionSpecs as any)?.sheet || (job.productionSpecs as any)?.sheetSize
    const boardW = overrides.boardWidth ?? (sheet?.width ?? '-')
    const boardL = overrides.boardLength ?? (sheet?.length ?? '-')
    const colours = Number(overrides.colours ?? (job.productionSpecs as any)?.printedColors ?? 0)
    const process = overrides.process ?? colours

    // Satır 1: Malzeme
    drawDataBlock('Material / Board', overrides.material || (job.productionSpecs as any)?.board || '-', specX, specY, specColW)
    drawDataBlock('Microns / Weight', String(overrides.microns ?? (job.productionSpecs as any)?.microns ?? '-'), specX + specColW, specY, specColW)
    drawDataBlock('Board Size', `${boardW} x ${boardL}`, specX + specColW * 2, specY, specColW, undefined, true) // Highlighted

    // Satır 2: Baskı
    specY += 14
    drawDataBlock('Printed Colours', String(colours), specX, specY, specColW)
    drawDataBlock('Process', String(process), specX + specColW, specY, specColW)
    drawDataBlock('Varnish', overrides.varnish || (job.productionSpecs as any)?.varnish || 'None', specX + specColW * 2, specY, specColW)

    // Satır 3: Miktar ve Plakalar
    specY += 14
    // Divider Line
    doc.setDrawColor(230, 230, 230); doc.line(margin, specY - 4, pageWidth - margin, specY - 4)
    
    drawDataBlock('Min Sheets Required', String(minSheets), specX, specY, specColW, undefined, true)
    drawDataBlock('Sheets Available', String(overrides.sheetsAvailable || 'IMMEDIATELY'), specX + specColW, specY, specColW)
    
    const plateText = `${overrides.plates || 'NEW PLATES'}${overrides.platesNote ? ` (${overrides.platesNote})` : ''}`
    drawDataBlock('Plates Status', plateText, specX + specColW * 2, specY, specColW, COLORS.warning.text)

    currentY += specsBoxH + 6

    // --- 4. KRİTİK UYARILAR (Alerts Box) ---
    const alerts = [
      overrides.alert1 || 'RETURN ALL MAKE-READYS ON TOP OF A PALLET',
      overrides.alert2 || '15mm GRIP REQUIRED TO FIRST CUT & SIDELAY OPERATORS SIDE',
      overrides.alert3 || 'QUALITY CHECKS MUST BE PERFORMED BEFORE DELIVERY'
    ]
    
    const alertH = alerts.length * 5 + 12
    checkPageBreak(alertH)
    
    // Özel Uyarı Kutusu Tasarımı
    doc.setFillColor(COLORS.warning.bg[0], COLORS.warning.bg[1], COLORS.warning.bg[2])
    doc.setDrawColor(COLORS.warning.border[0], COLORS.warning.border[1], COLORS.warning.border[2])
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, alertH, 2, 2, 'FD')
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(COLORS.warning.text[0], COLORS.warning.text[1], COLORS.warning.text[2])
    
    alerts.forEach((msg, i) => {
       doc.text(`•  ${msg}`, margin + 6, currentY + 8 + (i * 6))
    })
    
    currentY += alertH + 6

    // --- 5. ÖZEL TALİMATLAR (Notes) ---
    const notes = overrides.specialInstructions || job.notes || 'No special instructions.'
    const notesH = 30
    checkPageBreak(notesH)

    drawBox(margin, currentY, pageWidth - margin * 2, notesH, 'Special Instructions')
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

    drawSigBox('PRINT MANAGER', margin)
    drawSigBox('MACHINE OPERATOR', margin + sigW)

    // Alt Bilgi Çizgisi
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'normal')
    doc.text(`Print Order: ${job.code || job.id}`, margin, pageHeight - 8)
    doc.text(new Date().toLocaleString(), pageWidth / 2, pageHeight - 8, { align: 'center' })
    doc.text('Page 1 of 1', pageWidth - margin, pageHeight - 8, { align: 'right' })

    return doc.output('blob')

  } catch (error) {
    console.error('Print Form PDF error:', error)
    throw error
  }
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