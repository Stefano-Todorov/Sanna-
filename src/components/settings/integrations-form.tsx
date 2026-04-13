'use client'

import { useState } from 'react'
import { updateProfile } from '@/app/actions'
import { Button } from '@/components/ui/button'

type Props = {
  metricoolBrandId: string | null
  igBusinessAccountId: string | null
  metaPageId: string | null
}

export function IntegrationsForm({ metricoolBrandId, igBusinessAccountId, metaPageId }: Props) {
  const [brand, setBrand] = useState(metricoolBrandId ?? '')
  const [ig, setIg] = useState(igBusinessAccountId ?? '')
  const [page, setPage] = useState(metaPageId ?? '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function onSave() {
    setSaving(true)
    setStatus(null)
    const res = await updateProfile({
      metricool_brand_id: brand || null,
      ig_business_account_id: ig || null,
      meta_page_id: page || null,
    })
    setSaving(false)
    setStatus(res.error ?? 'Saved')
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Integrations</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Connect Metricool and Meta Graph API for auto-posting</p>
      </div>

      <Field
        label="Metricool Brand ID"
        hint="Find in Metricool → Settings → API (blogId)"
        value={brand}
        onChange={setBrand}
      />
      <Field
        label="Instagram Business Account ID"
        hint="17-digit ID of your IG business account (used for Trial Reels)"
        value={ig}
        onChange={setIg}
      />
      <Field
        label="Facebook Page ID"
        hint="Linked Page for Instagram publishing permissions"
        value={page}
        onChange={setPage}
      />

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={saving} size="sm">
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
    </div>
  )
}

function Field({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
        placeholder="—"
      />
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  )
}
