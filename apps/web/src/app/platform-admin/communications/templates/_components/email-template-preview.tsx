"use client";

import { useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmailTemplateSection, EmailTemplatePlaceholder } from "../[id]/edit/save-action";

type EmailTemplatePreviewProps = {
  subject: string;
  sections: EmailTemplateSection[];
  placeholders: EmailTemplatePlaceholder[];
};

function replacePlaceholders(text: string, placeholders: EmailTemplatePlaceholder[]): string {
  let result = text;
  for (const p of placeholders) {
    const value = p.defaultValue || `[${p.label || p.key}]`;
    result = result.replaceAll(`{{${p.key}}}`, value);
  }
  return result;
}

function renderSection(
  section: EmailTemplateSection,
  placeholders: EmailTemplatePlaceholder[],
): string {
  const r = (text: string) => replacePlaceholders(text, placeholders);

  switch (section.type) {
    case "title":
      return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">${r(section.content ?? "")}</h1>`;

    case "message":
      return `<div style="font-size:14px;line-height:1.6;color:#374151;">${r(section.content ?? "")}</div>`;

    case "image":
      if (!section.imageUrl)
        return '<div style="padding:20px;text-align:center;color:#9ca3af;border:1px dashed #d1d5db;border-radius:6px;">[Image placeholder]</div>';
      return `<img src="${section.imageUrl}" alt="${r(section.imageAlt ?? "")}" style="max-width:100%;height:auto;border-radius:6px;" />`;

    case "list":
      if (!section.items?.length) return "";
      const items = section.items
        .map((item) => `<li style="margin-bottom:4px;">${r(item)}</li>`)
        .join("");
      return `<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6;color:#374151;">${items}</ul>`;

    case "html":
      return r(section.content ?? "");

    case "button":
      return `<div style="text-align:center;padding:8px 0;">
        <a href="${section.buttonUrl ?? "#"}" style="display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">${r(section.buttonText ?? "Click here")}</a>
      </div>`;

    case "divider":
      return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />';

    case "card": {
      const cardImg = section.imageUrl
        ? `<img src="${section.imageUrl}" alt="" style="width:100%;height:160px;object-fit:cover;border-radius:6px 6px 0 0;" />`
        : "";
      return `<div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin:8px 0;">
        ${cardImg}
        <div style="padding:16px;">
          <h3 style="margin:0 0 4px;font-size:16px;font-weight:600;color:#111827;">${r(section.content ?? "Card Title")}</h3>
          <p style="margin:0;font-size:13px;color:#6b7280;">${r(section.subtitle ?? "")}</p>
        </div>
      </div>`;
    }

    case "hero_card": {
      const bgImg = section.imageUrl
        ? `background-image:url('${section.imageUrl}');background-size:cover;background-position:center;`
        : "background:#1e293b;";
      const bullets = (section.items ?? [])
        .map(
          (item) =>
            `<li style="margin-bottom:4px;font-size:14px;color:rgba(255,255,255,0.9);">${r(item)}</li>`,
        )
        .join("");
      const bulletHtml = bullets
        ? `<ul style="margin:12px 0 0;padding-left:20px;">${bullets}</ul>`
        : "";
      return `<div style="border-radius:8px;overflow:hidden;margin:8px 0;${bgImg}">
        <div style="padding:32px 24px;background:rgba(0,0,0,0.5);">
          <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fff;">${r(section.content ?? "Hero Title")}</h2>
          <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8);">${r(section.subtitle ?? "")}</p>
          ${bulletHtml}
        </div>
      </div>`;
    }

    case "cta":
      return `<div style="background:#f0f9ff;border-radius:8px;padding:24px;text-align:center;margin:8px 0;">
        <p style="margin:0 0 12px;font-size:16px;font-weight:500;color:#111827;">${r(section.content ?? "")}</p>
        <a href="${section.buttonUrl ?? "#"}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${r(section.buttonText ?? "Get Started")}</a>
      </div>`;

    case "video": {
      const thumb = section.videoThumbnailUrl
        ? `<img src="${section.videoThumbnailUrl}" alt="${r(section.content ?? "Video")}" style="width:100%;height:auto;border-radius:6px;" />`
        : `<div style="width:100%;height:200px;background:#1e293b;border-radius:6px;display:flex;align-items:center;justify-content:center;">
            <div style="width:60px;height:60px;background:rgba(255,255,255,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;">
              <div style="width:0;height:0;border-top:12px solid transparent;border-bottom:12px solid transparent;border-left:20px solid #111827;margin-left:4px;"></div>
            </div>
          </div>`;
      return `<div style="margin:8px 0;text-align:center;">
        <a href="${section.videoUrl ?? "#"}" style="text-decoration:none;display:block;position:relative;">
          ${thumb}
          ${
            section.videoThumbnailUrl
              ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;background:rgba(0,0,0,0.7);border-radius:50%;display:flex;align-items:center;justify-content:center;">
            <div style="width:0;height:0;border-top:12px solid transparent;border-bottom:12px solid transparent;border-left:20px solid #fff;margin-left:4px;"></div>
          </div>`
              : ""
          }
        </a>
        ${section.content ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;">${r(section.content)}</p>` : ""}
      </div>`;
    }

    case "footer":
      return `<div style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;">${r(section.content ?? "")}</div>`;

    default:
      return "";
  }
}

export function EmailTemplatePreview({
  subject,
  sections,
  placeholders,
}: EmailTemplatePreviewProps) {
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");

  const html = useMemo(() => {
    const bodyParts = sections.map((s) => renderSection(s, placeholders)).join("\n");
    const subjectLine = replacePlaceholders(subject, placeholders);

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Subject preview -->
    <div style="background:#fff;border-radius:8px 8px 0 0;padding:12px 16px;border-bottom:1px solid #e5e7eb;">
      <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Subject</p>
      <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#111827;">${subjectLine || "[No subject]"}</p>
    </div>
    <!-- Email body -->
    <div style="background:#fff;border-radius:0 0 8px 8px;padding:24px;">
      ${bodyParts || '<p style="color:#9ca3af;text-align:center;">Add sections to see preview</p>'}
    </div>
  </div>
</body>
</html>`;
  }, [subject, sections, placeholders]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium">Preview</span>
        <div className="flex items-center gap-1">
          <Button
            variant={width === "desktop" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setWidth("desktop")}
          >
            <Monitor className="h-3 w-3" />
          </Button>
          <Button
            variant={width === "mobile" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setWidth("mobile")}
          >
            <Smartphone className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="bg-muted/30 flex flex-1 justify-center overflow-y-auto p-4">
        <iframe
          srcDoc={html}
          className="border-border rounded-md border bg-white"
          style={{
            width: width === "desktop" ? "100%" : "375px",
            minHeight: "500px",
            height: "100%",
          }}
          title="Email template preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
