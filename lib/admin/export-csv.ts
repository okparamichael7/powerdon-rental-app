/** Client-side CSV export for admin tables. */

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
): void {
  const escape = (value: string | number | boolean | null | undefined) => {
    const str = value == null ? '' : String(value)
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
    return str
  }

  const lines = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
