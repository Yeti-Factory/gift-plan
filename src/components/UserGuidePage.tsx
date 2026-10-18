import { useEffect, useRef, useState } from "react";
import { BookOpen, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { USER_GUIDE, guideSearchText, type GuideChapter } from "@/lib/user-guide";
import { answerGuideQuestion } from "@/lib/guide-assistant";
type Entry = {
  id: number;
  role: "user" | "assistant";
  text: string;
  chapter?: GuideChapter;
  choices?: GuideChapter[];
  step?: number;
  all?: boolean;
  notes?: boolean;
};
const initial: Entry = {
  id: 0,
  role: "assistant",
  text: "Bonjour ! Je vous guide dans Gift-Plan. Posez une question ou choisissez un sujet : nous avancerons étape par étape.",
  choices: USER_GUIDE.filter((chapter) =>
    ["installation-iphone", "listes", "messages-prives", "groupes-surprises"].includes(chapter.id),
  ),
};
export function UserGuidePage() {
  const [entries, setEntries] = useState<Entry[]>([initial]),
    [question, setQuestion] = useState(""),
    [topics, setTopics] = useState(false);
  const counter = useRef(1),
    list = useRef<HTMLOListElement>(null),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [entries]);
  function ask(text: string, chapter?: GuideChapter) {
    const value = text.trim();
    if (!value) return;
    const context = entries.at(-1);
    const followUp = guideSearchText(value).replace(/[’']/g, " ");
    let answer: Omit<Entry, "id" | "role"> = chapter
      ? { text: "Voici les étapes à suivre.", chapter }
      : answerGuideQuestion(value);
    if (!chapter && context?.chapter) {
      if (
        /^(suivant|suivante|etape suivante|ensuite|et ensuite|continue|continuer|c est fait)[ !?.]*$/.test(
          followUp,
        )
      ) {
        const next = Math.min((context.step ?? 0) + 1, context.chapter.steps.length - 1);
        answer = {
          text:
            next === (context.step ?? 0)
              ? "Vous êtes à la dernière étape. Voici aussi les points à retenir."
              : "Passons à la suite.",
          chapter: context.chapter,
          step: next,
          notes: next === (context.step ?? 0),
        };
      } else if (/^(precedent|precedente|etape precedente)[ !?.]*$/.test(followUp))
        answer = {
          text: "Reprenons l’étape précédente.",
          chapter: context.chapter,
          step: Math.max(0, (context.step ?? 0) - 1),
        };
      else if (
        /^(tout afficher|tout voir|toutes les etapes|plus de details|explication complete)[ !?.]*$/.test(
          followUp,
        )
      )
        answer = {
          text: "Voici l’explication complète.",
          chapter: context.chapter,
          all: true,
          notes: true,
        };
    }
    const userEntry: Entry = { id: counter.current++, role: "user", text: value };
    const assistantEntry: Entry = { id: counter.current++, role: "assistant", step: 0, ...answer };
    setEntries((old) => [...old, userEntry, assistantEntry]);
    setQuestion("");
    setTopics(false);
  }
  function update(id: number, change: Partial<Entry>) {
    setEntries((old) => old.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)));
  }
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold sm:text-3xl">
          <BookOpen className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
          Mode d’emploi interactif
        </h1>
        <p className="text-sm text-muted-foreground">
          Posez votre question, choisissez une rubrique et suivez les explications à votre rythme.
          Accessible aussi sans compte.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" aria-expanded={topics} onClick={() => setTopics(!topics)}>
          {topics ? "Masquer les sujets" : "Tous les sujets"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setEntries([initial]);
            setQuestion("");
            setTopics(false);
            input.current?.focus();
          }}
        >
          Recommencer
        </Button>
      </div>
      {topics && (
        <nav
          aria-label="Sujets du mode d’emploi"
          className="grid max-h-[45vh] gap-2 overflow-y-auto rounded-2xl border bg-card p-3 sm:grid-cols-2"
        >
          {USER_GUIDE.map((chapter) => (
            <Button
              key={chapter.id}
              variant="outline"
              className="h-auto min-h-11 justify-start whitespace-normal text-left"
              onClick={() => ask(chapter.title.replace(/^\d+\. /, ""), chapter)}
            >
              {chapter.title}
            </Button>
          ))}
        </nav>
      )}
      <ol
        ref={list}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Conversation avec le mode d’emploi"
        className="max-h-[65vh] min-h-64 space-y-4 overflow-y-auto rounded-2xl border bg-secondary/20 p-3 sm:p-5"
      >
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`space-y-3 rounded-2xl p-4 ${entry.role === "user" ? "ml-6 bg-primary/10" : "mr-3 border bg-card sm:mr-10"}`}
          >
            <p className="text-xs font-semibold text-muted-foreground">
              {entry.role === "user" ? "Vous" : "Guide Gift-Plan"}
            </p>
            <p className="whitespace-pre-wrap break-words leading-relaxed">{entry.text}</p>
            {entry.chapter && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold">{entry.chapter.title.replace(/^\d+\. /, "")}</h2>
                <p className="leading-relaxed">{entry.chapter.intro}</p>
                {entry.all ? (
                  <ol className="list-decimal space-y-3 pl-5 leading-relaxed">
                    {entry.chapter.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                ) : (
                  <div className="space-y-2 rounded-xl bg-secondary/60 p-3">
                    <p className="text-xs font-semibold">
                      Étape {(entry.step ?? 0) + 1} sur {entry.chapter.steps.length}
                    </p>
                    <p className="leading-relaxed">{entry.chapter.steps[entry.step ?? 0]}</p>
                  </div>
                )}
                {!entry.all && (
                  <div className="flex flex-wrap gap-2">
                    {(entry.step ?? 0) > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => update(entry.id, { step: (entry.step ?? 0) - 1 })}
                      >
                        Étape précédente
                      </Button>
                    )}
                    {(entry.step ?? 0) < entry.chapter.steps.length - 1 ? (
                      <Button
                        size="sm"
                        onClick={() => update(entry.id, { step: (entry.step ?? 0) + 1 })}
                      >
                        Étape suivante
                      </Button>
                    ) : (
                      <p className="text-sm font-medium">
                        Vous avez terminé les étapes. Une autre question ?
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => update(entry.id, { all: true, notes: true })}
                    >
                      Voir toute l’explication
                    </Button>
                  </div>
                )}
                {entry.chapter.notes && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-expanded={!!entry.notes}
                      onClick={() => update(entry.id, { notes: !entry.notes })}
                    >
                      {entry.notes
                        ? "Masquer les points importants"
                        : "À retenir / confidentialité"}
                    </Button>
                    {entry.notes && (
                      <ul className="list-disc space-y-2 rounded-xl bg-secondary/60 p-4 pl-8 text-sm leading-relaxed">
                        {entry.chapter.notes.map((note, index) => (
                          <li key={index}>{note}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}
            {entry.choices && (
              <div className="flex flex-wrap gap-2">
                {entry.choices.map((chapter) => (
                  <Button
                    key={chapter.id}
                    variant="outline"
                    className="h-auto min-h-11 whitespace-normal text-left"
                    onClick={() => ask(chapter.title.replace(/^\d+\. /, ""), chapter)}
                  >
                    {chapter.title.replace(/^\d+\. /, "")}
                  </Button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <form
        className="sticky bottom-0 space-y-2 rounded-2xl border bg-background/95 p-3 shadow-sm backdrop-blur"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="guide-question" className="text-sm font-semibold">
          Votre question sur Gift-Plan
        </label>
        <div className="flex items-center gap-2">
          <Input
            ref={input}
            id="guide-question"
            autoComplete="off"
            maxLength={500}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Comment préparer une surprise sans prévenir la personne ?"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0"
            disabled={!question.trim()}
            aria-label="Poser ma question"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
    </main>
  );
}
