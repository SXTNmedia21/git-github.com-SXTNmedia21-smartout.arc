import { XCircle } from "lucide-react";

export default function SignDeclinedPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="text-center">
        <XCircle className="text-destructive mx-auto h-16 w-16" />
        <h1 className="font-heading text-foreground mt-6 text-2xl font-bold">Avtalen ble avvist</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Du har valgt a ikke signere avtalen. Kontakt oss hvis du har sporsmal eller onsker a
          diskutere vilkarene.
        </p>
      </div>
    </div>
  );
}
