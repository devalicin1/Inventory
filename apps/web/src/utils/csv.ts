export function toCSV<T extends Record<string, any>>(rows: T[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    const vals = headers.map((h) => serialize(row[h]))
    lines.push(vals.join(','))
  }
  return lines.join('\n')
}

function serialize(value: unknown): string {
  if (value == null) return ''
  const s = String(value).replaceAll('"', '""')
  if (/[",\n]/.test(s)) return `"${s}"`
  return s
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

