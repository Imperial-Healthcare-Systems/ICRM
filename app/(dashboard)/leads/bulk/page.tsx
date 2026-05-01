'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import { ArrowLeft, Upload, Download, FileText, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import clsx from 'clsx'

const COLUMNS = [
  'first_name', 'last_name', 'email', 'phone',
  'company', 'job_title', 'lead_source', 'lead_status', 'rating', 'notes',
] as const

const ALLOWED_STATUS = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'recycled']
const ALLOWED_RATING = ['hot', 'warm', 'cold']

type Row = Record<typeof COLUMNS[number], string>
type RowError = { row: number; message: string }

function validateRow(row: Row, idx: number): string | null {
  if (!row.first_name?.trim()) return 'first_name is required'
  if (row.lead_status && !ALLOWED_STATUS.includes(row.lead_status.trim().toLowerCase()))
    return `Invalid lead_status. Use: ${ALLOWED_STATUS.join(', ')}`
  if (row.rating && !ALLOWED_RATING.includes(row.rating.trim().toLowerCase()))
    return `Invalid rating. Use: ${ALLOWED_RATING.join(', ')}`
  return null
}

export default function BulkLeadsUploadPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ inserted: number; failed: number; errors: RowError[] } | null>(null)

  function downloadTemplate() {
    const csv = COLUMNS.join(',') + '\n' +
      'Jane,Doe,jane@acme.com,+919999999999,Acme Corp,CEO,website,new,hot,Interested in enterprise plan\n' +
      'John,Smith,john@beta.io,,Beta Inc,CTO,referral,contacted,warm,'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFile(file: File) {
    setResult(null)
    setFileName(file.name)

    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: ({ data, errors: parseErrors }) => {
        if (parseErrors.length) {
          toast.error(`CSV parse error: ${parseErrors[0].message}`)
          return
        }
        if (!data.length) {
          toast.error('CSV is empty.')
          return
        }
        const errs: Record<number, string> = {}
        data.forEach((r, i) => {
          const err = validateRow(r, i)
          if (err) errs[i] = err
        })
        setRows(data)
        setRowErrors(errs)
        toast.success(`Parsed ${data.length} rows (${Object.keys(errs).length} have errors).`)
      },
      error: err => toast.error(`Parse failed: ${err.message}`),
    })
  }

  async function uploadValidRows() {
    const validRows = rows.filter((_, i) => !rowErrors[i])
    if (!validRows.length) { toast.error('No valid rows to upload.'); return }

    setUploading(true)
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: validRows }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return }
      setResult(data)
      if (data.inserted > 0) toast.success(`Imported ${data.inserted} leads.`)
      if (data.failed > 0) toast.error(`${data.failed} rows failed validation on the server.`)
    } catch {
      toast.error('Network error during upload.')
    } finally {
      setUploading(false)
    }
  }

  function reset() {
    setFileName('')
    setRows([])
    setRowErrors({})
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const validCount = rows.length - Object.keys(rowErrors).length
  const previewRows = rows.slice(0, 10)

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/leads')} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold text-xl">Bulk Upload Leads</h1>
          <p className="text-slate-500 text-sm">Import multiple leads at once via CSV. Max 1,000 rows per upload.</p>
        </div>
        <button onClick={downloadTemplate} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition">
          <Download className="w-4 h-4" /> Download Template
        </button>
      </div>

      {/* Upload result banner */}
      {result && (
        <div className={clsx(
          'rounded-xl p-5 mb-6 border',
          result.inserted > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
        )}>
          <div className="flex items-start gap-3">
            {result.inserted > 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />}
            <div className="flex-1">
              <p className="text-white font-semibold">
                {result.inserted > 0 ? `Imported ${result.inserted} lead${result.inserted === 1 ? '' : 's'} successfully.` : 'Import failed.'}
              </p>
              {result.failed > 0 && (
                <div className="mt-2 text-xs text-red-300">
                  <p className="mb-1">{result.failed} row(s) rejected:</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
                  </ul>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Link href="/leads" className="text-xs font-semibold text-[#F47920] hover:underline">View leads →</Link>
                <button onClick={reset} className="text-xs font-semibold text-slate-400 hover:text-white">Upload another file</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {!rows.length && !result && (
        <label className="block border-2 border-dashed border-white/10 hover:border-[#F47920]/50 rounded-xl p-12 text-center cursor-pointer transition bg-[#0D1B2E]/50">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="hidden"
          />
          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Click to upload CSV</p>
          <p className="text-slate-500 text-sm">First row should be the header. Required column: <code className="text-[#F47920]">first_name</code></p>
        </label>
      )}

      {/* Preview */}
      {rows.length > 0 && !result && (
        <>
          <div className="flex items-center justify-between mb-4 bg-[#0D1B2E] border border-white/5 rounded-xl px-5 py-3">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-white text-sm font-medium">{fileName}</span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-slate-400 text-xs">{rows.length} rows · <span className="text-emerald-400">{validCount} valid</span> · <span className="text-red-400">{Object.keys(rowErrors).length} errors</span></span>
            </div>
            <button onClick={reset} className="text-slate-400 hover:text-white transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-[#0D1B2E] border border-white/5 rounded-xl overflow-hidden mb-6">
            <p className="px-5 py-2.5 text-xs text-slate-500 border-b border-white/5">Preview (first 10 rows)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-3 py-2 font-semibold">#</th>
                    {COLUMNS.map(c => <th key={c} className="text-left px-3 py-2 font-semibold">{c}</th>)}
                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {previewRows.map((row, i) => {
                    const err = rowErrors[i]
                    return (
                      <tr key={i} className={clsx('text-slate-300', err && 'bg-red-500/5')}>
                        <td className="px-3 py-2 text-slate-500">{i + 2}</td>
                        {COLUMNS.map(c => <td key={c} className="px-3 py-2 truncate max-w-[140px]">{row[c] ?? ''}</td>)}
                        <td className="px-3 py-2">
                          {err
                            ? <span className="text-red-400 text-[10px]" title={err}>✗ {err.slice(0, 30)}…</span>
                            : <span className="text-emerald-400 text-[10px]">✓ Valid</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={uploadValidRows}
              disabled={uploading || validCount === 0}
              className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition"
            >
              {uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                : <><Upload className="w-4 h-4" /> Import {validCount} valid row{validCount === 1 ? '' : 's'}</>
              }
            </button>
            <button onClick={reset} className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-medium px-6 py-2.5 rounded-lg text-sm transition">
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
