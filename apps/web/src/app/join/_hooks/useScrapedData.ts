'use client'

import { useCallback, useRef, useState } from 'react'

export type ScrapeStatus = 'idle' | 'scraping' | 'success' | 'partial' | 'failed'

interface ScrapedData {
  about_us?: string
  our_history?: string
  our_concept?: string
  opening_hours?: Array<{
    dayOfWeek: number
    isClosed: boolean
    openTime?: string
    closeTime?: string
  }>
  phone?: string
  instagram?: string
  facebook?: string
  [key: string]: unknown
}

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 10

export function useScrapedData() {
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null)
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>('idle')
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
    attemptRef.current = 0
  }, [])

  const pollStatus = useCallback(
    (jobId: string) => {
      attemptRef.current += 1

      if (attemptRef.current > MAX_POLL_ATTEMPTS) {
        setScrapeStatus('failed')
        cleanup()
        return
      }

      pollRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/scrape/company?jobId=${encodeURIComponent(jobId)}`)

          if (!res.ok) {
            setScrapeStatus('failed')
            cleanup()
            return
          }

          const data = await res.json()

          if (data.status === 'completed') {
            setScrapedData(data.result ?? null)
            setScrapeStatus(data.result ? 'success' : 'partial')
            cleanup()
          } else if (data.status === 'partial') {
            setScrapedData(data.result ?? null)
            setScrapeStatus('partial')
            cleanup()
          } else if (data.status === 'failed') {
            setScrapeStatus('failed')
            cleanup()
          } else {
            // Still processing — poll again
            pollStatus(jobId)
          }
        } catch {
          setScrapeStatus('failed')
          cleanup()
        }
      }, POLL_INTERVAL_MS)
    },
    [cleanup],
  )

  const triggerScrape = useCallback(
    async (url: string): Promise<string | null> => {
      cleanup()
      setScrapeStatus('scraping')
      setScrapedData(null)

      try {
        const res = await fetch('/api/scrape/company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })

        if (!res.ok) {
          setScrapeStatus('failed')
          return null
        }

        const data = await res.json()
        const jobId = data.jobId as string

        if (!jobId) {
          setScrapeStatus('failed')
          return null
        }

        pollStatus(jobId)
        return jobId
      } catch {
        setScrapeStatus('failed')
        return null
      }
    },
    [cleanup, pollStatus],
  )

  return { scrapedData, scrapeStatus, triggerScrape }
}
