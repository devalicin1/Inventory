import jsPDF from 'jspdf'
import type { Job, ProductionRun } from '../api/production-jobs'

import { LOGO_PDF_URL } from './logo'
const COMPANY_LOGO = LOGO_PDF_URL

// --- TİPLER ---
export type DeliveryNoteOverrides = {
  deliveryDate?: string
  deliveryMethod?: string
  deliveryAddress?: string
  driverName?: string
  vehicleNumber?: string
  notes?: string
  // Job Information
  jobCode?: string
  customerName?: string
  customerPO?: string
  orderReference?: string
  estimateNo?: string
  // Product Information
  productName?: string
  sku?: string
  quantity?: number
  unit?: string
  // Packaging
  pcsPerBox?: number
  boxesPerPallet?: number
  plannedBoxes?: number
  actualBoxes?: number
  plannedPallets?: number
  actualPallets?: number
}

export type DeliveryNoteOptions = {
  productionRuns?: ProductionRun[]
  workflows?: Array<{ id: string; stages?: Array<{ id: string; outputUOM?: string }> }>
}

// --- RENK PALETİ (Kurumsal Gri/Mavi Tonları) ---
const COLORS = {
  text: [30, 30, 30],        // Koyu Gri (Ana Metin)
  label: [100, 100, 100],    // Açık Gri (Etiketler)
  accent: [41, 128, 185],    // Kurumsal Mavi (Çizgiler/Başlıklar)
  bgLight: [248, 249, 250],  // Çok açık gri (Arka planlar)
  border: [220, 220, 220]    // Çerçeve rengi
}

export async function generateDeliveryNotePDFBlob(
  job: Job,
  overrides: DeliveryNoteOverrides = {},
  options: DeliveryNoteOptions = {}
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  let y = margin

  // --- HESAPLAMA FONKSİYONLARI ---
  const calculateActualFromRuns = () => {
    const { productionRuns = [], workflows = [] } = options
    if (!productionRuns || productionRuns.length === 0) {
      return { actualBoxes: null, actualPallets: null }
    }

    const workflow = workflows.find((w: any) => w.id === job.workflowId)
    const plannedStages: string[] = Array.isArray((job as any).plannedStageIds) ? (job as any).plannedStageIds : []
    const lastStageId = plannedStages.length > 0 ? plannedStages[plannedStages.length - 1] : job.currentStageId

    let lastCartoonStageId: string | null = null
    for (let i = plannedStages.length - 1; i >= 0; i--) {
      const stageId = plannedStages[i]
      const stageInfo = workflow?.stages?.find((s: any) => s.id === stageId)
      if (stageInfo?.outputUOM === 'cartoon') {
        lastCartoonStageId = stageId
        break
      }
    }

    const targetStageId = lastCartoonStageId || lastStageId
    const targetStageRuns = productionRuns.filter((r: any) => r.stageId === targetStageId)

    const totalCartoonOutput = targetStageRuns.reduce((sum: number, r: any) => {
      return sum + Number(r.qtyGood || 0)
    }, 0)

    const pcsPerBox = job.packaging?.pcsPerBox || 1
    const calculatedActualBoxes = pcsPerBox > 0 ? Math.ceil(totalCartoonOutput / pcsPerBox) : 0
    const boxesPerPallet = job.packaging?.boxesPerPallet || 1
    const calculatedActualPallets = boxesPerPallet > 0 ? Math.ceil(calculatedActualBoxes / boxesPerPallet) : 0

    return {
      actualBoxes: calculatedActualBoxes > 0 ? calculatedActualBoxes : null,
      actualPallets: calculatedActualPallets > 0 ? calculatedActualPallets : null
    }
  }

  const calculatedActuals = calculateActualFromRuns()

  // --- ÇİZİM YARDIMCILARI ---

  // Metin Helper: Label (küçük) ve Value (büyük) alt alta
  const drawDataBlock = (label: string, value: string, x: number, y: number, width: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
    doc.text(label.toUpperCase(), x, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
    
    // Uzun metinleri sar (wrap)
    const splitValue = doc.splitTextToSize(value || '-', width)
    doc.text(splitValue, x, y + 4)
    
    return splitValue.length * 4 // Yükseklik dönüşü
  }

  // Kutu Çizici (Border Box)
  const drawBox = (x: number, y: number, w: number, h: number, title?: string) => {
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
    doc.setLineWidth(0.3)
    doc.rect(x, y, w, h)
    
    if (title) {
      // Kutu başlığı (arka planlı şerit)
      doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2])
      doc.rect(x, y, w, 7, 'F')
      doc.rect(x, y, w, 7, 'S') // Sınır çizgisini tekrar çiz
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
      doc.text(title.toUpperCase(), x + 3, y + 4.5)
    }
  }

  // Logo Yükleme
  const drawHeader = async () => {
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
        // Logo sol üst
        doc.addImage(logoDataUrl, 'PNG', margin, margin, 30, 12)
      }
    } catch (e) {}
  }

  // --- PDF OLUŞTURMA ADIMLARI ---

  await drawHeader()

  // 1. HEADER (Sağ Taraf: Belge Tipi ve No)
  const jobCode = overrides.jobCode || job.code || '-'
  const deliveryDate = overrides.deliveryDate || new Date().toLocaleDateString('en-GB')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
  doc.text('DELIVERY NOTE', pageWidth - margin, margin + 8, { align: 'right' })

  doc.setFontSize(10)
  doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
  doc.text(`DOC NO: DN-${jobCode}  |  DATE: ${deliveryDate}`, pageWidth - margin, margin + 14, { align: 'right' })

  // Gönderen Firma Bilgisi (Placeholder - Logo Altı)
  y = margin + 16
  doc.setFontSize(8)
  doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
  doc.text('Your Company Name\n123 Industrial Estate, City\nPhone: +1 234 567 890', margin, y)
  
  y += 12

  // 2. BİLGİ KUTULARI (Yan Yana İki Kutu: Müşteri ve Teslimat)
  const boxHeight = 35
  const boxWidth = (pageWidth - margin * 2 - 5) / 2
  
  // Sol Kutu: Müşteri Bilgileri
  drawBox(margin, y, boxWidth, boxHeight, 'Customer Details')
  let contentY = y + 12
  drawDataBlock('Customer Name', overrides.customerName || job.customer?.name || '-', margin + 3, contentY, boxWidth - 6)
  drawDataBlock('Customer PO', overrides.customerPO || job.customer?.orderNo || '-', margin + 3, contentY + 10, boxWidth - 6)
  drawDataBlock('Order Ref', overrides.orderReference || job.customer?.ref || '-', margin + boxWidth/2, contentY + 10, boxWidth/2 - 6)

  // Sağ Kutu: Teslimat Adresi
  drawBox(margin + boxWidth + 5, y, boxWidth, boxHeight, 'Delivery Address')
  const address = overrides.deliveryAddress || job.deliveryAddress || 'No address provided.'
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
  const addressLines = doc.splitTextToSize(address, boxWidth - 6)
  doc.text(addressLines, margin + boxWidth + 8, contentY)
  
  // Ek Bilgi (Metod/Araç)
  if (overrides.deliveryMethod || overrides.vehicleNumber) {
     doc.setFontSize(7)
     doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
     const transportInfo = `Method: ${overrides.deliveryMethod || '-'} | Vehicle: ${overrides.vehicleNumber || '-'}`
     doc.text(transportInfo, margin + boxWidth + 8, y + boxHeight - 3)
  }

  y += boxHeight + 6

  // 3. İŞ DETAYLARI ŞERİDİ (Yatay Bar)
  const stripHeight = 14
  doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2])
  doc.rect(margin, y, pageWidth - margin * 2, stripHeight, 'F')
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
  doc.rect(margin, y, pageWidth - margin * 2, stripHeight, 'S')

  const colW = (pageWidth - margin * 2) / 4
  let stripX = margin + 2
  const stripY = y + 4

  drawDataBlock('Job Code', jobCode, stripX, stripY, colW)
  drawDataBlock('Estimate No', overrides.estimateNo || job.customer?.estNo || '-', stripX + colW, stripY, colW)
  drawDataBlock('SKU', overrides.sku || job.sku || '-', stripX + colW * 2, stripY, colW)
  drawDataBlock('Total Qty', `${overrides.quantity || job.quantity || 0} ${overrides.unit || job.unit || 'units'}`, stripX + colW * 3, stripY, colW)

  y += stripHeight + 10

  // 4. ÜRÜN TABLOSU
  // Tablo Başlığı
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2])
  doc.text('ITEMS DELIVERED', margin, y - 2)
  
  // Çizgi
  doc.setDrawColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2])
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 1

  // Tablo Header
  const tHeadH = 8
  const cols = [15, 95, 25, 25, 30] // Qty, Desc, Unit, Boxes, Pallets
  const headers = ['QTY', 'DESCRIPTION', 'UNIT', 'BOXES', 'PALLETS']
  
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y, pageWidth - margin * 2, tHeadH, 'F')
  
  let tx = margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)
  
  headers.forEach((h, i) => {
    // Sağ hizalama sayısal değerler için
    const align = (i === 0 || i > 2) ? 'center' : 'left'
    const xOffset = align === 'center' ? cols[i]/2 : 2
    doc.text(h, tx + xOffset, y + 5, { align: align as any })
    tx += cols[i]
  })
  
  y += tHeadH

  // Tablo Satırı
  // Verileri Hesapla
  const productName = overrides.productName || job.productName || 'No Product Name'
  const quantity = overrides.quantity !== undefined ? overrides.quantity : (job.quantity || 0)
  const unit = overrides.unit || job.unit || 'units'
  
  const actualBoxes = overrides.actualBoxes ?? (calculatedActuals.actualBoxes ?? job.packaging?.actualBoxes ?? null)
  const plannedBoxes = overrides.plannedBoxes ?? (job.packaging?.plannedBoxes || 0)
  const finalBoxes = actualBoxes && actualBoxes > 0 ? actualBoxes : plannedBoxes

  const actualPallets = overrides.actualPallets ?? (calculatedActuals.actualPallets ?? job.packaging?.actualPallets ?? null)
  const finalPallets = actualPallets && actualPallets > 0 ? actualPallets : (job.packaging?.plannedPallets || 0)

  // Satır çizimi
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])

  const descLines = doc.splitTextToSize(productName, cols[1] - 4)
  const rowH = Math.max(10, descLines.length * 5 + 4)
  
  // Satır alt çizgisi
  doc.setDrawColor(230, 230, 230)
  doc.setLineWidth(0.2)
  doc.line(margin, y + rowH, pageWidth - margin, y + rowH)

  tx = margin
  // Qty
  doc.text(String(quantity), tx + cols[0]/2, y + 5, { align: 'center' })
  tx += cols[0]
  // Desc
  doc.text(descLines, tx + 2, y + 5)
  tx += cols[1]
  // Unit
  doc.text(unit, tx + 2, y + 5)
  tx += cols[2]
  // Boxes
  doc.text(finalBoxes > 0 ? String(finalBoxes) : '-', tx + cols[3]/2, y + 5, { align: 'center' })
  tx += cols[3]
  // Pallets
  doc.text(finalPallets > 0 ? String(finalPallets) : '-', tx + cols[4]/2, y + 5, { align: 'center' })

  y += rowH + 5

  // 5. PAKETLEME DETAYI (Küçük not alanı)
  const pcsPerBox = overrides.pcsPerBox ?? (job.packaging?.pcsPerBox || 0)
  if (pcsPerBox > 0) {
    doc.setFontSize(7)
    doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
    doc.text(`* Packaging Configuration: ${pcsPerBox} pcs/box | ${job.packaging?.boxesPerPallet || 0} boxes/pallet`, margin, y)
    y += 8
  }

  // 6. NOTLAR ALANI
  const notes = overrides.notes || job.notes
  if (notes) {
    y += 5
    drawBox(margin, y, pageWidth - margin * 2, 20, 'Notes / Special Instructions')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
    doc.text(doc.splitTextToSize(notes, pageWidth - margin * 2 - 6), margin + 3, y + 11)
  }

  // --- FOOTER & İMZALAR (Sabit Konum) ---
  const bottomMargin = 20
  let footerY = pageHeight - bottomMargin - 45 // İmza bloğu başlangıcı

  // Yasal Uyarı Metni
  doc.setFontSize(7)
  doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
  const disclaimer = "Received the above goods in good order and condition. Any discrepancies must be reported within 24 hours of receipt."
  doc.text(disclaimer, margin, footerY - 5)

  // İmza Alanları
  const sigW = (pageWidth - margin * 2) / 3
  const sigH = 25
  
  const drawSigBox = (title: string, x: number) => {
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
    doc.rect(x, footerY, sigW - 5, sigH) // Kutu
    
    // Başlık
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(title, x + 2, footerY + 4)
    
    // İmza Çizgisi (Kutunun içinde alt tarafta)
    doc.setDrawColor(200, 200, 200)
    doc.line(x + 5, footerY + sigH - 8, x + sigW - 10, footerY + sigH - 8)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text("Name & Signature", x + (sigW-5)/2, footerY + sigH - 2, { align: 'center' })
  }

  drawSigBox("DISPATCHED BY", margin)
  drawSigBox("CARRIER / DRIVER", margin + sigW)
  drawSigBox("RECEIVED BY (CUSTOMER)", margin + sigW * 2)

  // Sayfa Altı Bilgisi
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
  
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(`Job ID: ${job.code || job.id}`, margin, pageHeight - 8)
  doc.text(`This is a computer generated document.`, pageWidth/2, pageHeight - 8, { align: 'center' })
  doc.text('Page 1/1', pageWidth - margin, pageHeight - 8, { align: 'right' })

  return doc.output('blob')
}

export async function downloadDeliveryNotePDF(
  job: Job,
  overrides: DeliveryNoteOverrides = {},
  options: DeliveryNoteOptions = {}
): Promise<void> {
  const blob = await generateDeliveryNotePDFBlob(job, overrides, options)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `DN_${job.code || 'Draft'}_${new Date().toISOString().split('T')[0]}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}