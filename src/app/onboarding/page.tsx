'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/actions'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube Shorts' },
]

const POSTING_TARGETS = [1, 3, 5, 7, 14]

const VOICE_OPTIONS = [
  { id: 'raw', label: 'Raw & Direct', desc: 'No filter, straight talk' },
  { id: 'professional', label: 'Professional', desc: 'Polished and authoritative' },
  { id: 'friendly', label: 'Friendly & Casual', desc: 'Like talking to a friend' },
  { id: 'educational', label: 'Educational', desc: 'Teaching and explaining' },
  { id: 'funny', label: 'Funny & Entertaining', desc: 'Humor-first approach' },
]

const STEPS = [
  { title: 'Your niche', description: 'What kind of content do you create?' },
  { title: 'What you sell', description: 'What product or service are you marketing?' },
  { title: 'Brand voice', description: 'How do you want to sound?' },
  { title: 'Target audience', description: 'Who exactly are you trying to reach?' },
  { title: 'Your platforms', description: 'Where do you post content?' },
  { title: 'Brand kit', description: 'Upload your brand assets (optional)' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Step 1
  const [niche, setNiche] = useState('')
  const [subNiche, setSubNiche] = useState('')
  // Step 2
  const [product, setProduct] = useState('')
  // Step 3
  const [brandVoice, setBrandVoice] = useState('')
  const [customVoice, setCustomVoice] = useState('')
  // Step 4
  const [audienceAge, setAudienceAge] = useState('')
  const [audiencePainPoints, setAudiencePainPoints] = useState('')
  const [audienceWhere, setAudienceWhere] = useState('')
  const [audienceDesc, setAudienceDesc] = useState('')
  // Step 5
  const [platforms, setPlatforms] = useState<string[]>([])
  const [postingTarget, setPostingTarget] = useState(3)
  // Step 6 — brand kit (simplified for Phase 1)
  const [brandColors, setBrandColors] = useState('')

  const inputClass = "bg-muted dark:bg-[#1e2a2e] border-border rounded-lg focus:border-teal-500 focus:ring-[3px] focus:ring-teal-500/20 transition-all"

  function togglePlatform(id: string) {
    setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  async function handleFinish() {
    setLoading(true)
    setErrorMsg(null)

    try {
      const result = await updateProfile({
        niche,
        sub_niche: subNiche || null,
        product_or_service: product || null,
        brand_voice: brandVoice === 'custom' ? customVoice : brandVoice,
        target_audience: {
          age_range: audienceAge || undefined,
          pain_points: audiencePainPoints || undefined,
          where_they_hang_out: audienceWhere || undefined,
          description: audienceDesc || undefined,
        },
        platforms,
        posting_target: postingTarget,
        onboarding_completed: true,
      })

      console.log('updateProfile result:', result)

      if (result?.error) {
        setErrorMsg(result.error)
        setLoading(false)
        return
      }

      router.push('/dashboard/coach')
    } catch (e) {
      console.error('handleFinish threw:', e)
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setLoading(false)
    }
  }

  const canProceed = [
    niche.trim().length > 0,                    // Step 1
    product.trim().length > 0,                  // Step 2
    brandVoice.length > 0,                      // Step 3
    audienceDesc.trim().length > 0,             // Step 4
    platforms.length > 0,                       // Step 5
    true,                                       // Step 6 (optional)
  ][step]

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-500 to-teal-400 bg-clip-text text-transparent">Sana</h1>
          <p className="text-muted-foreground mt-1">Let&apos;s set up your profile</p>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2.5 bg-muted dark:bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <p className="text-lg font-bold text-foreground">{STEPS[step].title}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{STEPS[step].description}</p>
          </div>

          <div className="space-y-4">
            {/* Step 1: Niche */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.05em] font-semibold text-muted-foreground flex items-center gap-2">
                    Main niche <span className="text-teal-500">*</span>
                  </label>
                  <Input placeholder="e.g. Fitness, Comedy, Finance, SaaS..." value={niche}
                    onChange={(e) => setNiche(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.05em] font-semibold text-muted-foreground flex items-center gap-2">
                    Sub-niche
                    <span className="text-[10px] font-medium normal-case tracking-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground/60">optional</span>
                  </label>
                  <Input placeholder="e.g. Marathon training for busy professionals" value={subNiche}
                    onChange={(e) => setSubNiche(e.target.value)} className={inputClass} />
                </div>
              </>
            )}

            {/* Step 2: Product/Service */}
            {step === 1 && (
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.05em] font-semibold text-muted-foreground flex items-center gap-2">
                  What are you marketing? <span className="text-teal-500">*</span>
                </label>
                <Textarea
                  placeholder="e.g. Online coaching program for marathon runners, my SaaS tool for content creators, personal brand for speaking gigs..."
                  value={product} onChange={(e) => setProduct(e.target.value)}
                  rows={4} className={inputClass}
                />
              </div>
            )}

            {/* Step 3: Brand Voice */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  {VOICE_OPTIONS.map(v => (
                    <button key={v.id} type="button" onClick={() => setBrandVoice(v.id)}
                      className={`flex items-center justify-between p-3.5 rounded-xl transition-all duration-150 text-left ${
                        brandVoice === v.id
                          ? 'bg-teal-500/10 border-2 border-teal-500'
                          : 'border border-border hover:border-teal-500/40'
                      }`}>
                      <div>
                        <span className={`font-medium text-sm ${brandVoice === v.id ? 'text-foreground' : 'text-muted-foreground'}`}>{v.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                      </div>
                      {brandVoice === v.id && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400">Selected</span>
                      )}
                    </button>
                  ))}
                  <button type="button" onClick={() => setBrandVoice('custom')}
                    className={`p-3.5 rounded-xl transition-all duration-150 text-left ${
                      brandVoice === 'custom'
                        ? 'bg-teal-500/10 border-2 border-teal-500'
                        : 'border border-border hover:border-teal-500/40'
                    }`}>
                    <span className={`font-medium text-sm ${brandVoice === 'custom' ? 'text-foreground' : 'text-muted-foreground'}`}>Custom</span>
                  </button>
                </div>
                {brandVoice === 'custom' && (
                  <Input placeholder="Describe your brand voice..." value={customVoice}
                    onChange={(e) => setCustomVoice(e.target.value)} className={inputClass} />
                )}
              </div>
            )}

            {/* Step 4: Target Audience */}
            {step === 3 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.05em] font-semibold text-muted-foreground">
                    Describe your ideal viewer <span className="text-teal-500">*</span>
                  </label>
                  <Textarea placeholder="e.g. 25-35 year old professionals who want to run a marathon but can't find time to train consistently..."
                    value={audienceDesc} onChange={(e) => setAudienceDesc(e.target.value)}
                    rows={3} className={inputClass} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.05em] font-semibold text-muted-foreground">Age range</label>
                  <Input placeholder="e.g. 25-35" value={audienceAge}
                    onChange={(e) => setAudienceAge(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.05em] font-semibold text-muted-foreground">Their biggest pain points</label>
                  <Textarea placeholder="e.g. No time, overwhelmed by training plans, fear of injury..."
                    value={audiencePainPoints} onChange={(e) => setAudiencePainPoints(e.target.value)}
                    rows={2} className={inputClass} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.05em] font-semibold text-muted-foreground">Where they hang out online</label>
                  <Input placeholder="e.g. Reddit r/running, Strava, Instagram fitness accounts..."
                    value={audienceWhere} onChange={(e) => setAudienceWhere(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}

            {/* Step 5: Platforms */}
            {step === 4 && (
              <>
                <div className="flex flex-col gap-2.5">
                  {PLATFORMS.map(p => (
                    <button key={p.id} type="button" onClick={() => togglePlatform(p.id)}
                      className={`flex items-center justify-between p-4 rounded-xl transition-all duration-150 text-left ${
                        platforms.includes(p.id)
                          ? 'bg-teal-500/10 border-2 border-teal-500'
                          : 'border border-border hover:border-teal-500/40 hover:bg-muted/50'
                      }`}>
                      <span className={`font-medium ${platforms.includes(p.id) ? 'text-foreground' : 'text-muted-foreground'}`}>{p.label}</span>
                      {platforms.includes(p.id) && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400">Selected</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="space-y-3 pt-2">
                  <label className="text-xs uppercase tracking-[0.05em] font-semibold text-muted-foreground">Posts per week target</label>
                  <div className="grid grid-cols-5 gap-2">
                    {POSTING_TARGETS.map(t => (
                      <button key={t} type="button" onClick={() => setPostingTarget(t)}
                        className={`py-3 rounded-xl font-bold transition-all duration-150 ${
                          postingTarget === t
                            ? 'bg-teal-600 text-white border border-transparent'
                            : 'border border-border text-muted-foreground hover:border-teal-500/40 hover:text-foreground'
                        }`}>
                        {t}x
                      </button>
                    ))}
                  </div>
                  <p className={`text-sm font-medium ${postingTarget >= 5 ? 'text-teal-600 dark:text-teal-400' : 'text-muted-foreground'}`}>
                    {postingTarget >= 7 ? 'Elite level — consistency is king!'
                      : postingTarget >= 5 ? 'Great cadence for rapid growth'
                      : postingTarget >= 3 ? 'Good starting point for building momentum'
                      : 'Start slow and build up the habit'}
                  </p>
                </div>
              </>
            )}

            {/* Step 6: Brand Kit */}
            {step === 5 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You can skip this for now and add brand assets later in Settings.
                </p>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.05em] font-semibold text-muted-foreground">Brand colors</label>
                  <Input placeholder="e.g. #14b8a6, #0f172a, white" value={brandColors}
                    onChange={(e) => setBrandColors(e.target.value)} className={inputClass} />
                </div>
                <p className="text-xs text-muted-foreground">Logo upload and font selection coming in a future update.</p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                {errorMsg}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <button onClick={() => setStep(step - 1)}
                  className="flex-1 h-11 rounded-xl border border-border dark:border-white/10 text-foreground text-sm font-medium hover:bg-muted dark:hover:bg-white/5 transition-all">
                  Back
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep(step + 1)} disabled={!canProceed}
                  className="flex-1 h-11 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                  Continue
                </button>
              ) : (
                <button onClick={handleFinish} disabled={loading}
                  className="flex-1 h-11 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Setting up...' : "Let's go!"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
