"use client";

import { DocusealForm } from "@docuseal/react";

type Props = {
  signingUrl: string;
  recipientEmail: string;
  contractTitle: string;
};

export function SigningForm({ signingUrl, recipientEmail, contractTitle }: Props) {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <div className="mb-6 text-center">
        <img src="/logo.png" alt="Smartout" className="mx-auto h-8" />
        <h1 className="mt-4 text-xl font-semibold">{contractTitle}</h1>
      </div>
      <DocusealForm
        src={signingUrl}
        email={recipientEmail}
        logo="https://smartout.io/logo.png"
        backgroundColor="#f9fafb"
        withDecline={true}
        withDownloadButton={true}
        language="no"
        onComplete={() => {
          window.location.href = "/sign/success";
        }}
        onDecline={() => {
          window.location.href = "/sign/declined";
        }}
      />
    </div>
  );
}
