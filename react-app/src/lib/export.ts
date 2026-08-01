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

function exportCSV(filename: string, data: any[], columns: { key: string; label: string }[]) {
  const headers = columns.map(c => c.label)
  const rows = data.map(row => columns.map(c => row[c.key]))
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(`${filename}.csv`, blob)
}

function exportExcel(filename: string, data: any[], columns: { key: string; label: string }[]) {
  // Simple Excel export using CSV with .xlsx extension
  // For full Excel support, would need xlsx library
  const headers = columns.map(c => c.label)
  const rows = data.map(row => columns.map(c => row[c.key]))
  
  const csvContent = [
    headers.join('\t'),
    ...rows.map(row => row.map(cell => cell).join('\t'))
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
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
