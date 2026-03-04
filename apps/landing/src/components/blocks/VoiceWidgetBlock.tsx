"use client";

import dynamic from "next/dynamic";
import { m } from "framer-motion";
import type { BlockProps, VoiceWidgetContent } from "../../lib/block-schemas";
import type { VariantVoiceConfig } from "../../lib/variant-voice-config";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

const VoiceDemoWidget = dynamic(() => import("../landing/VoiceDemoWidget"), { ssr: false });

/** Default voice config for the block-rendered voice widget. */
const DEFAULT_VOICE_CONFIG: VariantVoiceConfig = {
  variant: "B",
  personaName: "Besokende",
  personaRole: "Generell",
  accentColor: "orange",
  placeholderTitle: "Snakk med SmartOut AI",
  placeholderSubtitle: "Klikk for a starte en samtale.",
  usePulse: true,
  promptContext:
    "Du snakker med en besokende pa smartout.ai. Svar kort og hjelpsomt om SmartOut-plattformen.",
};

export default function VoiceWidgetBlock({ content, settings }: BlockProps<VoiceWidgetContent>) {
  return (
    <section
      className={`px-6 ${getPaddingClasses(settings.padding)} ${getBackgroundClasses(settings.background)}`}
    >
      <div className={`mx-auto ${getLayoutClasses(settings.layout)}`}>
        {(content.heading || content.subheading) && (
          <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            {content.heading && (
              <h2 className="mb-4 text-4xl font-bold tracking-tight text-white lg:text-5xl">
                {content.heading}
              </h2>
            )}
            {content.subheading && (
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">{content.subheading}</p>
            )}
          </m.div>
        )}

        <div className="mx-auto max-w-4xl">
          <VoiceDemoWidget config={DEFAULT_VOICE_CONFIG} height="460px" />
        </div>
      </div>
    </section>
  );
}
