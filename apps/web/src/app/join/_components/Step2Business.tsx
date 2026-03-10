'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useSignupWizard } from '../_hooks/useSignupWizard'
import type { ScrapeStatus } from '../_hooks/useScrapedData'
import { step2Schema } from '../_lib/validation'

interface Step2BusinessProps {
  scrapeStatus?: ScrapeStatus
}

export function Step2Business({ scrapeStatus }: Step2BusinessProps) {
  const { state, updateStep, nextStep, prevStep } = useSignupWizard()

  const [firstName, setFirstName] = useState(state.step2.firstName ?? '')
  const [lastName, setLastName] = useState(state.step2.lastName ?? '')
  const [street, setStreet] = useState(state.step2.street ?? '')
  const [postalCode, setPostalCode] = useState(state.step2.postalCode ?? '')
  const [city, setCity] = useState(state.step2.city ?? '')
  const [orgNumber, setOrgNumber] = useState(state.step2.orgNumber ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleNext = () => {
    const result = step2Schema.safeParse({
      firstName,
      lastName,
      street,
      postalCode,
      city,
      orgNumber,
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

    updateStep('step2', result.data)
    nextStep()
  }

  const clearError = (field: string) => {
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Bedriftsinformasjon
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fortell oss om deg og bedriften.
        </p>
        {scrapeStatus === 'scraping' && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Henter data fra nettsiden din...
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Fornavn</Label>
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                clearError('firstName')
              }}
              aria-invalid={!!errors.firstName}
            />
            {errors.firstName && (
              <p className="text-xs text-destructive">{errors.firstName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Etternavn</Label>
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                clearError('lastName')
              }}
              aria-invalid={!!errors.lastName}
            />
            {errors.lastName && (
              <p className="text-xs text-destructive">{errors.lastName}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="street">Gateadresse</Label>
          <Input
            id="street"
            type="text"
            placeholder="Storgata 1"
            value={street}
            onChange={(e) => {
              setStreet(e.target.value)
              clearError('street')
            }}
            aria-invalid={!!errors.street}
          />
          {errors.street && (
            <p className="text-xs text-destructive">{errors.street}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postnummer</Label>
            <Input
              id="postalCode"
              type="text"
              placeholder="0000"
              maxLength={4}
              value={postalCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                setPostalCode(val)
                clearError('postalCode')
              }}
              aria-invalid={!!errors.postalCode}
            />
            {errors.postalCode && (
              <p className="text-xs text-destructive">{errors.postalCode}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Poststed</Label>
            <Input
              id="city"
              type="text"
              placeholder="Oslo"
              value={city}
              onChange={(e) => {
                setCity(e.target.value)
                clearError('city')
              }}
              aria-invalid={!!errors.city}
            />
            {errors.city && (
              <p className="text-xs text-destructive">{errors.city}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="orgNumber">Org.nummer</Label>
          <Input
            id="orgNumber"
            type="text"
            placeholder="123 456 789"
            maxLength={11}
            value={orgNumber}
            onChange={(e) => {
              const val = e.target.value.replace(/[^\d\s]/g, '')
              setOrgNumber(val)
              clearError('orgNumber')
            }}
            aria-invalid={!!errors.orgNumber}
          />
          {errors.orgNumber && (
            <p className="text-xs text-destructive">{errors.orgNumber}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={prevStep}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tilbake
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
        >
          Neste
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
