export function toCSV(data: any[]): string {
  if (data.length === 0) return ''
  
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        if (value === null || value === undefined) return ''
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
  ].join('\n')
  
  return csvContent
}

export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []
  
  // Find header row (first non-comment line)
  let headerIndex = 0
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('#')) {
      headerIndex = i
      break
    }
  }
  
  const headers = lines[headerIndex].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows: any[] = []
  
  // Process data rows (skip comment lines and header)
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    // Skip comment lines
    if (line.startsWith('#')) continue
    
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    if (values.length === 0 || values.every(v => !v)) continue
    
    const row: any = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || ''
    })
    rows.push(row)
  }
  
  return rows
}