/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const routes = [
  'people', 'schedule', 'reports', 'governance', 'season', 'organization',
  'my-schedule', 'my-training', 'my-cv', 'my-salary', 'chat', 'ai', 'settings', 'help'
];

const template = (name) => `import { Activity } from "lucide-react";

export default function ${name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')}Page() {
  const formattedName = "${name.replace(/-/g, ' ')}";
  
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
}`;

const baseDir = path.join(__dirname, 'src', 'app', 'dashboard');

routes.forEach(r => {
  const dir = path.join(baseDir, r);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'page.tsx'), template(r));
});

console.log('Pages generated successfully!');
