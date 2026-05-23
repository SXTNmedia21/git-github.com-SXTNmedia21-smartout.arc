/**
 * smartout/no-wizard-barrel-import
 *
 * Forbids `import … from "@smartout/ui/wizard"` in apps/mobile/**.
 * Mobile must use the deep entry `@smartout/ui/wizard/state` to avoid
 * transitively pulling lucide-react + framer-motion (web-only deps) via
 * Metro bundler.
 *
 * The wizard barrel (src/wizard/index.ts) re-exports WizardShell,
 * WizardSidebar, WizardTopBar, WizardNavBar — all web-only components
 * that import framer-motion and lucide-react. Metro statically resolves
 * all re-exports, so importing any named export from the barrel pulls in
 * the entire tree.
 *
 * Severity: `error` — scoped to apps/mobile/** only (see eslint.config.mjs
 * in apps/mobile). Web wizard imports from the barrel remain permitted.
 */

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow web-only wizard barrel imports on mobile. Use "@smartout/ui/wizard/state" instead.',
    },
    schema: [],
    messages: {
      barrel:
        'Import from "@smartout/ui/wizard/state" instead — the wizard barrel pulls web-only shells (lucide-react, framer-motion) into the Metro bundle.',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value === "@smartout/ui/wizard") {
          context.report({ node, messageId: "barrel" });
        }
      },
    };
  },
};

export default rule;
