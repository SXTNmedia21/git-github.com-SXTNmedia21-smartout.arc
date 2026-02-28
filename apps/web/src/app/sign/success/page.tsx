import { CheckCircle } from "lucide-react";

export default function SignSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-6 text-2xl font-bold">Avtalen er signert!</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Takk for at du signerte avtalen. En kopi er sendt til e-posten din. Du kan lukke dette
          vinduet.
        </p>
      </div>
    </div>
  );
}
