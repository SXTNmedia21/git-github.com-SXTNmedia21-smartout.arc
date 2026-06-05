// canvas.jsx — Designer canvas wrapping all scenes

const App = () => (
  <DesignCanvas>
    <DCSection
      id="intro"
      title="HMS Document Mode — Wizard + Handbook + File Archive"
      subtitle="Full target architecture from Part A. Hero is the Sortie 1 MVP (Wizard mode at chapter 9/10). Later sorties — IK-mat tab, Snapshots, Runtime activation, Vedlegg — shown as separate artboards so each can be reviewed standalone."
    >
      <DCPostIt x={20} y={-90}>
        <b>Hero is Sortie 1.</b>
        <br/>Everything tagged Sortie 2-5 is intentionally shown muted/deferred — wizard ships first, the rest follows the campaign roadmap.
      </DCPostIt>
    </DCSection>

    <DCSection
      id="wizard-hero"
      title="A · Wizard mode (Sortie 1 MVP)"
      subtitle="The hero. Wizard chrome on /dashboard/handbook?wizard=true — sidebar Level A progress (8/10), Tiptap canvas mid-chapter with risk-table + responsibility + checklist blocks inserted, Handling tab open with mark-completed CTA front-and-center."
    >
      <DCArtboard id="wizard-hero" label="Chapter 9/10 · Beredskap og brann · Handling panel" width={1440} height={900}>
        <SceneWizardHero/>
      </DCArtboard>
    </DCSection>

    <DCSection
      id="wizard-states"
      title="A.2 · Sidebar progress states"
      subtitle="Tweak surfaces the wizard goes through. 0/10 first-visit · 3/10 early · 7/10 late · 10/10 complete."
    >
      <DCArtboard id="sidebar-stack" label="Sidebar progress · 4 states" width={1240} height={620}>
        <SceneSidebarStates/>
      </DCArtboard>
    </DCSection>

    <DCSection
      id="dashboard-banner"
      title="A.3 · HMS dashboard banner (employee view)"
      subtitle="Non-admin role. /dashboard/hms · Oversikt tab. Banner shows wizard progress without redirecting. Admin would have been redirected straight to the wizard."
    >
      <DCArtboard id="dashboard-banner" label="Employee · setup in progress" width={1280} height={800}>
        <SceneDashboardBanner/>
      </DCArtboard>
    </DCSection>

    <DCSection
      id="right-panel"
      title="B · Right panel evolution (Sortie 1 → Sortie 5)"
      subtitle="The four tabs that live alongside every chapter. Verktøy and Innstillinger ship in Sortie 1. Handling grows over later sorties — Sortie tags shown muted. Vedlegg unlocks in Sortie 5."
    >
      <DCArtboard id="panel-verktoy" label="Verktøy · insert blocks" width={340} height={720}><PanelVerktoy/></DCArtboard>
      <DCArtboard id="panel-handling" label="Handling · S1 → S4 ladder" width={340} height={720}><PanelHandling/></DCArtboard>
      <DCArtboard id="panel-innst" label="Innstillinger · ownership + review" width={340} height={720}><PanelInnstillinger/></DCArtboard>
      <DCArtboard id="panel-vedlegg" label="Vedlegg · attachments (Sortie 5)" width={340} height={720}><PanelVedlegg/></DCArtboard>
    </DCSection>

    <DCSection
      id="ik-mat"
      title="C · IK-mat operational tab (Sortie 3)"
      subtitle="/dashboard/hms/ik-mat — daily execution surface that consumes the same primitives. Temperaturkontroll (from haccp_log), open deviations (framework: ik-mat), today's checklists, Mattilsynet inspection pack."
    >
      <DCArtboard id="ik-mat" label="Daily IK-mat operations" width={1440} height={920}>
        <SceneIkMat/>
      </DCArtboard>
    </DCSection>

    <DCSection
      id="print"
      title="D · Snapshot &amp; Print (Sortie 2)"
      subtitle="hms_document_snapshot — render full handbook, single chapter, or IK-mat-section for Mattilsynet. Version history persists each snapshot."
    >
      <DCArtboard id="print" label="PDF preview · snapshot history" width={1280} height={760}>
        <ScenePrint/>
      </DCArtboard>
    </DCSection>

    <DCSection
      id="runtime"
      title="E · Runtime activation (Sortie 4)"
      subtitle='"Aktiver i runtime" promotes Tiptap blocks into cascade rows — procedure, routine, framework_rule, session_task. C4-gated, reversible, with cross-campaign collision callout.'
    >
      <DCArtboard id="runtime-modal" label='"Aktiver i runtime" confirm modal' width={1100} height={720}>
        <SceneRuntimeActivation/>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
