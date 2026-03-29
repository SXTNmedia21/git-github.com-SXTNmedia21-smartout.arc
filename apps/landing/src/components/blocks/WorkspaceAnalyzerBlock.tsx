"use client";

import dynamic from "next/dynamic";
import { m } from "framer-motion";
import type { BlockProps, WorkspaceAnalyzerContent } from "../../lib/block-schemas";
import { getPaddingClasses, getLayoutClasses, getBackgroundClasses } from "./block-helpers";

const WorkspaceAnalyzer = dynamic(() => import("../workspace-analyzer"), { ssr: false });

export default function WorkspaceAnalyzerBlock({
  content,
  settings,
}: BlockProps<WorkspaceAnalyzerContent>) {
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
              <h2 className="text-foreground mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
                {content.heading}
              </h2>
            )}
            {content.subheading && (
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                {content.subheading}
              </p>
            )}
          </m.div>
        )}

        <div className="mx-auto max-w-4xl">
          <WorkspaceAnalyzer />
        </div>
      </div>
    </section>
  );
}
