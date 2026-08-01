import * as XLSX from 'xlsx'

export type ExportFormat = 'csv' | 'excel' | 'pdf'

export interface ExportOptions {
  filename: string
  format: ExportFormat
  data: any[]
  columns: { key: string; label: string }[]
}

export function exportData({ filename, format, data, columns }: ExportOptions) {
  switch (format) {
    case 'csv':
      exportCSV(filename, data, columns)
      break
    case 'excel':
      exportExcel(filename, data, columns)
      break
    case 'pdf':
      exportPDF(filename, data, columns)
      break
  }
}

function escapeCsvCell(cell: any): string {
  const value = cell === null || cell === undefined ? '' : String(cell)
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function exportCSV(filename: string, data: any[], columns: { key: string; label: string }[]) {
  const headers = columns.map(c => c.label)
  const rows = data.map(row => columns.map(c => row[c.key]))

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(row => row.map(escapeCsvCell).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(`${filename}.csv`, blob)
}

function exportExcel(filename: string, data: any[], columns: { key: string; label: string }[]) {
  const rows = data.map(row => {
    const record: Record<string, any> = {}
    columns.forEach(c => { record[c.label] = row[c.key] })
    return record
  })

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns.map(c => c.label) })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

  const wbArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(`${filename}.xlsx`, blob)
}

function exportPDF(filename: string, data: any[], columns: { key: string; label: string }[]) {
  // Simple PDF export using print
  // For full PDF support, would need jsPDF library
  const headers = columns.map(c => c.label)
  const rows = data.map(row => columns.map(c => row[c.key]))
  
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>${filename}</title>
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>${filename}</h1>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
