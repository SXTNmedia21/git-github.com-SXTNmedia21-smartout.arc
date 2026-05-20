"use client";

import { DocusealForm } from "@docuseal/react";

type Props = {
  docusealEmbedUrl: string;
  recipientEmail: string;
  contractTitle: string;
  signingToken: string;
};

export function SigningForm({
  docusealEmbedUrl,
  recipientEmail,
  contractTitle,
  signingToken,
}: Props) {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-6 text-center">
        {/* eslint-disable-next-line -- suppress no-img-element: static logo on external signing page; next/image optimization not needed for a simple local asset */}
        <img src="/logo.png" alt="Smartout" className="mx-auto h-8" />
        <h1 className="mt-4 text-xl font-semibold">{contractTitle}</h1>
      </div>
      <DocusealForm
        src={docusealEmbedUrl}
        email={recipientEmail}
        logo="https://smartout.ai/logo.png"
        backgroundColor="#f9fafb"
        withDecline={true}
        withDownloadButton={true}
        language="no"
        onComplete={() => {
          window.location.href = `/sign/success?token=${signingToken}`;
        }}
        onDecline={() => {
          window.location.href = `/sign/declined?token=${signingToken}`;
        }}
      />
    </div>
  );
}
