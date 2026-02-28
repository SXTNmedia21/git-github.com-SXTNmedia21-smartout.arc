"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bell, Clock, Send, XCircle, Shield } from "lucide-react";
import { toast } from "sonner";

type Props = {
  contractId: string;
  status: string;
};

export function ContractActionButtons({ contractId, status }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reminding, setReminding] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch(`/api/platform-admin/contracts/${contractId}/send`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kunne ikke sende kontrakt");
      toast.success("Kontrakt sendt");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setSending(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Er du sikker pa at du vil avbryte denne kontrakten?")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/platform-admin/contracts/${contractId}/cancel`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kunne ikke avbryte kontrakt");
      toast.success("Kontrakt avbrutt");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setCancelling(false);
    }
  }

  async function handleRemind() {
    setReminding(true);
    try {
      const res = await fetch(`/api/platform-admin/contracts/${contractId}/remind`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kunne ikke sende painnelse");
      toast.success("Painnelse registrert");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setReminding(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && (
        <Button variant="outline" size="sm" onClick={handleSend} disabled={sending}>
          <Send className="mr-2 h-4 w-4" />
          {sending ? "Sender..." : "Send"}
        </Button>
      )}

      {(status === "sent" || status === "viewed") && (
        <>
          <Button variant="outline" size="sm" onClick={handleRemind} disabled={reminding}>
            <Bell className="mr-2 h-4 w-4" />
            {reminding ? "Sender..." : "Send painnelse"}
          </Button>
          <Button variant="outline" size="sm" disabled title="Ikke implementert enna">
            <Clock className="mr-2 h-4 w-4" />
            Forleng frist
          </Button>
          <Button variant="outline" size="sm" onClick={handleSend} disabled={sending}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sender..." : "Send pa nytt"}
          </Button>
        </>
      )}

      {status !== "cancelled" && status !== "signed" && status !== "active" && (
        <Button
          variant="outline"
          size="sm"
          className="text-red-400 hover:text-red-300"
          onClick={handleCancel}
          disabled={cancelling}
        >
          <XCircle className="mr-2 h-4 w-4" />
          {cancelling ? "Avbryter..." : "Avbryt"}
        </Button>
      )}

      <Button variant="outline" size="sm" disabled title="Ikke implementert enna">
        <Shield className="mr-2 h-4 w-4" />
        Overstyr arbeidsstedstilgang
      </Button>
    </div>
  );
}
