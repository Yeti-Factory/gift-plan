import { useCallback, useEffect, useState } from "react";
import { apiAction, apiQuery } from "@/lib/self-hosted/api-client";
import { Button } from "@/components/ui/button";
type Report = {
  id: string;
  reason: string;
  body: string;
  sender: string;
  reporter: string;
  created_at: string;
};
export function MessageReports() {
  const [reports, setReports] = useState<Report[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setReports(await apiQuery<Report[]>("message-reports"));
      setError("");
    } catch {
      setError("Impossible de charger les signalements.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function resolve(id: string) {
    setBusy(true);
    try {
      await apiAction("message-resolve-report", { reportId: id });
      await load();
    } catch {
      setError("Impossible de traiter ce signalement.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-bold">Messages signalés</h2>
      <p className="text-sm text-muted-foreground">
        L’administration voit uniquement les messages signalés, pas les conversations privées. Les
        participants peuvent bloquer un interlocuteur depuis leur conversation.
      </p>
      {error && <p role="alert">{error}</p>}
      <Button variant="outline" onClick={() => void load()}>
        Actualiser
      </Button>
      {!error && reports.length === 0 && <p>Aucun signalement en attente.</p>}
      {reports.map((r) => (
        <article key={r.id} className="space-y-2 rounded-xl border p-3">
          <p>
            @{r.reporter} signale un message de @{r.sender}
          </p>
          <blockquote className="whitespace-pre-wrap break-words bg-secondary p-3">
            {r.body}
          </blockquote>
          <p className="break-words">Motif : {r.reason}</p>
          <time className="text-xs">{new Date(r.created_at).toLocaleString("fr-FR")}</time>
          <div>
            <Button disabled={busy} onClick={() => void resolve(r.id)}>
              Marquer comme traité
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
