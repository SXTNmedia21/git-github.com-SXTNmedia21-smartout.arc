'use client'

import { useCallback, useState } from 'react'

export type AiStatus = 'idle' | 'generating' | 'success' | 'failed'

export interface AiContent {
  about_us: string
  our_history: string
  our_concept: string
}

interface ScrapedDataInput {
  about_us?: string
  our_history?: string
  our_concept?: string
  [key: string]: unknown
}

export function useAiContent() {
  const [aiContent, setAiContent] = useState<AiContent | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle')

  const generateContent = useCallback(
    async (companyName: string, scrapedData: ScrapedDataInput): Promise<void> => {
      setAiStatus('generating')
      setAiContent(null)

      try {
        const res = await fetch('/api/generate-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName, scrapedData }),
        })

        if (!res.ok) {
          setAiStatus('failed')
          return
        }

        const data = await res.json()

        if (data.about_us || data.our_history || data.our_concept) {
          setAiContent({
            about_us: data.about_us ?? '',
            our_history: data.our_history ?? '',
            our_concept: data.our_concept ?? '',
          })
          setAiStatus('success')
        } else {
          setAiStatus('failed')
        }
      } catch {
        setAiStatus('failed')
      }
    },
    [],
  )

  return { aiContent, aiStatus, generateContent }
}
