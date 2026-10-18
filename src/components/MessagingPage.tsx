import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { GroupInboxSection } from "@/components/GroupInboxSection";
import { apiAction, apiQuery } from "@/lib/self-hosted/api-client";
import {
  messageError,
  type MessageInbox,
  type MessageThread,
  type DirectMessage,
} from "@/lib/messaging";

const date = (value: string) =>
  new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
export function MessagingPage({ userId, recipientId }: { userId: string; recipientId?: string }) {
  const [inbox, setInbox] = useState<MessageInbox | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [recipient, setRecipient] = useState<{
    id: string;
    display_name: string | null;
    username: string;
  } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<DirectMessage | null>(null);
  const [reason, setReason] = useState("");
  const generation = useRef(0);
  const selection = useRef<string | null>(null);
  const nonce = useRef(crypto.randomUUID());
  const pages = useRef(1);
  const messageList = useRef<HTMLOListElement>(null);
  const latestMessageId = thread?.messages.at(-1)?.id;
  useEffect(() => {
    if (messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight;
  }, [selected, latestMessageId]);
  const loadInbox = useCallback(async () => {
    // Refresh every page already opened, so older conversations remain reachable.
    const loaded = await Promise.all(
      Array.from({ length: pages.current }, (_, index) =>
        apiQuery<MessageInbox>("messages", { offset: String(index * 100) }),
      ),
    );
    const data = {
      ...loaded[0],
      hasMore: loaded.at(-1)!.hasMore,
      conversations: loaded
        .flatMap((page) => page.conversations)
        .filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i),
    };
    setInbox(data);
    return data;
  }, []);
  useEffect(() => {
    let active = true;
    setError("");
    setSelected(null);
    selection.current = null;
    setThread(null);
    setText("");
    setRecipient(null);
    nonce.current = crypto.randomUUID();
    void loadInbox()
      .then(async (data) => {
        if (!active || !recipientId || recipientId === userId) return;
        const existing = data.conversations.find((c) => c.other_id === recipientId);
        if (existing) {
          setSelected(existing.id);
          return;
        }
        // Resolve only the minimal directory card, never the private profile itself.
        const person = await apiQuery<{
          id: string;
          display_name: string | null;
          username: string;
          conversation_id: string | null;
        }>("message-recipient", { recipientId });
        if (active && person.conversation_id) setSelected(person.conversation_id);
        else if (active) setRecipient(person);
      })
      .catch((e) => {
        if (active) setError(messageError(e));
      });
    return () => {
      active = false;
    };
  }, [recipientId, userId, loadInbox]);
  useEffect(() => {
    selection.current = selected;
    setThread(null);
    setText("");
    setReport(null);
    setReason("");
    setError("");
    nonce.current = crypto.randomUUID();
    const version = ++generation.current;
    let active = true,
      loading = false;
    const refresh = async () => {
      if (loading || document.hidden) return;
      loading = true;
      try {
        if (selected) {
          const value = await apiQuery<MessageThread>("message-thread", {
            conversationId: selected,
          });
          if (!active || version !== generation.current) return;
          setThread((current) => {
            // Retain any older messages that the reader explicitly loaded.
            const oldest = value.messages[0]?.id;
            const older =
              current?.conversation.id === selected && oldest
                ? current.messages.filter((m) => BigInt(m.id) < BigInt(oldest))
                : [];
            return {
              ...value,
              messages: [...older, ...value.messages],
              hasMore: older.length ? current!.hasMore : value.hasMore,
            };
          });
          const last = value.messages.at(-1)?.id;
          if (last && document.hasFocus())
            await apiAction("message-read", { conversationId: selected, lastId: last });
        }
        if (active) await loadInbox();
      } catch (e) {
        if (active) setError(messageError(e));
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
  }, [selected, loadInbox]);

  async function act(action: string, input: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    const current = selected;
    try {
      await apiAction(action, { conversationId: current, ...input });
      if (current && selection.current === current) {
        const value = await apiQuery<MessageThread>("message-thread", { conversationId: current });
        if (selection.current === current) setThread(value);
      }
      await loadInbox();
      return true;
    } catch (e) {
      setError(messageError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError("");
    const current = selected;
    try {
      const result = await apiAction<{ conversationId: string }>(
        current ? "message-send" : "message-start",
        {
          conversationId: current,
          recipientId: recipient?.id,
          text: text.trim(),
          nonce: nonce.current,
        },
      );
      setText("");
      nonce.current = crypto.randomUUID();
      setRecipient(null);
      if (current === selection.current) {
        setSelected(result.conversationId);
        const value = await apiQuery<MessageThread>("message-thread", {
          conversationId: result.conversationId,
        });
        if (!current || current === selection.current) setThread(value);
      }
      await loadInbox();
    } catch (e) {
      setError(messageError(e));
    } finally {
      setBusy(false);
    }
  }
  async function older() {
    if (!thread || busy) return;
    const id = selected;
    setBusy(true);
    try {
      const value = await apiQuery<MessageThread>("message-thread", {
        conversationId: id!,
        before: thread.messages[0]?.id,
      });
      if (selection.current === id)
        setThread((current) =>
          current
            ? {
                ...current,
                hasMore: value.hasMore,
                messages: [...value.messages, ...current.messages].filter(
                  (m, i, all) => all.findIndex((x) => x.id === m.id) === i,
                ),
              }
            : value,
        );
    } catch (e) {
      setError(messageError(e));
    } finally {
      setBusy(false);
    }
  }
  const conversation = thread?.conversation;
  const incoming = conversation?.status === "pending" && conversation.initiated_by !== userId;
  const canSend = !!recipient || (conversation?.status === "accepted" && !conversation.blocked);
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="font-display text-3xl font-bold">Messages</h1>
      <p className="text-sm text-muted-foreground">
        Échangez à deux pour préparer une surprise. Hors cercle commun, la personne doit accepter
        votre premier message. Les messages ne donnent accès ni aux listes privées ni aux contacts.
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3">
          {error}{" "}
          <Button variant="link" onClick={() => window.location.reload()}>
            Réessayer
          </Button>
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <aside
          aria-label="Conversations"
          className={`${selected || recipient ? "hidden md:block" : ""} space-y-2 rounded-2xl border bg-card p-3`}
        >
          <GroupInboxSection />
          <Button asChild variant="outline" className="w-full">
            <Link to="/people">Nouvelle conversation</Link>
          </Button>
          {!inbox && <p role="status">Chargement…</p>}
          {inbox?.conversations.length === 0 && (
            <p className="p-3 text-sm">
              Aucun échange. Choisissez Écrire sur une fiche dans Communauté.
            </p>
          )}
          {inbox?.conversations.map((c) => (
            <button
              key={c.id}
              disabled={busy}
              aria-pressed={selected === c.id}
              onClick={() => {
                setRecipient(null);
                setSelected(c.id);
              }}
              className={`w-full rounded-xl p-3 text-left ${selected === c.id ? "bg-primary/10" : "hover:bg-secondary"}`}
            >
              <span className="block break-words font-semibold">
                {c.display_name || c.username}{" "}
                {c.unread > 0 && !c.blocked && c.status !== "declined" && (
                  <span
                    aria-label={`${c.unread} messages non lus`}
                    className="rounded-full bg-primary px-2 text-xs text-primary-foreground"
                  >
                    {c.unread}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {c.blocked
                  ? "Échange bloqué"
                  : c.status === "pending"
                    ? c.initiated_by === userId
                      ? "Demande envoyée"
                      : "Demande reçue"
                    : c.status === "declined"
                      ? "Demande refusée"
                      : "Conversation"}
              </span>
            </button>
          ))}
          {inbox?.hasMore && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                pages.current++;
                try {
                  await loadInbox();
                } catch (e) {
                  pages.current--;
                  setError(messageError(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Conversations précédentes
            </Button>
          )}
        </aside>
        <section
          aria-label="Échange privé"
          className={`${!selected && !recipient ? "hidden md:block" : ""} min-w-0 space-y-4 rounded-2xl border bg-card p-4`}
        >
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setSelected(null);
              setRecipient(null);
            }}
          >
            ← Toutes les conversations
          </Button>
          {!selected && !recipient && (
            <p>Choisissez une conversation ou retrouvez une personne dans Communauté.</p>
          )}
          {selected && !thread && <p role="status">Chargement de la conversation…</p>}
          {(conversation || recipient) && (
            <h2 className="text-xl font-bold break-words">
              {conversation?.display_name ||
                recipient?.display_name ||
                conversation?.username ||
                recipient?.username}
            </h2>
          )}
          {recipient && (
            <p className="text-sm">
              Envoyez votre premier message. Si vous n’avez pas de cercle commun, attendez que la
              personne accepte avant de continuer.
            </p>
          )}
          {thread?.hasMore && (
            <Button variant="outline" disabled={busy} onClick={older}>
              Messages précédents
            </Button>
          )}
          <ol
            ref={messageList}
            aria-label="Messages de la conversation"
            className="max-h-[50vh] space-y-3 overflow-y-auto"
          >
            {thread?.messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-xl p-3 ${m.sender_id === userId ? "ml-6 bg-primary/10" : "mr-6 bg-secondary"}`}
              >
                <p className="text-xs font-semibold">
                  {m.sender_id === userId
                    ? "Vous"
                    : conversation?.display_name || conversation?.username}
                </p>
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <time dateTime={m.created_at} className="text-xs text-muted-foreground">
                    {date(m.created_at)}
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
          {incoming && !conversation?.blocked && (
            <div className="space-y-2 rounded-xl bg-secondary p-3">
              <p>
                Acceptez-vous cette conversation ? Vous pouvez aussi la refuser ou bloquer cette
                personne.
              </p>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => void act("message-accept")}>
                  Accepter
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void act("message-decline")}
                >
                  Refuser
                </Button>
              </div>
            </div>
          )}
          {conversation?.status === "pending" && !incoming && (
            <p role="status">Demande envoyée. Vous pourrez poursuivre après acceptation.</p>
          )}
          {conversation?.status === "declined" && (
            <p>Cette demande a été refusée. Aucun nouveau message ne peut être envoyé.</p>
          )}
          {conversation?.blocked && (
            <p>
              Échange bloqué : aucun nouveau message ne peut être envoyé dans les deux sens.
              L’historique reste disponible.
            </p>
          )}
          {canSend && (
            <form onSubmit={send} className="space-y-2">
              <label htmlFor="direct-message" className="font-semibold">
                Votre message
              </label>
              <Textarea
                id="direct-message"
                value={text}
                maxLength={2000}
                disabled={busy}
                onChange={(e) => {
                  setText(e.target.value);
                  nonce.current = crypto.randomUUID();
                }}
                rows={3}
                placeholder="Préparons une surprise…"
              />
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">{text.length}/2 000</span>
                <Button type="submit" disabled={busy || !text.trim()}>
                  {busy ? "Envoi…" : "Envoyer"}
                </Button>
              </div>
            </form>
          )}
          {conversation && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void act(conversation.blocked_by_me ? "message-unblock" : "message-block", {
                  recipientId: conversation.other_id,
                })
              }
            >
              {conversation.blocked_by_me ? "Débloquer cette personne" : "Bloquer cette personne"}
            </Button>
          )}
          {report && (
            <form
              className="space-y-2 rounded-xl border p-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act("message-report", { messageId: report.id, reason })) {
                  setReport(null);
                  toast.success("Signalement transmis à l’administration.");
                }
              }}
            >
              <label htmlFor="report-reason">Pourquoi signalez-vous ce message ?</label>
              <Input
                id="report-reason"
                required
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Seul ce message et votre motif seront transmis à l’administration.
              </p>
              <div className="flex gap-2">
                <Button disabled={busy || !reason.trim()}>Transmettre</Button>
                <Button type="button" variant="outline" onClick={() => setReport(null)}>
                  Annuler
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
