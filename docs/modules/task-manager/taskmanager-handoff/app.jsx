// Main app
const { useState, useEffect } = React;

function App() {
  const [tasks, setTasks] = useState(window.SmartoutData.TASKS);
  const [view, setView] = useState('mindag');
  const [filter, setFilter] = useState('all');
  const [openTaskId, setOpenTaskId] = useState(null);
  const [openManualId, setOpenManualId] = useState(null);
  const [openGuideId, setOpenGuideId] = useState(null);
  const [openQuizId, setOpenQuizId] = useState(null);

  // Tweaks
  const tweakDefaults = /*EDITMODE-BEGIN*/{
    "theme": "light",
    "density": "comfortable",
    "accent": "#f97316",
    "showBotsson": true
  }/*EDITMODE-END*/;
  const [tweaks, setTweak] = window.useTweaks(tweakDefaults);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
  }, [tweaks.theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--orange', tweaks.accent);
  }, [tweaks.accent]);

  const openTask = tasks.find(t => t.id === openTaskId);

  const onToggleStatus = (id) => {
    setTasks(ts => ts.map(t =>
      t.id === id
        ? { ...t, status: t.status === 'done' ? 'todo' : 'done', completedAt: t.status === 'done' ? null : 'Nå' }
        : t
    ));
  };
  const onToggleSubtask = (taskId, subId) => {
    setTasks(ts => ts.map(t =>
      t.id !== taskId ? t :
      { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s) }
    ));
  };

  return (
    <>
      <div className="app" data-density={tweaks.density}>
        <Sidebar view={view} setView={setView} />
        <main className="main">
          {view === 'mindag' && (
            <MinDag
              tasks={tasks}
              filter={filter}
              setFilter={setFilter}
              onOpen={setOpenTaskId}
              onToggleStatus={onToggleStatus}
            />
          )}
          {view === 'all' && (
            <MinDag
              tasks={tasks}
              filter={filter}
              setFilter={setFilter}
              onOpen={setOpenTaskId}
              onToggleStatus={onToggleStatus}
            />
          )}
          {view === 'library' && (
            <Library onOpenManual={setOpenManualId} />
          )}
        </main>
      </div>
      <MobileTabbar view={view} setView={setView} />

      {view === 'builder' && (
        <window.ManualBuilder
          onClose={() => setView('library')}
          onPreviewGuide={setOpenGuideId}
        />
      )}

      {view === 'quizmaster' && (
        <window.QuizMaster
          onClose={() => setView('library')}
          onPreviewQuiz={setOpenQuizId}
        />
      )}

      {openQuizId && (
        <window.QuizGuide
          quizId={openQuizId}
          onClose={() => setOpenQuizId(null)}
        />
      )}

      {openTask && (
        <TaskDrawer
          task={openTask}
          onClose={() => setOpenTaskId(null)}
          onOpenManual={setOpenManualId}
          onToggleSubtask={onToggleSubtask}
          onToggleStatus={(id) => { onToggleStatus(id); }}
        />
      )}

      {openManualId && (
        <ManualViewer
          manualId={openManualId}
          onClose={() => setOpenManualId(null)}
        />
      )}

      {openGuideId && (
        <window.ManualGuide
          draftId={openGuideId}
          onClose={() => setOpenGuideId(null)}
        />
      )}

      <window.TweaksPanel title="Tweaks">
        <window.TweakSection title="Utseende">
          <window.TweakRadio label="Tema" value={tweaks.theme} options={[{value:'light',label:'Lys'},{value:'dark',label:'Mørk'}]} onChange={v => setTweak('theme', v)} />
          <window.TweakRadio label="Tetthet" value={tweaks.density} options={[{value:'comfortable',label:'Romslig'},{value:'compact',label:'Kompakt'}]} onChange={v => setTweak('density', v)} />
          <window.TweakColor label="Aksentfarge" value={tweaks.accent} onChange={v => setTweak('accent', v)} />
        </window.TweakSection>
        <window.TweakSection title="Innhold">
          <window.TweakToggle label="Vis Botsson-forslag" value={tweaks.showBotsson} onChange={v => setTweak('showBotsson', v)} />
        </window.TweakSection>
      </window.TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
