'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowRight, Globe } from 'lucide-react'
import { useSignupWizard } from '../_hooks/useSignupWizard'
import { useScrapedData } from '../_hooks/useScrapedData'
import { step1Schema } from '../_lib/validation'

interface Step1AccountProps {
  userEmail: string
  onScrapeStarted?: (jobId: string) => void
}

export function Step1Account({ userEmail, onScrapeStarted }: Step1AccountProps) {
  const { state, updateStep, nextStep } = useSignupWizard()
  const { scrapeStatus, triggerScrape } = useScrapedData()

  const [companyName, setCompanyName] = useState(state.step1.companyName ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(state.step1.websiteUrl ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced scrape trigger on URL change
  const handleUrlChange = useCallback(
    (url: string) => {
      setWebsiteUrl(url)
      setErrors((prev) => ({ ...prev, websiteUrl: '' }))

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      if (url.length > 4) {
        debounceRef.current = setTimeout(async () => {
          const fullUrl = url.startsWith('http') ? url : `https://${url}`
          const jobId = await triggerScrape(fullUrl)
          if (jobId) {
            updateStep('scrapeJobId', jobId)
            onScrapeStarted?.(jobId)
          }
        }, 1000)
      }
    },
    [triggerScrape, updateStep, onScrapeStarted],
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const handleNext = () => {
    const result = step1Schema.safeParse({
      email: userEmail,
      companyName,
      websiteUrl,
    })

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string
        fieldErrors[field] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    updateStep('step1', {
      email: userEmail,
      companyName: result.data.companyName,
      websiteUrl: result.data.websiteUrl,
    })
    nextStep()
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Opprett din konto
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vi starter med det grunnleggende om bedriften din.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-post</Label>
          <Input
            id="email"
            type="email"
            value={userEmail}
            disabled
            className="bg-muted text-muted-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyName">Bedriftsnavn</Label>
          <Input
            id="companyName"
            type="text"
            placeholder="F.eks. Restaurant Solsiden"
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value)
              setErrors((prev) => ({ ...prev, companyName: '' }))
            }}
            aria-invalid={!!errors.companyName}
          />
          {errors.companyName && (
            <p className="text-xs text-destructive">{errors.companyName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="websiteUrl">Nettside URL</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="websiteUrl"
              type="text"
              placeholder="www.dinbedrift.no"
              value={websiteUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="pl-9"
              aria-invalid={!!errors.websiteUrl}
            />
          </div>
          {errors.websiteUrl && (
            <p className="text-xs text-destructive">{errors.websiteUrl}</p>
          )}
          {scrapeStatus === 'scraping' && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Vi leser nettsiden din...
            </p>
          )}
        </div>
      </div>

      <Button
        type="button"
        onClick={handleNext}
        className="w-full bg-orange-500 text-white hover:bg-orange-600"
      >
        Neste
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}
