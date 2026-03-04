# Auth Screens Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign all auth pages (login, signup, reset-password) with unified split-screen layout, animated gradient brand panel, and fix the broken reset-password flow.

**Architecture:** Route group `(auth)` wraps all auth pages with a shared split-screen layout. Left panel = animated gradient mesh with brand messaging. Right panel = form. Mobile collapses to form-only. Uses existing shadcn/ui components (Input, Button, Label) with overridden styles. New `/update-password` page completes the reset flow via Supabase auth.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (CSS tokens), shadcn/ui, Framer Motion, Supabase Auth, Lucide icons

**Design doc:** `docs/plans/2026-03-02-auth-screens-redesign.md`

---

### Task 1: Create auth route group layout and brand panel

**Files:**

- Create: `apps/web/src/app/(auth)/layout.tsx`
- Create: `apps/web/src/app/(auth)/_components/AuthBrandPanel.tsx`
- Create: `apps/web/src/app/(auth)/_components/AuthFormWrapper.tsx`
- Create: `apps/web/src/app/(auth)/_components/SmartoutLogo.tsx`

**Step 1: Create the SmartoutLogo component**

Reusable logo mark used on brand panel and mobile form header.

```tsx
// apps/web/src/app/(auth)/_components/SmartoutLogo.tsx
"use client";

import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SmartoutLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="bg-brand-orange shadow-brand-orange/25 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg">
        <Building2 className="h-5 w-5 text-white" />
      </div>
      <span className="text-foreground text-2xl font-black tracking-tight">
        Smart<span className="text-muted-foreground">out</span>
      </span>
    </div>
  );
}
```

**Step 2: Create the AuthBrandPanel component**

Left-side brand panel with animated gradient mesh, tagline, and floating decorative elements.

```tsx
// apps/web/src/app/(auth)/_components/AuthBrandPanel.tsx
"use client";

import { Sparkles, Users, ShieldCheck } from "lucide-react";
import { SmartoutLogo } from "./SmartoutLogo";

const features = [
  { icon: Sparkles, text: "AI-drevet opplæring" },
  { icon: Users, text: "Onboarding på minutter" },
  { icon: ShieldCheck, text: "Alltid klar for drift" },
];

export function AuthBrandPanel() {
  return (
    <div className="relative hidden h-full overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10">
      {/* Animated gradient mesh background */}
      <div className="from-brand-orange/10 dark:from-brand-orange/15 dark:to-background absolute inset-0 bg-gradient-to-br via-amber-500/5 to-rose-500/5 dark:via-amber-900/10" />
      <div className="animate-gradient-shift via-brand-orange/5 dark:via-brand-orange/8 absolute inset-0 bg-gradient-to-tr from-transparent to-amber-500/8 dark:to-amber-800/5" />

      {/* Floating decorative circles */}
      <div className="animate-float bg-brand-orange/8 absolute top-20 right-10 h-64 w-64 rounded-full blur-3xl" />
      <div className="animate-float-delayed absolute bottom-32 left-8 h-48 w-48 rounded-full bg-amber-500/6 blur-3xl" />
      <div className="animate-float-slow absolute top-1/2 left-1/3 h-32 w-32 rounded-full bg-rose-500/5 blur-2xl" />

      {/* Content */}
      <div className="relative z-10">
        <SmartoutLogo />
      </div>

      <div className="relative z-10 space-y-8">
        <div>
          <h1 className="text-foreground text-4xl font-black tracking-tight">
            Klar fra
            <br />
            dag en.
          </h1>
          <p className="text-muted-foreground mt-3 text-lg">
            Ansatte som er klare fra første skift.
          </p>
        </div>

        <div className="space-y-4">
          {features.map((f) => (
            <div key={f.text} className="flex items-center gap-3">
              <div className="bg-brand-orange/10 dark:bg-brand-orange/15 flex h-9 w-9 items-center justify-center rounded-lg">
                <f.icon className="text-brand-orange h-4.5 w-4.5" />
              </div>
              <span className="text-foreground/80 text-sm font-medium">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <p className="text-muted-foreground/60 text-xs">
          &copy; {new Date().getFullYear()} Smartout AS
        </p>
      </div>
    </div>
  );
}
```

**Step 3: Create the AuthFormWrapper component**

Right-side container that centers the form content.

```tsx
// apps/web/src/app/(auth)/_components/AuthFormWrapper.tsx
import { SmartoutLogo } from "./SmartoutLogo";

export function AuthFormWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 lg:min-h-0">
      {/* Mobile-only logo */}
      <div className="mb-8 lg:hidden">
        <SmartoutLogo />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
```

**Step 4: Create the auth route group layout**

```tsx
// apps/web/src/app/(auth)/layout.tsx
import { AuthBrandPanel } from "./_components/AuthBrandPanel";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background grid min-h-screen lg:grid-cols-2">
      <AuthBrandPanel />
      <div className="flex items-center justify-center">{children}</div>
    </div>
  );
}
```

**Step 5: Add CSS animations to globals.css**

Append these keyframes to `apps/web/src/app/globals.css`:

```css
@keyframes gradient-shift {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.05) rotate(1deg);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

@keyframes float-delayed {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-15px);
  }
}

@keyframes float-slow {
  0%,
  100% {
    transform: translateY(0) translateX(0);
  }
  50% {
    transform: translateY(-10px) translateX(10px);
  }
}

.animate-gradient-shift {
  animation: gradient-shift 8s ease-in-out infinite;
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-float-delayed {
  animation: float-delayed 7s ease-in-out infinite 1s;
}

.animate-float-slow {
  animation: float-slow 9s ease-in-out infinite 2s;
}
```

**Step 6: Commit**

```bash
git add apps/web/src/app/\(auth\)/
git add apps/web/src/app/globals.css
git commit -m "feat(auth): add shared auth layout with gradient brand panel"
```

---

### Task 2: Move and redesign login page

**Files:**

- Move: `apps/web/src/app/login/page.tsx` → `apps/web/src/app/(auth)/login/page.tsx`
- Delete: `apps/web/src/app/login/` (old directory)

**Step 1: Create the new login page**

```tsx
// apps/web/src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@smartout/supabase/client";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthFormWrapper } from "../_components/AuthFormWrapper";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthFormWrapper>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Velkommen tilbake</h1>
          <p className="text-muted-foreground text-sm">Logg inn på kontoen din</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted-foreground">
              E-post
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="navn@bedrift.no"
              className="border-input bg-background focus-visible:ring-brand-orange/50 focus-visible:border-brand-orange h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-muted-foreground">
                Passord
              </Label>
              <Link
                href="/reset-password"
                className="text-muted-foreground hover:text-brand-orange text-xs font-medium transition-colors"
              >
                Glemt passord?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Skriv inn passord"
                className="border-input bg-background focus-visible:ring-brand-orange/50 focus-visible:border-brand-orange h-12 rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="border-destructive/20 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="bg-brand-orange shadow-brand-orange/20 hover:bg-brand-orange-light h-12 w-full rounded-xl font-semibold text-white shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Logger inn...
              </>
            ) : (
              "Logg inn"
            )}
          </Button>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          Ny bruker?{" "}
          <Link
            href="/signup"
            className="text-foreground hover:text-brand-orange font-semibold transition-colors"
          >
            Opprett konto
          </Link>
        </p>
      </div>
    </AuthFormWrapper>
  );
}
```

**Step 2: Delete old login directory**

```bash
rm -rf apps/web/src/app/login/
```

**Step 3: Test locally**

Navigate to `http://localhost:3050/login` — verify:

- Split-screen layout on desktop, form-only on mobile
- Logo, gradient panel visible
- Form inputs have orange focus ring
- Login works (email + password → dashboard)
- "Glemt passord?" link points to /reset-password

**Step 4: Commit**

```bash
git add -A apps/web/src/app/\(auth\)/login/ apps/web/src/app/login/
git commit -m "feat(auth): redesign login page with split-screen layout"
```

---

### Task 3: Move and redesign signup page

**Files:**

- Move: `apps/web/src/app/signup/page.tsx` → `apps/web/src/app/(auth)/signup/page.tsx`
- Delete: `apps/web/src/app/signup/` (old directory)

**Step 1: Create the new signup page**

```tsx
// apps/web/src/app/(auth)/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@smartout/supabase/client";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthFormWrapper } from "../_components/AuthFormWrapper";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passordene stemmer ikke overens");
      return;
    }
    if (password.length < 8) {
      setError("Passordet må være minst 8 tegn");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (process.env.NEXT_PUBLIC_ROOT_DOMAIN === "localhost") {
      router.push("/dashboard");
      router.refresh();
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthFormWrapper>
        <div className="space-y-6 text-center">
          <div className="bg-success/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
            <CheckCircle2 className="text-success h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              Sjekk e-posten din
            </h1>
            <p className="text-muted-foreground text-sm">
              Vi har sendt en bekreftelseslenke til{" "}
              <strong className="text-foreground">{email}</strong>.
            </p>
          </div>
          <Link
            href="/login"
            className="text-brand-orange hover:text-brand-orange-light inline-block text-sm font-semibold transition-colors"
          >
            Tilbake til innlogging
          </Link>
        </div>
      </AuthFormWrapper>
    );
  }

  return (
    <AuthFormWrapper>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Opprett konto</h1>
          <p className="text-muted-foreground text-sm">Kom i gang med Smartout</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted-foreground">
              E-post
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="navn@bedrift.no"
              className="border-input bg-background focus-visible:ring-brand-orange/50 focus-visible:border-brand-orange h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-muted-foreground">
              Passord
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minst 8 tegn"
                className="border-input bg-background focus-visible:ring-brand-orange/50 focus-visible:border-brand-orange h-12 rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-muted-foreground">
              Bekreft passord
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Gjenta passord"
              className="border-input bg-background focus-visible:ring-brand-orange/50 focus-visible:border-brand-orange h-12 rounded-xl"
            />
          </div>

          {error && (
            <div className="border-destructive/20 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="bg-brand-orange shadow-brand-orange/20 hover:bg-brand-orange-light h-12 w-full rounded-xl font-semibold text-white shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Oppretter konto...
              </>
            ) : (
              "Opprett konto"
            )}
          </Button>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          Har du allerede en konto?{" "}
          <Link
            href="/login"
            className="text-foreground hover:text-brand-orange font-semibold transition-colors"
          >
            Logg inn
          </Link>
        </p>
      </div>
    </AuthFormWrapper>
  );
}
```

**Step 2: Delete old signup directory**

```bash
rm -rf apps/web/src/app/signup/
```

**Step 3: Test locally**

Navigate to `http://localhost:3050/signup` — verify split-screen layout, Norwegian copy, validation works.

**Step 4: Commit**

```bash
git add -A apps/web/src/app/\(auth\)/signup/ apps/web/src/app/signup/
git commit -m "feat(auth): redesign signup page with split-screen layout"
```

---

### Task 4: Fix and redesign reset-password page

**Files:**

- Move: `apps/web/src/app/reset-password/page.tsx` → `apps/web/src/app/(auth)/reset-password/page.tsx`
- Delete: `apps/web/src/app/reset-password/` (old directory)

**Step 1: Create the new reset-password page with real Supabase auth**

The key fix: replace `setTimeout` stub with actual `supabase.auth.resetPasswordForEmail()`.

```tsx
// apps/web/src/app/(auth)/reset-password/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@smartout/supabase/client";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthFormWrapper } from "../_components/AuthFormWrapper";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/update-password`,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <AuthFormWrapper>
        <div className="space-y-6 text-center">
          <div className="bg-brand-orange/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
            <Mail className="text-brand-orange h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              Sjekk e-posten din
            </h1>
            <p className="text-muted-foreground text-sm">
              Vi har sendt en tilbakestillingslenke til{" "}
              <strong className="text-foreground">{email}</strong>.
            </p>
          </div>
          <Link
            href="/login"
            className="text-brand-orange hover:text-brand-orange-light inline-flex items-center gap-1 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Tilbake til innlogging
          </Link>
        </div>
      </AuthFormWrapper>
    );
  }

  return (
    <AuthFormWrapper>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Tilbakestill passord
          </h1>
          <p className="text-muted-foreground text-sm">
            Skriv inn e-posten din for å motta en tilbakestillingslenke
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted-foreground">
              E-post
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="navn@bedrift.no"
              className="border-input bg-background focus-visible:ring-brand-orange/50 focus-visible:border-brand-orange h-12 rounded-xl"
            />
          </div>

          {error && (
            <div className="border-destructive/20 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="bg-brand-orange shadow-brand-orange/20 hover:bg-brand-orange-light h-12 w-full rounded-xl font-semibold text-white shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sender...
              </>
            ) : (
              "Send tilbakestillingslenke"
            )}
          </Button>
        </form>

        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tilbake til innlogging
        </Link>
      </div>
    </AuthFormWrapper>
  );
}
```

**Step 2: Delete old reset-password directory**

```bash
rm -rf apps/web/src/app/reset-password/
```

**Step 3: Test locally**

- Navigate to `/reset-password`
- Enter valid email → should call Supabase (check network tab)
- Should show "Sjekk e-posten din" success state
- "Tilbake til innlogging" link works

**Step 4: Commit**

```bash
git add -A apps/web/src/app/\(auth\)/reset-password/ apps/web/src/app/reset-password/
git commit -m "fix(auth): replace reset-password stub with real Supabase auth flow"
```

---

### Task 5: Create update-password page (new)

**Files:**

- Create: `apps/web/src/app/(auth)/update-password/page.tsx`

**Step 1: Create the update-password page**

User lands here after clicking the reset email link (via `/api/auth/callback?next=/update-password`). At this point the user has an active session from the PKCE exchange.

```tsx
// apps/web/src/app/(auth)/update-password/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@smartout/supabase/client";
import { Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AuthFormWrapper } from "../_components/AuthFormWrapper";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passordene stemmer ikke overens");
      return;
    }
    if (password.length < 8) {
      setError("Passordet må være minst 8 tegn");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    toast.success("Passordet er oppdatert!");
    router.push("/login");
  }

  return (
    <AuthFormWrapper>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <div className="bg-brand-orange/10 mx-auto flex h-14 w-14 items-center justify-center rounded-full">
            <Lock className="text-brand-orange h-6 w-6" />
          </div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Velg nytt passord</h1>
          <p className="text-muted-foreground text-sm">Skriv inn ditt nye passord</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-muted-foreground">
              Nytt passord
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minst 8 tegn"
                className="border-input bg-background focus-visible:ring-brand-orange/50 focus-visible:border-brand-orange h-12 rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-muted-foreground">
              Bekreft nytt passord
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Gjenta passord"
              className="border-input bg-background focus-visible:ring-brand-orange/50 focus-visible:border-brand-orange h-12 rounded-xl"
            />
          </div>

          {error && (
            <div className="border-destructive/20 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="bg-brand-orange shadow-brand-orange/20 hover:bg-brand-orange-light h-12 w-full rounded-xl font-semibold text-white shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Oppdaterer...
              </>
            ) : (
              "Oppdater passord"
            )}
          </Button>
        </form>
      </div>
    </AuthFormWrapper>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/\(auth\)/update-password/
git commit -m "feat(auth): add update-password page for reset flow completion"
```

---

### Task 6: Redesign select-workspace page

**Files:**

- Move: `apps/web/src/app/select-workspace/page.tsx` → `apps/web/src/app/(auth)/select-workspace/page.tsx`
- Delete: `apps/web/src/app/select-workspace/` (old directory)

**Step 1: Create the new select-workspace page**

This is a server component (needs auth check + DB queries). Reuse auth layout but with custom content instead of AuthFormWrapper.

```tsx
// apps/web/src/app/(auth)/select-workspace/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@smartout/supabase/server";
import { Building2 } from "lucide-react";

export default async function SelectWorkspacePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  type ProfileRow = {
    profile_id: string;
    role: string;
    display_name: string;
    workspace_id: string;
  };
  type WorkspaceRow = { workspace_id: string; name: string; slug: string; logo_url: string | null };

  const { data: profiles } = (await supabase
    .from("profile")
    .select("profile_id, role, display_name, workspace_id")
    .eq("user_id", user.id)) as { data: ProfileRow[] | null };

  const workspaceIds = (profiles ?? []).map((p) => p.workspace_id);

  const { data: workspaceRows } =
    workspaceIds.length > 0
      ? ((await supabase
          .from("workspace")
          .select("workspace_id, name, slug, logo_url")
          .in("workspace_id", workspaceIds)) as { data: WorkspaceRow[] | null })
      : { data: [] as WorkspaceRow[] };

  const workspaces = (profiles ?? [])
    .map((p) => {
      const ws = (workspaceRows ?? []).find((w) => w.workspace_id === p.workspace_id);
      return ws ? { ...ws, role: p.role, displayName: p.display_name } : null;
    })
    .filter(Boolean) as {
    workspace_id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    role: string;
    displayName: string | null;
  }[];

  if (workspaces.length === 1) {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    const ws = workspaces[0]!;
    if (rootDomain && rootDomain !== "localhost") {
      redirect(`https://${ws.slug}.${rootDomain}/dashboard`);
    }
    redirect("/dashboard");
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  const isProduction = rootDomain !== "localhost";

  return (
    <div className="flex min-h-screen items-center justify-center p-6 lg:min-h-0">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-2">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Mine workspaces</h1>
          <p className="text-muted-foreground text-sm">Velg en workspace for å komme i gang.</p>
        </div>

        <div className="grid gap-3">
          {workspaces.map((ws) => {
            const href = isProduction ? `https://${ws.slug}.${rootDomain}/dashboard` : "/dashboard";

            return (
              <Link
                key={ws.workspace_id}
                href={href}
                className="group border-border bg-card hover:border-brand-orange/30 hover:shadow-brand-orange/5 flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-md"
              >
                <div className="bg-muted text-foreground flex h-12 w-12 items-center justify-center rounded-lg text-lg font-black">
                  {ws.logo_url ? (
                    <img
                      src={ws.logo_url}
                      alt=""
                      className="h-full w-full rounded-lg object-cover"
                    />
                  ) : (
                    ws.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-foreground font-semibold">{ws.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {ws.slug}.{rootDomain} &middot; {ws.role}
                  </p>
                </div>
                <span className="text-muted-foreground group-hover:text-brand-orange transition-transform group-hover:translate-x-1">
                  &rarr;
                </span>
              </Link>
            );
          })}
        </div>

        {workspaces.length === 0 && (
          <div className="border-border bg-card rounded-xl border p-8 text-center">
            <Building2 className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
            <p className="text-muted-foreground">Du har ingen workspaces ennå.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Delete old select-workspace directory**

```bash
rm -rf apps/web/src/app/select-workspace/
```

**Step 3: Commit**

```bash
git add -A apps/web/src/app/\(auth\)/select-workspace/ apps/web/src/app/select-workspace/
git commit -m "feat(auth): redesign select-workspace with unified auth layout"
```

---

### Task 7: Verify everything works end-to-end

**Step 1: Run typecheck**

```bash
pnpm turbo typecheck --filter=web
```

Expected: 0 errors

**Step 2: Manual testing checklist**

- [ ] `/login` — split-screen, Norwegian copy, orange CTA, login works
- [ ] `/signup` — split-screen, validation, signup works (dev: auto-redirect, prod: email confirmation)
- [ ] `/reset-password` — real Supabase call, success state shows
- [ ] `/update-password` — password update works, redirects to /login with toast
- [ ] `/select-workspace` — card styling matches auth layout, workspace selection works
- [ ] Mobile: brand panel hidden, logo visible, form centered
- [ ] Dark/light mode: both look good
- [ ] "Glemt passord?" link on login → reset-password
- [ ] "Ny bruker?" link on login → signup
- [ ] "Har en konto?" link on signup → login
- [ ] Error states styled consistently

**Step 3: Commit any final adjustments**

```bash
git add -A
git commit -m "feat(auth): complete auth screens redesign with reset-password flow"
```
