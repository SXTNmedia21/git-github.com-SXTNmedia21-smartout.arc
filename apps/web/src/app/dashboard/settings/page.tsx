import { Activity } from "lucide-react";

export default function SettingsPage() {
  const formattedName = "settings";

  return (
    <>
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white capitalize">
          {formattedName} Overview
        </h1>
        <p className="text-sm text-zinc-400">Manage and view your {formattedName} data here.</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/20 p-12 transition-colors">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
          <Activity className="h-8 w-8 text-zinc-500" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-zinc-200 capitalize">
          {formattedName} is under construction!
        </h2>
        <p className="max-w-sm text-center text-zinc-500">
          We are currently building this section. To see a working demo of the components, navigate
          to
          <strong className="mx-1 text-orange-500">Live Operations</strong>
          in the sidebar.
        </p>
      </div>
    </>
  );
}
