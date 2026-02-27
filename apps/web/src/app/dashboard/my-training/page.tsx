import { Activity } from "lucide-react";

export default function MyTrainingPage() {
  const formattedName = "my training";
  
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-white capitalize">{formattedName} Overview</h1>
        <p className="text-sm text-zinc-400">Manage and view your {formattedName} data here.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 transition-colors border-zinc-800 bg-zinc-900/20">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-zinc-800">
          <Activity className="w-8 h-8 text-zinc-500" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-zinc-200 capitalize">{formattedName} is under construction!</h2>
        <p className="text-center max-w-sm text-zinc-500">
          We are currently building this section. To see a working demo of the components, navigate to
          <strong className="mx-1 text-orange-500">Live Operations</strong>
          in the sidebar.
        </p>
      </div>
    </>
  );
}