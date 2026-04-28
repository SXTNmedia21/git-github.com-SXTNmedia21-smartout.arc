import Link from "next/link";

export default function PublicSiteNotFound() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="px-4 text-center">
        <h1 className="text-muted-foreground mb-4 text-6xl font-bold">404</h1>
        <p className="text-foreground mb-6 text-lg">Denne siden finnes ikke.</p>
        <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
          Gå til forsiden
        </Link>
      </div>
    </div>
  );
}
