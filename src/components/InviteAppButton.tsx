import { buildAppInvitation } from "@/lib/installation-guide";
import { useState } from "react";
import { Copy, Send, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function InviteAppButton() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [canShare, setCanShare] = useState(false);

  function prepare(open: boolean) {
    if (!open) return;
    const url = `${window.location.origin}/invite`;
    setMessage(buildAppInvitation(url));
    setCanShare(typeof navigator.share === "function");
  }

  async function copy() {
    setBusy(true);
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Invitation copiée. Tu peux l’envoyer à ton proche.");
    } catch {
      toast.error("Copie indisponible. Sélectionne le message ci-dessous et copie-le.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    try {
      await navigator.share({ title: "Rejoins-moi sur Gift-Plan", text: message });
    } catch (error) {
      const cancelled =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError";
      if (!cancelled) {
        toast.error("Partage indisponible. Utilise « Copier l’invitation ».");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog onOpenChange={prepare}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserPlus className="h-4 w-4" /> Inviter un proche
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inviter un proche sur Gift-Plan</DialogTitle>
          <DialogDescription>
            Envoie cette invitation par message ou par email. Ton proche pourra installer l’appli et
            créer son compte, ou se connecter à son compte existant. Le mode d’emploi iPhone et
            Android est inclus dans le message.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="app-invitation-message">Message d’invitation</Label>
          <Textarea
            id="app-invitation-message"
            value={message}
            readOnly
            rows={10}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Pour rejoindre ton cercle ensuite, transmets-lui aussi son code d’invitation depuis la
          page du cercle.
        </p>
        <div className="flex flex-wrap gap-2">
          {canShare && (
            <Button onClick={share} disabled={busy}>
              <Send className="h-4 w-4" /> Partager l’invitation
            </Button>
          )}
          <Button onClick={copy} variant={canShare ? "outline" : "default"} disabled={busy}>
            <Copy className="h-4 w-4" /> Copier l’invitation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
