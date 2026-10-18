import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { apiAction, apiQuery } from "@/lib/self-hosted/api-client";
import { messageError } from "@/lib/messaging";
import type { GroupThread, GroupMessage } from "@/lib/group-messaging";
export function GroupMessagingPage({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}) {
  const navigate = useNavigate();
  const [thread, setThread] = useState<GroupThread | null>(null),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false),
    [leave, setLeave] = useState(false),
    [report, setReport] = useState<GroupMessage | null>(null),
    [reason, setReason] = useState("");
  const current = useRef(conversationId),
    nonce = useRef(crypto.randomUUID()),
    list = useRef<HTMLOListElement>(null);
  const latest = thread?.messages.at(-1)?.id;
  const load = useCallback(
    async (before?: string) =>
      apiQuery<GroupThread>("group-message-thread", { conversationId, before }),
    [conversationId],
  );
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [latest]);
  useEffect(() => {
    current.current = conversationId;
    let active = true,
      loading = false;
    setThread(null);
    setUnavailable(false);
    setError("");
    setText("");
    setLeave(false);
    setReport(null);
    nonce.current = crypto.randomUUID();
    const refresh = async () => {
      if (!active || loading || document.hidden) return;
      loading = true;
      try {
        const value = await load();
        if (!active) return;
        setThread((old) => {
          // After a long absence, restart at the latest page if there is a gap.
          // Keeping disconnected windows would make the missing middle unreachable.
          if (
            !old ||
            old.conversation.id !== conversationId ||
            !old.messages.some((message) => value.messages.some((fresh) => fresh.id === message.id))
          )
            return value;
          const first = value.messages[0]?.id;
          const older =
            old?.conversation.id === conversationId && first
              ? old.messages.filter((m) => BigInt(m.id) < BigInt(first))
              : [];
          return {
            ...value,
            messages: [...older, ...value.messages],
            hasMore: older.length ? old!.hasMore : value.hasMore,
          };
        });
        const last = value.messages.at(-1)?.id;
        if (last && document.hasFocus())
          await apiAction("group-message-read", { conversationId, lastId: last });
      } catch (e) {
        if (active) {
          setError(messageError(e));
          if ((e as { code?: string }).code === "NOT_FOUND") {
            setThread(null);
            setUnavailable(true);
          }
        }
      } finally {
        loading = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [conversationId, load]);
  async function act(action: string, input: Record<string, unknown> = {}) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await apiAction(action, { conversationId, ...input });
      if (action === "group-message-leave") {
        setThread(null);
        await navigate({ to: "/messages", search: { recipient: undefined } });
        return true;
      }
      const value = await load();
      if (current.current === conversationId) setThread(value);
      return true;
    } catch (e) {
      setError(messageError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function older() {
    if (!thread || busy) return;
    setBusy(true);
    try {
      const value = await load(thread.messages[0]?.id);
      if (current.current === conversationId)
        setThread((old) =>
          old
            ? {
                ...old,
                messages: [...value.messages, ...old.messages].filter(
                  (m, i, all) => all.findIndex((other) => other.id === m.id) === i,
                ),
                hasMore: value.hasMore,
              }
            : value,
        );
    } catch (e) {
      setError(messageError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <Button asChild variant="outline">
        <Link to="/messages" search={{ recipient: undefined }}>
          ← Mes conversations
        </Link>
      </Button>
      <h1 className="break-words font-display text-3xl font-bold">
        {thread?.conversation.title || "Conversation de groupe"}
      </h1>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3">
          {error}
        </p>
      )}
      {!thread && !unavailable && !error && <p role="status">Chargement…</p>}
      {thread && (
        <>
          <section className="rounded-xl border bg-card p-4" aria-label="Participants">
            <h2 className="font-semibold">Participants ({thread.participants.length})</h2>
            <p className="text-sm text-muted-foreground">
              Seules les personnes ci-dessous ont accès à cet échange. Les autres membres du cercle
              ne le voient pas.
            </p>
            <ul className="mt-2 space-y-2">
              {thread.participants.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="break-words">
                    {p.display_name || p.username}
                    {p.id === userId ? " (vous)" : ""}
                  </span>
                  {p.id !== userId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void act(p.blocked_by_me ? "message-unblock" : "message-block", {
                          recipientId: p.id,
                        })
                      }
                    >
                      {p.blocked_by_me ? "Débloquer" : "Bloquer"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          {thread.hasMore && (
            <Button variant="outline" disabled={busy} onClick={() => void older()}>
              Messages précédents
            </Button>
          )}
          <ol
            ref={list}
            aria-label="Messages du groupe"
            className="max-h-[50vh] space-y-3 overflow-y-auto"
          >
            {thread.messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-xl p-3 ${m.sender_id === userId ? "ml-5 bg-primary/10" : "mr-5 bg-secondary"}`}
              >
                <p className="text-sm font-semibold">
                  {m.sender_id === userId ? "Vous" : m.sender_name}
                </p>
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.body}</p>
                <div className="mt-2 flex items-center justify-between">
                  <time className="text-xs text-muted-foreground" dateTime={m.created_at}>
                    {new Date(m.created_at).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                  {m.sender_id !== userId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setReport(m);
                        setReason("");
                      }}
                    >
                      Signaler
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {thread.messages.length === 0 && (
            <p>Aucun message pour le moment. Vérifiez les participants avant d’écrire.</p>
          )}
          {thread.canSend ? (
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!text.trim() || busy) return;
                const draft = text;
                if (await act("group-message-send", { text: text.trim(), nonce: nonce.current })) {
                  setText((currentText) => (currentText === draft ? "" : currentText));
                  nonce.current = crypto.randomUUID();
                }
              }}
            >
              <label htmlFor="group-message" className="font-semibold">
                Votre message au groupe
              </label>
              <Textarea
                id="group-message"
                rows={3}
                value={text}
                maxLength={2000}
                disabled={busy}
                onChange={(e) => {
                  setText(e.target.value);
                  nonce.current = crypto.randomUUID();
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{text.length}/2 000</span>
                <Button disabled={busy || !text.trim()}>
                  {busy ? "Envoi…" : "Envoyer au groupe"}
                </Button>
              </div>
            </form>
          ) : (
            <p role="status">
              Vous ne pouvez pas envoyer : un blocage existe entre vous et un participant, ou vous
              êtes seul dans ce groupe. Vous pouvez quitter cet échange.
            </p>
          )}
          {report && (
            <form
              className="space-y-2 rounded-xl border p-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act("group-message-report", { messageId: report.id, reason })) {
                  setReport(null);
                  toast.success("Signalement transmis.");
                }
              }}
            >
              <label htmlFor="group-report">Motif du signalement</label>
              <Input
                id="group-report"
                required
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Seul ce message, son auteur, votre identifiant et le motif sont transmis à
                l’administration.
              </p>
              <div className="flex gap-2">
                <Button disabled={busy || !reason.trim()}>Transmettre</Button>
                <Button type="button" variant="outline" onClick={() => setReport(null)}>
                  Annuler
                </Button>
              </div>
            </form>
          )}
          {leave ? (
            <div className="space-y-2 rounded-xl border p-3">
              <p>
                Quitter cette conversation ? Vous perdrez l’accès à son historique et ne recevrez
                plus ses messages.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void act("group-message-leave")}
                >
                  Confirmer mon départ
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setLeave(false)}>
                  Rester
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" disabled={busy} onClick={() => setLeave(true)}>
              Quitter la conversation
            </Button>
          )}
        </>
      )}
    </main>
  );
}
