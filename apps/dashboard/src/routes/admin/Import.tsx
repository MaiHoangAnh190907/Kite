import { useState, useCallback } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'
import Papa from 'papaparse'
import { apiClient } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { ImportResult } from '@/types/api'

interface ParsedRow {
  first_name?: string
  last_name?: string
  date_of_birth?: string
  mrn?: string
  guardian_name?: string
  [key: string]: string | undefined
}

interface PreviewRow extends ParsedRow {
  _valid: boolean
  _error?: string
}

export function Import(): React.JSX.Element {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const importMutation = useMutation<ImportResult>({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected')
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post<ImportResult>('/admin/patients/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      setResult(data)
    },
  })

  const parseFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)

    Papa.parse<ParsedRow>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: PreviewRow[] = results.data.map((row) => {
          const errors: string[] = []
          if (!row.first_name?.trim()) errors.push('Missing first_name')
          if (!row.last_name?.trim()) errors.push('Missing last_name')
          if (!row.date_of_birth?.trim()) {
            errors.push('Missing date_of_birth')
          } else if (isNaN(new Date(row.date_of_birth).getTime())) {
            errors.push('Invalid date_of_birth')
          }

          return {
            ...row,
            _valid: errors.length === 0,
            _error: errors.length > 0 ? errors.join(', ') : undefined,
          }
        })
        setPreview(rows)
      },
    })
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const f = e.dataTransfer.files[0]
      if (f && (f.name.endsWith('.csv') || f.type === 'text/csv')) {
        parseFile(f)
      }
    },
    [parseFile],
  )

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) parseFile(f)
  }

  const validCount = preview.filter((r) => r._valid).length
  const errorCount = preview.filter((r) => !r._valid).length

  const reset = () => {
    setFile(null)
    setPreview([])
    setResult(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary">Import Patients</h1>

      {/* Result */}
      {result && (
        <Card className="mt-6 p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-flag-green" />
            <div>
              <p className="font-medium text-text-primary">Import Complete</p>
              <p className="text-sm text-text-secondary">
                {result.imported} imported, {result.skipped} skipped
                {result.errors.length > 0 && `, ${String(result.errors.length)} errors`}
              </p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-sm font-medium text-flag-red">Errors:</p>
              {result.errors.map((err) => (
                <p key={err.row} className="text-xs text-text-secondary">
                  Row {err.row}: {err.error}
                </p>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Button variant="secondary" onClick={reset}>Import Another File</Button>
          </div>
        </Card>
      )}

      {/* Drop zone */}
      {!result && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`mt-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              isDragging
                ? 'border-brand-primary bg-blue-50'
                : 'border-border bg-bg-card hover:border-brand-primary/50'
            }`}
          >
            {file ? (
              <>
                <FileSpreadsheet className="mb-3 h-10 w-10 text-brand-primary" />
                <p className="font-medium text-text-primary">{file.name}</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {validCount} valid rows, {errorCount} errors
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={reset}>
                    Choose Different File
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Upload className="mb-3 h-10 w-10 text-text-secondary" />
                <p className="font-medium text-text-primary">Drag & drop a CSV file here</p>
                <p className="mt-1 text-sm text-text-secondary">
                  or{' '}
                  <label className="cursor-pointer text-brand-primary hover:underline">
                    browse files
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </p>
                <div className="mt-4 rounded-lg bg-gray-50 px-4 py-2 text-xs text-text-secondary">
                  Required: <code>first_name</code>, <code>last_name</code>, <code>date_of_birth</code>
                  <br />
                  Optional: <code>mrn</code>, <code>guardian_name</code>
                </div>
              </>
            )}
          </div>

          {/* Preview table */}
          {preview.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">Preview</h2>
                <Button
                  onClick={() => importMutation.mutate()}
                  loading={importMutation.isPending}
                  disabled={validCount === 0}
                >
                  Import {validCount} Patient{validCount !== 1 ? 's' : ''}
                </Button>
              </div>

              <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-border bg-bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-bg-card">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-text-secondary">Status</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-text-secondary">First Name</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-text-secondary">Last Name</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-text-secondary">DOB</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-text-secondary">MRN</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase text-text-secondary">Guardian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 100).map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-border last:border-b-0 ${!row._valid ? 'bg-red-50' : ''}`}
                      >
                        <td className="px-3 py-2">
                          {row._valid ? (
                            <CheckCircle2 className="h-4 w-4 text-flag-green" />
                          ) : (
                            <span title={row._error}>
                              <AlertCircle className="h-4 w-4 text-flag-red" />
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-text-primary">{row.first_name ?? ''}</td>
                        <td className="px-3 py-2 text-text-primary">{row.last_name ?? ''}</td>
                        <td className="px-3 py-2 text-text-secondary">{row.date_of_birth ?? ''}</td>
                        <td className="px-3 py-2 text-text-secondary">{row.mrn ?? '—'}</td>
                        <td className="px-3 py-2 text-text-secondary">{row.guardian_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 100 && (
                  <p className="border-t border-border px-3 py-2 text-xs text-text-secondary">
                    Showing first 100 of {preview.length} rows
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
