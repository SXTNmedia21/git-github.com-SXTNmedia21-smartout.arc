'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface AutoFillFieldProps
  extends React.ComponentPropsWithoutRef<typeof Input> {
  autoFilled?: boolean
}

export function AutoFillField({
  autoFilled = false,
  className,
  ...props
}: AutoFillFieldProps) {
  const [showShimmer, setShowShimmer] = useState(false)
  const prevAutoFilled = useRef(autoFilled)

  useEffect(() => {
    if (!prevAutoFilled.current && autoFilled) {
      setShowShimmer(true)
      const timer = setTimeout(() => setShowShimmer(false), 1200)
      return () => clearTimeout(timer)
    }
    prevAutoFilled.current = autoFilled
  }, [autoFilled])

  return (
    <div className="relative">
      <Input
        className={cn(
          'transition-all duration-300',
          showShimmer && 'animate-autofill-shimmer',
          autoFilled && 'border-amber-300 dark:border-amber-700',
          className,
        )}
        {...props}
      />
      {autoFilled && (
        <span className="absolute -top-2 right-2 rounded bg-amber-50 px-1.5 text-[10px] font-medium text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
          Auto-fylt
        </span>
      )}
    </div>
  )
}
