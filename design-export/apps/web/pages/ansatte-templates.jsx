// ===== Ansatte — Templates (Maler) + system-connected Document Editor =====
(function () {
  const { useState } = React;
  const A = window.An;
  const { Ic, SD, empName } = A;
  const TPL = SD.DOC_TEMPLATES || [];
  const SYS = SD.SYSTEM_FIELDS || {};
  const LINKS = SD.DEEP_LINKS || [];

  const SAMPLE = {
    "ansatt.navn": "Maria Andersen", "ansatt.fornavn": "Maria", "ansatt.ansattnr": "BN-0142", "ansatt.stilling": "Driftsleder", "ansatt.avdeling": "Sal", "ansatt.epost": "maria@bistronord.no",
    "kontrakt.form": "Fast", "kontrakt.prosent": "100 %", "kontrakt.uketimer": "37,5", "kontrakt.lonn": "56 250 kr/mnd", "kontrakt.start": "1. aug 2023", "kontrakt.slutt": "løpende", "kontrakt.provetid": "6 mnd",
    "arbeidsplass.navn": "Bistro Nord", "arbeidsplass.orgnr": "912 345 678", "arbeidsplass.adresse": "Storgata 14, 0184 Oslo", "arbeidsplass.leder": "Erik S.",
    "dato.idag": "30. mai 2026", "signatur.ansatt": "✕ Signatur – ansatt", "signatur.leder": "✕ Signatur – leder",
  };
  const TYPE_IC = { kontrakt: "checkdoc", skjema: "clipcheck", vedlegg: "file" };

  function countTokens(tpl) {
    let ph = 0, lk = 0;
    (tpl.sections || []).forEach((s) => (s.blocks || []).forEach((b) => {
      if (b.text) { ph += (b.text.match(/\{\{[^}]+\}\}/g) || []).length; lk += (b.text.match(/\[\[[^\]]+\]\]/g) || []).length; }
    }));
    return { ph, lk };
  }

  // parse text → react nodes with placeholder + deep-link chips
  function render(text, preview) {
    if (!text) return null;
    const parts = text.split(/(\{\{[^}]+\}\}|\[\[[^\]]+\]\])/g);
    return parts.map((p, i) => {
      if (/^\{\{.+\}\}$/.test(p)) {
        const tok = p.slice(2, -2).trim();
        return <span key={i} className="an-ph">{preview ? (SAMPLE[tok] != null ? SAMPLE[tok] : tok) : tok}</span>;
      }
      if (/^\[\[.+\]\]$/.test(p)) {
        const lbl = p.slice(2, -2).trim();
        return <span key={i} className="an-dl-chip"><Ic n="link" s={11} /> {lbl}</span>;
      }
      return <React.Fragment key={i}>{p}</React.Fragment>;
    });
  }

  // ---------- Maler library ----------
  function Templates({ onEdit, toast }) {
    return (
      <div className="an-tpl-grid">
        {TPL.map((t) => {
          const c = countTokens(t);
          return (
            <div key={t.id} className="an-tpl" onClick={() => onEdit(t)}>
              <div className="an-tpl-top">
                <span className={`an-tpl-ic ${t.type}`}><Ic n={TYPE_IC[t.type] || "file"} s={18} /></span>
                <div className="an-tpl-h">
                  <div className="an-tpl-nm">{t.name}</div>
                  <div className="an-tpl-meta">{t.category}<span>·</span>v{t.version}<span>·</span>{t.status === "published" ? "Publisert" : "Utkast"}</div>
                </div>
              </div>
              <p className="an-tpl-desc">{t.desc}</p>
              <div className="an-tpl-foot">
                <span className="stat"><Ic n="sliders" s={12} c="var(--info)" /> <span className="mono">{c.ph}</span> felt</span>
                <span className="stat"><Ic n="link" s={12} c="var(--orange)" /> <span className="mono">{c.lk}</span></span>
                <span className="gr" />
                {t.autoAttach ? <span className="an-tpl-auto"><Ic n="check" s={10} sw={2.6} /> Auto</span> : <span className="stat"><span className="mono">{t.uses}</span> i bruk</span>}
              </div>
            </div>
          );
        })}
        <button className="an-tpl" style={{ border: "1px dashed var(--border-strong)", alignItems: "center", justifyContent: "center", color: "var(--muted)", minHeight: 150, background: "transparent" }} onClick={() => onEdit(null)}>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--secondary)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic n="plus" s={20} sw={2.2} /></span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Ny mal</span>
            <span style={{ fontSize: 11.5 }}>Bygg en mal i Document Editor</span>
          </span>
        </button>
      </div>
    );
  }

  // ---------- system-connected Document Editor ----------
  function TemplateEditor({ tpl, onClose, toast }) {
    const blank = { id: "new", name: "Ny mal", type: "kontrakt", category: "Ansettelse", version: "0.1", status: "draft", autoAttach: null, owner: "ma", updated: "i dag", sections: [{ id: "s1", title: "Ny seksjon", blocks: [{ t: "p", text: "Skriv her, og sett inn systemfelter fra venstre." }] }] };
    const base = tpl || blank;
    const [secs, setSecs] = useState(() => JSON.parse(JSON.stringify(base.sections)));
    const [active, setActive] = useState(null); // "si:bi"
    const [preview, setPreview] = useState(false);
    const [auto, setAuto] = useState(!!base.autoAttach);

    const insert = (snippet) => {
      if (!active) { toast("Velg en tekstblokk først"); return; }
      const [si, bi] = active.split(":").map(Number);
      setSecs((prev) => {
        const next = prev.map((s) => ({ ...s, blocks: s.blocks.map((b) => ({ ...b })) }));
        const blk = next[si].blocks[bi];
        if (blk.text == null) { toast("Denne blokken tar ikke felter"); return prev; }
        blk.text = (blk.text + " " + snippet).replace(/\s+/g, " ").trim();
        return next;
      });
    };

    return (
      <div className="an-ed" role="dialog" aria-label="Document Editor">
        <div className="an-ed-top">
          <button className="an-ed-back" onClick={onClose}><Ic n="chevLeft" s={16} /> Maler</button>
          <span className="an-ed-ttl">{base.name}</span>
          <span className="an-ed-ver">v{base.version}</span>
          <span className="an-ed-ver" style={{ color: base.status === "published" ? "var(--success)" : "var(--muted)" }}>{base.status === "published" ? "Publisert" : "Utkast"}</span>
          <span className="gr" />
          <button className={`an-btn sm ${preview ? "dark" : ""}`} onClick={() => setPreview((p) => !p)}><Ic n="eye" s={14} /> {preview ? "Rediger" : "Forhåndsvis"}</button>
          <button className="an-btn sm" onClick={() => toast("Mal lagret som utkast", { undo: () => {} })}><Ic n="file" s={14} /> Lagre</button>
          <button className="an-btn sm primary" onClick={() => { toast("Mal publisert til Document Mode", { undo: () => {} }); onClose(); }}><Ic n="check" s={14} sw={2.2} /> Publiser</button>
        </div>

        <div className="an-ed-body">
          {/* rail: system fields + deep links + settings */}
          <aside className="an-ed-rail">
            <div className="an-ed-railsec"><Ic n="sliders" s={12} /> Systemfelter</div>
            <div style={{ fontSize: 11, color: "var(--muted)", padding: "0 4px 8px", lineHeight: 1.4 }}>Klikk for å sette inn i valgt blokk. Felt fylles automatisk med ekte data ved bruk.</div>
            {Object.values(SYS).map((g) => (
              <div key={g.label} className="an-ed-grp">
                <div className="an-ed-grp-h"><span className="ic"><Ic n={g.icon} s={13} /></span>{g.label}</div>
                <div className="an-ed-chips">
                  {g.fields.map((f) => <button key={f.token} className="an-ed-fchip" title={f.label} onClick={() => insert("{{" + f.token + "}}")}>{f.token}</button>)}
                </div>
              </div>
            ))}

            <div className="an-ed-railsec"><Ic n="link" s={12} /> Snarveier & deep links</div>
            {LINKS.map((l) => <button key={l.target} className="an-ed-dl" onClick={() => insert("[[" + l.label + "]]")}><span className="ic"><Ic n={l.icon} s={15} /></span>{l.label}</button>)}

            <div className="an-ed-railsec"><Ic n="settings" s={12} /> Innstillinger</div>
            <div className="an-ed-set">
              <div className="an-ed-setrow">
                <div className="l"><div className="t">Send med automatisk</div><div className="s">Vedlegges ved {base.autoAttach === "medarbeidersamtale" ? "medarbeidersamtale" : base.autoAttach === "onboarding" ? "onboarding" : "valgt hendelse"}</div></div>
                <button className={`sk-switch ${auto ? "on" : ""}`} onClick={() => { setAuto((a) => !a); toast(auto ? "Auto-vedlegg av" : "Auto-vedlegg på"); }}><span /></button>
              </div>
              <div className="an-ed-setrow"><div className="l"><div className="t">Kategori</div></div><span className="an-ed-ver">{base.category}</span></div>
              <div className="an-ed-setrow"><div className="l"><div className="t">Eier</div></div><span style={{ fontSize: 12.5, fontWeight: 500 }}>{empName(base.owner)}</span></div>
            </div>
            <div className="an-ed-hint"><span className="ic"><Ic n="bot" s={13} /></span><span>Botsson holder felter synkronisert med datamodellen. Endrer du et systemfelt, oppdateres alle maler som bruker det.</span></div>
          </aside>

          {/* canvas */}
          <div className="an-ed-canvas">
            <div className="an-ed-sheet">
              <div className="an-ed-cover">
                <span className="eyebrow"><Ic n="checkdoc" s={12} /> {base.type === "kontrakt" ? "Kontraktsmal" : base.type === "skjema" ? "Skjema" : "Vedlegg"} · Document Mode</span>
                <input className="an-ed-name" defaultValue={base.name} />
                <div className="an-ed-covermeta">
                  <span>{countTokens({ sections: secs }).ph} systemfelter</span><span>·</span>
                  <span>{countTokens({ sections: secs }).lk} deep links</span><span>·</span>
                  <span>Sist endret {base.updated}</span>
                  {base.autoAttach && <span className="an-tpl-auto" style={{ marginLeft: 4 }}><Ic n="check" s={10} sw={2.6} /> Auto-vedlegg</span>}
                </div>
              </div>

              {secs.map((s, si) => (
                <div key={s.id} className="an-ed-sec">
                  <h3 className="an-ed-sec-t">{s.title}</h3>
                  {s.blocks.map((b, bi) => {
                    const key = si + ":" + bi;
                    const isActive = active === key && !preview;
                    if (b.t === "list") {
                      return (
                        <div key={bi} className={`an-ed-block ${isActive ? "active" : ""} ${preview ? "preview" : ""}`} onClick={() => setActive(key)}>
                          <span className="btype">Liste</span>
                          <ul className="an-ed-list">{b.items.map((it, k) => <li key={k}>{render(it, preview)}</li>)}</ul>
                        </div>
                      );
                    }
                    const cls = b.t === "field" ? "field" : b.t === "sign" ? "sign" : b.t === "h" ? "h" : "";
                    const lbl = b.t === "field" ? "Felt" : b.t === "sign" ? "Signatur" : b.t === "h" ? "Tittel" : "Avsnitt";
                    return (
                      <div key={bi} className={`an-ed-block ${isActive ? "active" : ""} ${preview ? "preview" : ""}`} onClick={() => setActive(key)}>
                        <span className="btype">{lbl}</span>
                        <div className={`an-ed-txt ${cls}`}>{render(b.text, preview)}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.AnTemplates = Templates;
  window.AnTemplateEditor = TemplateEditor;
})();
