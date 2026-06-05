// ===== Ansatte — page host (directory ↔ profile internal routing) =====
(function () {
  const { useState, useEffect } = React;

  function AnsattePage({ setRoute }) {
    const toast = window.useToast();
    const [sel, setSel] = useState(null); // employee id or null (directory)
    const [tab, setTab] = useState(null); // initial profile tab
    const SD = window.SmartoutData;
    // deep-link: open a specific employee profile when navigated from elsewhere (e.g. Vaktplan «Full plan»)
    useEffect(() => { try { const id = window.__openAnsattId; if (id && SD.EMP_BY_ID && SD.EMP_BY_ID[id]) setSel(id); window.__openAnsattId = null; } catch (e) {} }, []);

    // scroll to top when switching between directory/profile
    useEffect(() => { window.scrollTo({ top: 0 }); }, [sel]);

    // register lightweight Botsson context for this route
    useEffect(() => {
      if (!window.SmartoutContext || !window.SmartoutContext.set) return;
      const e = sel ? SD.EMP_BY_ID[sel] : null;
      window.SmartoutContext.set({
        route: "ansatte", view: sel ? "profile" : "directory",
        subject: e ? e.display : null, role: "admin",
      });
    }, [sel]);

    const open = (id, initialTab) => { setTab(initialTab || null); setSel(id); };
    const back = () => setSel(null);

    if (sel && SD.EMP_BY_ID[sel]) {
      const Profile = window.AnProfile;
      return <Profile e={SD.EMP_BY_ID[sel]} onBack={back} toast={toast} initialTab={tab} />;
    }
    const Directory = window.AnDirectory;
    return <Directory onOpen={open} toast={toast} />;
  }

  window.SO_PAGES = Object.assign(window.SO_PAGES || {}, { ansatte: AnsattePage });
})();
