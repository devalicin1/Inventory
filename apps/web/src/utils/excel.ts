import * as XLSX from 'xlsx'

export interface ExcelExportOptions {
  sheetName?: string
  filename?: string
  headers?: string[]
  dateFormat?: string
}

/**
 * Convert data array to Excel workbook
 */
export function toExcel(
  data: any[],
  options: ExcelExportOptions = {}
): XLSX.WorkBook {
  const { sheetName = 'Sheet1', headers } = options

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(data, {
    header: headers,
  })

  // Auto-size columns
  const columnWidths = headers
    ? headers.map((header) => ({
        wch: Math.max(header.length, 15),
      }))
    : data.length > 0
    ? Object.keys(data[0]).map((key) => ({
        wch: Math.max(key.length, 15),
      }))
    : []

  worksheet['!cols'] = columnWidths

  // Create workbook
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  return workbook
}

/**
 * Download data as Excel file
 */
export function downloadExcel(
  filename: string,
  data: any[],
  options: ExcelExportOptions = {}
): void {
  const workbook = toExcel(data, options)
  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  })

  // Create blob and download
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Export multiple sheets to Excel
 */
export function downloadMultiSheetExcel(
  filename: string,
  sheets: Array<{ name: string; data: any[] }>
): void {
  const workbook = XLSX.utils.book_new()

  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  })

  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  })

  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
