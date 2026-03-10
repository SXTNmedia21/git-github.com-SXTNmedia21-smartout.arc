'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSignupWizard } from '../_hooks/useSignupWizard'
import { completeSignup } from '../_lib/setupActions'
import type {
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
  Step6Data,
} from '../_lib/validation'

const LOADING_MESSAGES = [
  'Oppretter bedriftsprofil...',
  'Konfigurerer arbeidsområde...',
  'Lagrer åpningstider...',
  'Klargjør dashbordet ditt...',
]

export function SetupLoading() {
  const router = useRouter()
  const { state } = useSignupWizard()
  const [messageIndex, setMessageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const hasStarted = useRef(false)

  // Rotate loading messages
  useEffect(() => {
    if (error) return

    const interval = setInterval(() => {
      setMessageIndex((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev,
      )
    }, 2000)

    return () => clearInterval(interval)
  }, [error])

  // Run the setup action once on mount
  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    async function runSetup() {
      try {
        const result = await completeSignup({
          step1: state.step1 as Step1Data,
          step2: state.step2 as Step2Data,
          step3: state.step3 as Step3Data,
          step4: state.step4 as Step4Data,
          step5: state.step5 as Step5Data,
          step6: state.step6 as Step6Data,
        })

        router.push(`/dashboard`)
      } catch (err) {
        console.error('[SetupLoading] Setup failed:', err)
        setError(
          err instanceof Error
            ? err.message
            : 'Noe gikk galt under oppsettet.',
        )
      }
    }

    runSetup()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/30" />
          <AlertCircle className="absolute inset-0 m-auto h-8 w-8 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Noe gikk galt
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{error}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setError(null)
            setMessageIndex(0)
            hasStarted.current = false
            // Force re-run by toggling error state
            setTimeout(() => {
              hasStarted.current = true
              completeSignup({
                step1: state.step1 as Step1Data,
                step2: state.step2 as Step2Data,
                step3: state.step3 as Step3Data,
                step4: state.step4 as Step4Data,
                step5: state.step5 as Step5Data,
                step6: state.step6 as Step6Data,
              })
                .then(() => router.push('/dashboard'))
                .catch((err) =>
                  setError(
                    err instanceof Error
                      ? err.message
                      : 'Noe gikk galt under oppsettet.',
                  ),
                )
            }, 0)
          }}
        >
          Prøv igjen
        </Button>
      </div>
    )
  }

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
