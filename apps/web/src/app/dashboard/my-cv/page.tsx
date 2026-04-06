import { redirect } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

export default function MyCvPage() {
  if (!FEATURE_FLAGS.MY_CV) {
    redirect("/dashboard");
  }

  return (
    <div className="py-12 text-center">
      <h1 className="text-2xl font-bold">Min profil</h1>
      <p className="text-muted-foreground mt-2">Under utvikling</p>
    </div>
  );
}
