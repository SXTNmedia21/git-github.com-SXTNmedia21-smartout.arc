import { XCircle } from "lucide-react";

export default function SignDeclinedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <XCircle className="mx-auto h-16 w-16 text-red-500" />
        <h1 className="mt-6 text-2xl font-bold">Avtalen ble avvist</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Du har valgt a ikke signere avtalen. Kontakt oss hvis du har sporsmal eller onsker a
          diskutere vilkarene.
        </p>
      </div>
    </div>
  );
}
