import { Suspense } from "react";
import { SignupWizard } from "./_components/SignupWizard";

export default async function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      }
    >
      <SignupWizard />
    </Suspense>
  );
}
