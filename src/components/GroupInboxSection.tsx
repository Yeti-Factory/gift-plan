import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { GroupInbox } from "@/lib/group-messaging";
import { apiQuery } from "@/lib/self-hosted/api-client";
import { Button } from "@/components/ui/button";
export function GroupInboxSection() {
  const [inbox, setInbox] = useState<GroupInbox | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pages = useRef(1);
  const load = useCallback(async () => {
    const responses = await Promise.all(
      Array.from({ length: pages.current }, (_, index) =>
        apiQuery<GroupInbox>("group-messages", { offset: String(index * 50) }),
      ),
    );
    setInbox({
      groups: responses
        .flatMap((page) => page.groups)
        .filter((g, i, all) => all.findIndex((other) => other.id === g.id) === i),
      hasMore: responses.at(-1)!.hasMore,
    });
    setError("");
  }, []);
  useEffect(() => {
    let active = true,
      loading = false;
    const refresh = async () => {
      if (!active || loading || document.hidden) return;
      loading = true;
      try {
        await load();
      } catch {
        if (active) setError("Impossible de charger les groupes.");
      } finally {
        loading = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  return (
    <section aria-label="Conversations de groupe" className="space-y-2 border-b pb-3">
      <h2 className="font-semibold">Groupes et surprises</h2>
      <Button asChild variant="outline" className="w-full">
        <Link to="/circles">Écrire à un cercle</Link>
      </Button>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      {inbox?.groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Ouvrez un cercle, puis choisissez Écrire au cercle pour sélectionner les participants.
        </p>
      )}
      {inbox?.groups.map((group) => (
        <Link
          key={group.id}
          to="/group-messages/$groupId"
          params={{ groupId: group.id }}
          className="block rounded-xl border p-3 hover:bg-secondary"
        >
          <span className={`block break-words ${group.unread > 0 ? "font-bold" : "font-normal"}`}>
            {group.unread > 0 && (
              <span
                aria-hidden="true"
                className="mr-2 inline-block h-2 w-2 rounded-full bg-red-600"
              />
            )}
            {group.title}
            {group.unread > 0 && (
              <span
                className="ml-2 rounded-full bg-red-600 px-2 text-xs font-bold text-white"
                aria-label={`${group.unread} messages non lus`}
              >
                {group.unread}
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {group.participant_count} participants
          </span>
        </Link>
      ))}
      {inbox?.hasMore && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            pages.current++;
            try {
              await load();
            } catch {
              pages.current--;
              setError("Chargement impossible.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Groupes précédents
        </Button>
      )}
    </section>
  );
}
