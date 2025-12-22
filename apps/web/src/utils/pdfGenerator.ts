import jsPDF from 'jspdf'
import { generateQRCodeDataURL } from './qrcode'
import type { Job } from '../api/production-jobs'

import { LOGO_PDF_URL } from './logo'
const COMPANY_LOGO = LOGO_PDF_URL

const COLORS = {
  text: [30, 30, 30],
  label: [100, 100, 100],
  accent: [41, 128, 185],
  bgLight: [248, 249, 250],
  border: [220, 220, 220],
  priority: {
    high: [220, 38, 38],
    med: [234, 88, 12],
    low: [22, 163, 74]
  }
}

export async function generateJobPDFBlob(job: Job): Promise<Blob> {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const pageWidth = 210
    const pageHeight = 297
    const margin = 10 // Küçültüldü
    let currentY = margin

    // --- YARDIMCI HESAPLAMALAR (Eski koddaki mantığın aynısı) ---
    const pickNumber = (...values: Array<number | undefined | null>) => {
      for (const value of values) {
        if (typeof value === 'number' && !Number.isNaN(value)) return value
      }
      return undefined
    }

    const plannedData = (job.packaging as any)?.planned
    const pcsPerBox = job.packaging?.pcsPerBox ?? plannedData?.pcsPerBox
    const boxesPerPallet = job.packaging?.boxesPerPallet ?? plannedData?.boxesPerPallet
    const plannedBoxes = pickNumber(job.packaging?.plannedBoxes, plannedData?.totals?.outers, plannedData?.plannedBoxes, job.unit === 'box' ? job.quantity : undefined)
    
    // Palet ve Toplam Parça Hesaplaması
    const palletsCalc = pickNumber(
      job.packaging?.plannedPallets,
      plannedData?.totals?.pallets,
      plannedData?.pallets,
      plannedBoxes && boxesPerPallet ? Math.ceil(plannedBoxes / boxesPerPallet) : undefined
    )
    const totalPieces = pickNumber(
      pcsPerBox && plannedBoxes ? pcsPerBox * plannedBoxes : undefined,
      pcsPerBox && job.unit === 'box' ? pcsPerBox * (job.quantity || 0) : undefined
    )

    // Miktar Metnini Oluştur (Örn: 1000 units (2 pallets, 50000 pcs))
    const qtyExtras: string[] = []
    if (typeof palletsCalc === 'number') qtyExtras.push(`${palletsCalc} plts`)
    if (typeof totalPieces === 'number') qtyExtras.push(`${totalPieces} pcs`)
    const quantityDisplay = `${job.quantity} ${job.unit || ''}` 
    const quantitySubtext = qtyExtras.length ? `(${qtyExtras.join(', ')})` : ''

    // --- ÇİZİM FONKSİYONLARI ---

    const checkPageBreak = (requiredHeight: number) => {
      // Tek sayfaya sığdırmak için sayfa ekleme
      if (currentY + requiredHeight > pageHeight - margin - 30) {
        // İçeriği küçült veya atla
        return true
      }
      return false
    }

    const drawDataBlock = (label: string, value: string, x: number, y: number, width: number, colorOverride?: number[]) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6) // Küçültüldü
      doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
      doc.text(label.toUpperCase(), x, y)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8) // Küçültüldü
      if (colorOverride) doc.setTextColor(colorOverride[0], colorOverride[1], colorOverride[2])
      else doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
      
      const splitValue = doc.splitTextToSize(value || '-', width)
      doc.text(splitValue, x, y + 3.5) // Spacing azaltıldı
      return splitValue.length * 3.5
    }

    const drawBox = (x: number, y: number, w: number, h: number, title?: string) => {
      doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
      doc.setLineWidth(0.3)
      doc.rect(x, y, w, h)
      
      if (title) {
          doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2])
          doc.rect(x, y, w, 6, 'F') // Küçültüldü
          doc.rect(x, y, w, 6, 'S')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7) // Küçültüldü
          doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
          doc.text(title.toUpperCase(), x + 3, y + 4)
      }
    }

    // --- HEADER ---
    const drawHeader = async () => {
      try {
        const logoResponse = await fetch(COMPANY_LOGO)
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob()
          const logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(logoBlob)
          })
          doc.addImage(logoDataUrl, 'PNG', margin, margin, 25, 10) // Küçültüldü
        }
      } catch (e) {}

      const titleY = margin + 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16) // Küçültüldü
      doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2])
      doc.text('PRODUCTION ORDER', pageWidth - margin - 10, titleY, { align: 'right' })

      doc.setFontSize(7) // Küçültüldü
      doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2])
      doc.text(`JOB ID: ${job.code || job.id}  |  DATE: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 10, titleY + 5, { align: 'right' })

      try {
        const qrCodeText = job.code || job.id
        const qrResult = await generateQRCodeDataURL(qrCodeText, { scale: 6 }) // Increased for better scanning
        doc.addImage(qrResult.dataUrl, 'PNG', pageWidth - margin - 18, margin - 1, 16, 16) // Increased size
      } catch (e) {}

      currentY += 16 // Küçültüldü
    }

    await drawHeader()

    // --- 1. STATUS STRIP ---
    const stripHeight = 12 // Küçültüldü
    doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2])
    doc.rect(margin, currentY, pageWidth - margin * 2, stripHeight, 'F')
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2])
    doc.rect(margin, currentY, pageWidth - margin * 2, stripHeight, 'S')

    const colW = (pageWidth - margin * 2) / 4
    let stripX = margin + 3
    const stripY = currentY + 4 // Küçültüldü

    let priorityColor = COLORS.text
    if (job.priority === 1) priorityColor = COLORS.priority.high
    else if (job.priority === 2) priorityColor = COLORS.priority.med
    else if (job.priority === 4) priorityColor = COLORS.priority.low

    drawDataBlock('Order Status', job.isRepeat ? 'REPEAT ORDER' : 'NEW ORDER', stripX, stripY, colW)
    drawDataBlock('Priority', getPriorityLabel(job.priority), stripX + colW, stripY, colW, priorityColor)
    drawDataBlock('Due Date', formatDate(job.dueDate), stripX + colW * 2, stripY, colW)
    drawDataBlock('Status', formatStatus(job.status), stripX + colW * 3, stripY, colW)

    currentY += stripHeight + 4 // Küçültüldü

    // --- 2. INFO BOXES (Geri Eklenen Verilerle) ---
    const boxH = 35 // Küçültüldü
    const boxW = (pageWidth - margin * 2 - 5) / 2
    
    // Ürün Kutusu
    drawBox(margin, currentY, boxW, boxH, 'Product Details')
    let contentY = currentY + 10 // Küçültüldü
    drawDataBlock('Product Name', job.productName || '-', margin + 3, contentY, boxW - 6)
    drawDataBlock('SKU', job.sku || '-', margin + 3, contentY + 8, boxW - 6) // Küçültüldü
    
    // Miktar ve Detayı (Geri eklendi)
    drawDataBlock('Quantity', quantityDisplay, margin + boxW/2, contentY + 8, boxW/2 - 6) // Küçültüldü
    if (quantitySubtext) {
        doc.setFontSize(6); doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2]) // Küçültüldü
        doc.text(quantitySubtext, margin + boxW/2, contentY + 15) // Küçültüldü
    }

    // Müşteri Kutusu
    drawBox(margin + boxW + 5, currentY, boxW, boxH, 'Customer Information')
    drawDataBlock('Customer Name', job.customer.name, margin + boxW + 8, contentY, boxW - 6)
    
    // Eksik alanlar geri eklendi: PO, Ref, Cutter No
    drawDataBlock('Order No / PO', job.customer.orderNo || '-', margin + boxW + 8, contentY + 8, boxW/3) // Küçültüldü
    drawDataBlock('Reference', job.customer.ref || '-', margin + boxW + 8 + boxW/3, contentY + 8, boxW/3) // Küçültüldü
    drawDataBlock('Cutter No', (job as any).cutterNo || '-', margin + boxW + 8 + (boxW/3)*2, contentY + 8, boxW/3) // Küçültüldü
    
    // Planlanan Tarihler (Müşteri kutusu altına)
    const timelineY = currentY + 25 // Küçültüldü
    doc.setDrawColor(230, 230, 230); doc.line(margin + boxW + 5, timelineY, margin + boxW * 2 + 5, timelineY)
    doc.setFontSize(6); doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2]) // Küçültüldü
    doc.text(`Planned: ${formatDate(job.plannedStart)} - ${formatDate(job.plannedEnd)} | Est No: ${job.customer.estNo || '-'}`, margin + boxW + 8, timelineY + 6) // Küçültüldü

    currentY += boxH + 4 // Küçültüldü

    // --- 3. TESLİMAT & LOJİSTİK (YENİ EKLENEN BÖLÜM - EKSİK VERİLER İÇİN) ---
    // Teslimat adresi ve yöntemi önceki formda vardı, burada tekrar ekliyoruz.
    if (job.deliveryAddress || job.deliveryMethod) {
        const delH = 18 // Küçültüldü
        drawBox(margin, currentY, pageWidth - margin * 2, delH, 'Delivery & Logistics')
        
        const dX = margin + 3
        const dY = currentY + 10 // Küçültüldü
        const methodW = 40
        
        drawDataBlock('Delivery Method', job.deliveryMethod || '-', dX, dY, methodW)
        
        // Adres (Çok satırlı olabilir)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2]) // Küçültüldü
        doc.text('DELIVERY ADDRESS', dX + methodW, dY)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]) // Küçültüldü
        const addressLines = doc.splitTextToSize(job.deliveryAddress || '-', pageWidth - margin * 2 - methodW - 10)
        doc.text(addressLines, dX + methodW, dY + 3.5) // Küçültüldü
        
        currentY += delH + 4 // Küçültüldü
    }

    // --- 4. SPESİFİKASYONLAR (Tüm detaylar geri eklendi) ---
    if (job.productionSpecs && Object.keys(job.productionSpecs).length > 0) {
        const specs = job.productionSpecs as any
        const specBoxH = 32 // Küçültüldü
        checkPageBreak(specBoxH + 10)
        drawBox(margin, currentY, pageWidth - margin * 2, specBoxH, 'Production Specifications')
        
        let specX = margin + 3
        let specY = currentY + 10 // Küçültüldü
        const specColW = (pageWidth - margin * 2) / 4 // 4 Sütunlu yapı

        const renderSpec = (lbl: string, val: any) => {
             let v = val
             if (typeof val === 'object' && val !== null) {
                 if (val.width) v = `${val.width}x${val.length}${val.height ? 'x'+val.height : ''}mm`
                 else v = JSON.stringify(val)
             }
             drawDataBlock(lbl, String(v || '-'), specX, specY, specColW - 4)
        }

        // Col 1: Boyutlar
        if (specs.size) { renderSpec('Finished Size', specs.size); specY += 7 } // Küçültüldü
        if (specs.sheetSize || specs.sheet) { renderSpec('Sheet Size', specs.sheetSize || specs.sheet); specY += 7 } // Küçültüldü
        if (specs.formeSize || specs.forme) { renderSpec('Forme Size', specs.formeSize || specs.forme); specY += 7 } // Küçültüldü

        // Col 2: Malzeme
        specY = currentY + 10; specX += specColW // Küçültüldü
        if (specs.board) { renderSpec('Board', specs.board); specY += 7 } // Küçültüldü
        if (specs.gsm || specs.microns) { renderSpec('GSM / Microns', `${specs.gsm || '-'} / ${specs.microns || '-'}`); specY += 7 } // Küçültüldü
        if (specs.yield) { renderSpec('Yield', specs.yield); specY += 7 } // Küçültüldü

        // Col 3: Baskı
        specY = currentY + 10; specX += specColW // Küçültüldü
        if (specs.numberUp) { renderSpec('Number Up', specs.numberUp); specY += 7 } // Küçültüldü
        if (specs.varnish) { renderSpec('Varnish', specs.varnish); specY += 7 } // Küçültüldü
        if (specs.sheetsToUse) { renderSpec('Sheets (Inc. Waste)', specs.sheetsToUse); specY += 7 } // Küçültüldü

        // Col 4: Etiketler & Ekstralar
        specY = currentY + 10; specX += specColW // Küçültüldü
        if (specs.tags && Array.isArray(specs.tags)) { 
             renderSpec('Tags', specs.tags.join(', ')); specY += 7  // Küçültüldü
        }
        // Renkler (önceki kodda "excluded" denmişti ama veri varsa yazalım)
        if (specs.printedColors) { renderSpec('Colors', String(specs.printedColors)); }

        currentY += specBoxH + 4 // Küçültüldü
    }

    // --- 5. TABLOLAR (BOM & Output) ---
    const drawTableSection = (title: string, items: any[], headers: string[], colWidths: number[], type: 'bom' | 'output') => {
        if (!items || items.length === 0) return
        checkPageBreak(30) // Küçültüldü
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]) // Küçültüldü
        doc.text(title, margin, currentY); doc.line(margin, currentY + 1.5, pageWidth - margin, currentY + 1.5) // Küçültüldü
        currentY += 3 // Küçültüldü
        
        doc.setFillColor(240, 240, 240); doc.rect(margin, currentY, pageWidth - margin * 2, 5, 'F') // Küçültüldü
        let tx = margin
        doc.setFontSize(6); doc.setTextColor(0, 0, 0) // Küçültüldü
        headers.forEach((h, i) => { doc.text(h, tx + 2, currentY + 3.5); tx += colWidths[i] }) // Küçültüldü
        currentY += 5 // Küçültüldü

        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]) // Küçültüldü
        items.slice(0, 8).forEach((item) => { // Limit azaltıldı (15 -> 8)
            if (checkPageBreak(5)) return // Küçültüldü
            let vals = type === 'bom' 
                ? [item.sku || '-', item.name || '-', String(item.qtyRequired || 0), item.uom || '-']
                : [item.sku || '-', item.name || '-', String(item.qtyPlanned || item.quantity || 0), item.uom || job.unit || '-']
            
            tx = margin
            vals.forEach((v, i) => {
                const txt = (i === 1 && v.length > 30) ? v.substring(0, 27) + '...' : v // Küçültüldü
                doc.text(txt, tx + 2, currentY + 3) // Küçültüldü
                tx += colWidths[i]
            })
            doc.setDrawColor(230, 230, 230); doc.line(margin, currentY + 4.5, pageWidth - margin, currentY + 4.5) // Küçültüldü
            currentY += 4.5 // Küçültüldü
        })
        if (items.length > 8) { // Limit değişti
             doc.setFontSize(6); doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2]) // Küçültüldü
             doc.text(`... +${items.length - 8} more items`, margin, currentY + 3) // Küçültüldü
             currentY += 4 // Küçültüldü
        }
        currentY += 4 // Küçültüldü
    }

    if (job.bom && job.bom.length > 0) drawTableSection('REQUIRED MATERIALS (BOM)', job.bom, ['SKU', 'MATERIAL NAME', 'QTY', 'UNIT'], [30, 100, 25, 25], 'bom')
    if (job.output && job.output.length > 0) drawTableSection('PLANNED OUTPUT', job.output, ['SKU', 'PRODUCT NAME', 'QTY', 'UNIT'], [30, 100, 25, 25], 'output')

    // --- 6. PAKETLEME & NOTLAR ---
    checkPageBreak(25) // Küçültüldü
    const packaging = job.packaging
    if (packaging && (packaging.pcsPerBox || packaging.boxesPerPallet)) {
         const packH = 15 // Küçültüldü
         drawBox(margin, currentY, pageWidth - margin * 2, packH, 'Packaging Configuration')
         let packX = margin + 3
         let packY = currentY + 10 // Küçültüldü
         const pW = (pageWidth - margin * 2) / 4
         drawDataBlock('Pcs / Box', String(packaging.pcsPerBox || '-'), packX, packY, pW)
         drawDataBlock('Boxes / Pallet', String(packaging.boxesPerPallet || '-'), packX + pW, packY, pW)
         drawDataBlock('Planned Boxes', String(packaging.plannedBoxes || '-'), packX + pW * 2, packY, pW)
         drawDataBlock('Planned Pallets', String(packaging.plannedPallets || '-'), packX + pW * 3, packY, pW)
         currentY += packH + 4 // Küçültüldü
    }

    if (job.notes) {
        checkPageBreak(20) // Küçültüldü
        doc.setFillColor(255, 252, 235); doc.setDrawColor(245, 230, 180)
        doc.rect(margin, currentY, pageWidth - margin * 2, 18, 'FD') // Küçültüldü
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(200, 140, 0) // Küçültüldü
        doc.text('SPECIAL INSTRUCTIONS / NOTES', margin + 3, currentY + 4) // Küçültüldü
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]) // Küçültüldü
        const notes = doc.splitTextToSize(job.notes, pageWidth - margin * 2 - 6)
        doc.text(notes, margin + 3, currentY + 8) // Küçültüldü
        currentY += 18 + 4 // Küçültüldü
    }

    // --- FOOTER & İMZALAR ---
    const footerH = 25 // Küçültüldü
    let footerY = pageHeight - footerH - 5 // Küçültüldü
    // Tek sayfaya sığdırmak için sayfa ekleme yok
    if (currentY > footerY - 5) {
      // İçeriği biraz daha sıkıştır
      currentY = footerY - 5
    }

    const sigW = (pageWidth - margin * 2) / 3
    const sigH = 15 // Küçültüldü
    const drawSigBox = (title: string, x: number) => {
        doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]); doc.rect(x, footerY, sigW - 5, sigH)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2]) // Küçültüldü
        doc.text(title, x + 2, footerY + 3.5) // Küçültüldü
        doc.setDrawColor(200, 200, 200); doc.line(x + 5, footerY + sigH - 4, x + sigW - 10, footerY + sigH - 4) // Küçültüldü
    }
    drawSigBox('OPERATOR', margin); drawSigBox('QUALITY CONTROL', margin + sigW); drawSigBox('SUPERVISOR', margin + sigW * 2)

    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]); doc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8) // Küçültüldü
    doc.setFontSize(6); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal') // Küçültüldü
    doc.text(`Job: ${job.code || job.id}`, margin, pageHeight - 5) // Küçültüldü
    doc.text(new Date().toLocaleDateString(), pageWidth / 2, pageHeight - 5, { align: 'center' }) // Küçültüldü

    return doc.output('blob')
  } catch (error) {
    console.error('PDF generation error:', error)
    throw new Error(`PDF oluşturulamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
  }
}

export async function downloadJobPDF(job: Job): Promise<void> {
  try {
    const blob = await generateJobPDFBlob(job)
    const url = URL.createObjectURL(blob)
    const filename = `Production_Order_${job.code || job.id}.pdf`
    
    // Mobil cihazlar için kontrol
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    
    if (isMobile) {
      // Mobil cihazlarda yeni pencerede aç
      const newWindow = window.open(url, '_blank')
      if (!newWindow) {
        // Pop-up engellenmişse, kullanıcıya bilgi ver
        throw new Error('PDF açılamadı. Lütfen tarayıcınızın pop-up engelleyicisini kapatın ve tekrar deneyin.')
      }
      // Mobilde URL'yi hemen temizleme, kullanıcı indirebilir
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } else {
      // Masaüstünde normal indirme
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.display = 'none'
      
      document.body.appendChild(link)
      
      try {
        link.click()
        // Başarılı olduktan sonra temizle
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link)
          }
          URL.revokeObjectURL(url)
        }, 100)
      } catch (clickError) {
        // Eğer programatik click çalışmazsa, yeni pencerede aç
        console.warn('Programmatic click failed, opening in new window:', clickError)
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    }
  } catch (error) {
    console.error('PDF download error:', error)
    throw new Error(`PDF indirilemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
  }
}

function getPriorityLabel(priority: number): string {
  const labels: Record<number, string> = { 1: 'CRITICAL', 2: 'HIGH', 3: 'MEDIUM', 4: 'LOW', 5: 'VERY LOW' }
  return labels[priority] || 'NORMAL'
}

function formatStatus(status: string): string {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
}

function formatDate(date: any): string {
  if (!date) return '-'
  try {
    const d = new Date(typeof date === 'string' || typeof date === 'number' ? date : (date.seconds * 1000))
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '-' }
}