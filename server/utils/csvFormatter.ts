function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv(data: Record<string, unknown>[], columns?: string[]): string {
  if (data.length === 0) return ''

  const firstRow = data[0]
  if (!firstRow) return ''

  const headers = columns ?? Object.keys(firstRow)
  const lines = [headers.map(escapeCell).join(',')]

  for (const row of data) {
    lines.push(headers.map(h => escapeCell(row[h])).join(','))
  }

  return lines.join('\n')
}
