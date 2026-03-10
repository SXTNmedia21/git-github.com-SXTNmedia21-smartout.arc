'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

const LOADING_MESSAGES = [
  'Oppretter bedriftsprofil...',
  'Konfigurerer arbeidsområde...',
  'Setter opp avdelinger...',
  'Klargjør dashbordet ditt...',
]

export function SetupLoading() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev,
      )
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-950/30" />
        <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-orange-500" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Vi setter opp alt for deg
        </h2>
        <p className="mt-2 text-sm text-muted-foreground transition-opacity duration-300">
          {LOADING_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  )
}
