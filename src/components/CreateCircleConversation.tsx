import { useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiAction } from "@/lib/self-hosted/api-client";
import { messageError } from "@/lib/messaging";
type Member = {
  user_id: string;
  profile: { display_name: string | null; username: string } | null;
};
export function CreateCircleConversation({
  circleId,
  members,
  userId,
}: {
  circleId: string;
  members: Member[];
  userId: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [confirm, setConfirm] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const nonce = useRef(crypto.randomUUID());
  const chosen = members.filter((m) => m.user_id === userId || selected.includes(m.user_id));
  const excluded = members.filter((m) => m.user_id !== userId && !selected.includes(m.user_id));
  const name = (m: Member) => m.profile?.display_name || m.profile?.username || "Membre";
  async function create() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiAction<{ conversationId: string }>("group-message-create", {
        circleId,
        title: title.trim(),
        participantIds: chosen.map((m) => m.user_id),
        nonce: nonce.current,
      });
      await navigate({
        to: "/group-messages/$groupId",
        params: { groupId: result.conversationId },
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(
        code === "NOT_MEMBER"
          ? "La composition du cercle a changé ou un compte n’est pas confirmé. Actualisez le cercle et vérifiez les participants."
          : messageError(e),
      );
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <Button
        onClick={() => {
          setOpen(true);
          setConfirm(false);
          setSelected(members.filter((m) => m.user_id !== userId).map((m) => m.user_id));
          nonce.current = crypto.randomUUID();
        }}
      >
        <MessageCircle className="h-4 w-4" />
        Écrire au cercle
      </Button>
    );
  return (
    <section
      aria-label="Créer une conversation de cercle"
      className="space-y-4 rounded-2xl border bg-card p-4"
    >
      <h2 className="text-xl font-bold">
        {confirm ? "Vérifier les participants" : "Préparer une conversation"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Décochez la personne à qui vous préparez une surprise. Les personnes exclues ne verront ni
        cette conversation ni ses messages et ne recevront aucune notification.
      </p>
      {error && <p role="alert">{error}</p>}
      {!confirm ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setConfirm(true);
            setError("");
          }}
        >
          <label className="block space-y-2" htmlFor="group-title">
            <span>Nom de la conversation</span>
            <Input
              id="group-title"
              required
              maxLength={80}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                nonce.current = crypto.randomUUID();
              }}
              placeholder="Une surprise à préparer…"
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-semibold">Qui participe ? ({chosen.length}/50)</legend>
            {members.map((m) => (
              <label
                key={m.user_id}
                className="flex min-h-11 items-center gap-3 rounded-lg border p-2"
              >
                <input
                  type="checkbox"
                  checked={m.user_id === userId || selected.includes(m.user_id)}
                  disabled={m.user_id === userId}
                  onChange={(e) => {
                    setSelected((current) =>
                      e.target.checked
                        ? [...current, m.user_id]
                        : current.filter((id) => id !== m.user_id),
                    );
                    nonce.current = crypto.randomUUID();
                  }}
                />
                <span>
                  {name(m)}
                  {m.user_id === userId ? " (vous)" : ""}
                </span>
              </label>
            ))}
          </fieldset>
          <p className="text-sm">
            Choisissez entre 2 et 50 personnes, vous compris. Les participants ne pourront pas être
            ajoutés ensuite : pour changer la sélection, créez un autre échange.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!title.trim() || chosen.length < 2 || chosen.length > 50}>
              Vérifier avant de créer
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="font-semibold break-words">{title}</p>
          <div>
            <h3 className="font-semibold">Participants ({chosen.length})</h3>
            <ul className="list-disc pl-5">
              {chosen.map((m) => (
                <li key={m.user_id}>
                  {name(m)}
                  {m.user_id === userId ? " (vous)" : ""}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">Personnes exclues</h3>
            {excluded.length ? (
              <ul className="list-disc pl-5">
                {excluded.map((m) => (
                  <li key={m.user_id}>{name(m)}</li>
                ))}
              </ul>
            ) : (
              <p>Aucune : tout le cercle actuel participe.</p>
            )}
          </div>
          <p className="text-sm">
            Seuls les participants ci-dessus verront l’échange. Aucun message n’est envoyé à cette
            étape.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void create()}>
              {busy ? "Création…" : "Créer avec ces participants"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>
              Modifier la sélection
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
