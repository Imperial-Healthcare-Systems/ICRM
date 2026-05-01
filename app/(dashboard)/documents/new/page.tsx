'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'
import { Loader2, Upload } from 'lucide-react'
import { supabaseAnon } from '@/lib/supabase'

import Select from '@/components/ui/Select'
type Account = { id: string; name: string }
type Contact = { id: string; first_name: string; last_name: string }

export default function NewDocumentPage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    name: '', category: 'general', account_id: '', contact_id: '', deal_id: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/accounts?pageSize=100').then(r => r.json()),
      fetch('/api/contacts?pageSize=100').then(r => r.json()),
    ]).then(([a, c]) => {
      setAccounts(a.data ?? [])
      setContacts(c.data ?? [])
    })
  }, [])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!form.name) update('name', f.name.replace(/\.[^/.]+$/, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { toast.error('Please select a file.'); return }
    if (!form.name.trim()) { toast.error('Name is required.'); return }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `documents/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadErr } = await supabaseAnon.storage.from('crm-documents').upload(path, file)
    if (uploadErr) { toast.error('Upload failed: ' + uploadErr.message); setUploading(false); return }

    const { data: urlData } = supabaseAnon.storage.from('crm-documents').getPublicUrl(path)
    setUploading(false)
    setSaving(true)

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          category: form.category,
          account_id: form.account_id || null,
          contact_id: form.contact_id || null,
          deal_id: form.deal_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Document uploaded!')
      router.push('/documents')
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#F47920]/60 focus:ring-1 focus:ring-[#F47920]/20 transition'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'
  const isLoading = uploading || saving

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Upload Document" backHref="/documents" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-[#0D1B2E] border border-white/5 rounded-xl p-6 space-y-4">
          {/* File picker */}
          <div>
            <label className={labelCls}>File *</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-[#F47920]/40 hover:bg-white/3 transition">
              <Upload className="w-6 h-6 text-slate-500 mb-2" />
              {file ? (
                <span className="text-sm text-white">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
              ) : (
                <span className="text-sm text-slate-500">Click to select a file</span>
              )}
              <input type="file" className="hidden" onChange={onFileChange} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Document Name *</label>
              <input className={inputCls} placeholder="Q1 Contract - Acme Corp" value={form.name} onChange={e => update('name', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <Select value={form.category} onValueChange={v => update('category', v)}
              options={['contract','proposal','invoice','report','legal','general','other'].map(c => ({ value: c, label: c }))} />
            </div>
            <div>
              <label className={labelCls}>Account</label>
              <Select value={form.account_id} onValueChange={v => update('account_id', v)} placeholder="None" allowClear clearLabel="None"
              options={accounts.map(a => ({ value: a.id, label: a.name }))} />
            </div>
            <div>
              <label className={labelCls}>Contact</label>
              <Select value={form.contact_id} onValueChange={v => update('contact_id', v)} placeholder="None" allowClear clearLabel="None"
              options={contacts.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name ?? ''}` }))} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={isLoading} className="flex items-center gap-2 bg-[#F47920] hover:bg-[#e06810] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploading ? 'Uploading…' : saving ? 'Saving…' : 'Upload Document'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition">Cancel</button>
        </div>
      </form>
    </div>
  )
}
