"use client";

import { useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SendGridTemplateData } from "@smartout/notifications";

type EmailPreviewProps = {
  templateData: SendGridTemplateData;
};

function buildPreviewHtml(data: SendGridTemplateData): string {
  const items = data.items ?? [];

  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    .wrapper { max-width:600px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden; }
    .hero { background:linear-gradient(135deg,#1a1a2e,#16213e); padding:32px; color:#fff; text-align:center; }
    .hero h1 { margin:0; font-size:24px; font-weight:700; }
    .hero img { max-width:100%; border-radius:8px; margin-bottom:16px; }
    .content { padding:32px; color:#1a1a2e; font-size:15px; line-height:1.6; }
    .content h2 { margin:0 0 12px; font-size:20px; }
    .items { margin:24px 0; }
    .item { display:flex; gap:16px; padding:16px; border:1px solid #e4e4e7; border-radius:8px; margin-bottom:12px; }
    .item img { width:80px; height:80px; object-fit:cover; border-radius:6px; }
    .item h3 { margin:0 0 4px; font-size:15px; }
    .item p { margin:0; color:#71717a; font-size:13px; }
    .item ul { margin:8px 0 0; padding-left:16px; }
    .item li { font-size:13px; color:#52525b; }
    .cta { text-align:center; margin:24px 0; }
    .cta a { display:inline-block; padding:12px 32px; background:#f97316; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; }
    .info-box { margin:24px 0; padding:20px; background:#f4f4f5; border-radius:8px; }
    .info-box h3 { margin:0 0 8px; font-size:15px; }
    .info-box p { margin:0; color:#71717a; font-size:13px; }
    .footer { padding:16px 32px 24px; border-top:1px solid #e4e4e7; color:#71717a; font-size:12px; }
  </style>
</head>
<body>
  <div style="padding:24px;">
    <div class="wrapper">
      <div class="hero">
        ${data.hero_image ? `<img src="${data.hero_image}" alt="" />` : ""}
        <h1>${data.header || "Header"}</h1>
      </div>
      <div class="content">
        ${data.main_title ? `<h2>${data.main_title}</h2>` : ""}
        ${data.message ? `<div>${data.message}</div>` : '<p style="color:#a1a1aa;">Meldingsinnhold...</p>'}
        ${data.subTitle ? `<h3 style="margin:24px 0 12px;">${data.subTitle}</h3>` : ""}
        ${
          items.length > 0
            ? `<div class="items">${items
                .map(
                  (item) => `
            <div class="item">
              ${item.image ? `<img src="${item.image}" alt="" />` : ""}
              <div>
                <h3>${item.title}</h3>
                ${item.description ? `<p>${item.description}</p>` : ""}
                ${item.benefits?.length ? `<ul>${item.benefits.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
                ${item.link ? `<a href="${item.link}" style="font-size:12px;color:#f97316;">Les mer &rarr;</a>` : ""}
              </div>
            </div>`,
                )
                .join("")}</div>`
            : ""
        }
        ${data.message2 ? `<div style="margin-top:16px;">${data.message2}</div>` : ""}
        ${
          data.linkText && data.link
            ? `<div class="cta"><a href="${data.link}">${data.linkText}</a></div>`
            : ""
        }
        ${
          data.footer_title || data.footer_message
            ? `<div class="info-box">
                ${data.footer_title ? `<h3>${data.footer_title}</h3>` : ""}
                ${data.footer_message ? `<p>${data.footer_message}</p>` : ""}
              </div>`
            : ""
        }
      </div>
      <div class="footer">
        <p>Smartout AS &middot; Oslo, Norge</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function EmailPreview({ templateData }: EmailPreviewProps) {
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");

  const html = useMemo(() => buildPreviewHtml(templateData), [templateData]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-center gap-2 border-b px-4 py-2">
        <span className="text-muted-foreground text-sm font-medium">Forhåndsvisning</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={width === "desktop" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setWidth("desktop")}
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={width === "mobile" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setWidth("mobile")}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="bg-muted/30 flex flex-1 justify-center overflow-auto p-4">
        <iframe
          srcDoc={html}
          sandbox=""
          title="Email preview"
          className="border-border rounded-md border bg-white shadow-sm"
          style={{
            width: width === "desktop" ? 600 : 375,
            height: "100%",
            minHeight: 600,
          }}
        />
      </div>
    </div>
  );
}
