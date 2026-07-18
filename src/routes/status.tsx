import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";

interface HealthReport {
  status: "ok" | "degraded";
  version: string;
  uptimeMs: number;
  checks: { worker: string; database: string };
  latencyMs: { database?: number };
  timestamp: string;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

function StatusPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<HealthReport>({
    queryKey: ["status"],
    queryFn: async () => {
      const res = await fetch("/api/public/health", { cache: "no-store" });
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const overall = isError ? "degraded" : data?.status ?? "ok";
  const Icon = overall === "ok" ? CheckCircle2 : AlertTriangle;
  const color = overall === "ok" ? "text-emerald-600" : "text-amber-600";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BackButton />
      <div className="mt-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Icon className={`h-8 w-8 ${color}`} />
          )}
          <div>
            <h1 className="text-2xl font-bold">État du service</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Vérification en cours…"
                : overall === "ok"
                ? "Tous les systèmes sont opérationnels"
                : "Service dégradé"}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Row label="Application web" ok={!isError} />
          <Row label="Base de données" ok={data?.checks.database === "ok"} loading={isLoading} extra={data?.latencyMs.database ? `${data.latencyMs.database} ms` : undefined} />
        </div>

        {data && (
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
            <div>
              <div className="text-xs uppercase">Version</div>
              <div className="font-mono text-foreground">{data.version}</div>
            </div>
            <div>
              <div className="text-xs uppercase">Uptime</div>
              <div className="text-foreground">{formatUptime(data.uptimeMs)}</div>
            </div>
          </div>
        )}

        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="mt-6 w-full">
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>

        {data && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Dernière mise à jour : {new Date(data.timestamp).toLocaleTimeString("fr-FR")}
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, ok, loading, extra }: { label: string; ok?: boolean; loading?: boolean; extra?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2 text-sm">
        {extra && <span className="text-xs text-muted-foreground">{extra}</span>}
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : ok ? (
          <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Opérationnel</span>
        ) : (
          <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-4 w-4" /> Indisponible</span>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/status")({
  component: StatusPage,
  head: () => ({
    meta: [
      { title: "État du service — Gift-Plan" },
      { name: "description", content: "État de fonctionnement en temps réel de Gift-Plan." },
      { name: "robots", content: "noindex" },
    ],
  }),
});