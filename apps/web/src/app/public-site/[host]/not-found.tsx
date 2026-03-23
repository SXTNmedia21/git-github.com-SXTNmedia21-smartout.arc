import Link from "next/link";

export default function PublicSiteNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="px-4 text-center">
        <h1 className="mb-4 text-6xl font-bold text-gray-300">404</h1>
        <p className="mb-6 text-lg text-gray-600">Denne siden finnes ikke.</p>
        <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
          Gå til forsiden
        </Link>
      </div>
    </div>
  );
}
