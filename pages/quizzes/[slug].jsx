// pages/quizzes/[slug].jsx
import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useCallback } from "react";
import PageShell from "../../components/PageShell";
import { useSession } from "next-auth/react";

/* Petit utilitaire pour un message propre */
function justText(s) {
  if (!s) return "";
  return String(s).replace(/^Error:\s*/i, "");
}

/* Item de choix robuste (id/htmlFor + value) */
function ChoiceItem({ q, c, selected, onToggle }) {
  const type = q.kind === "MULTI" ? "checkbox" : "radio";
  const checked = selected.has(c.id);
  const inputId = `q_${q.id}__c_${c.id}`;

  return (
    <label
      htmlFor={inputId}
      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 cursor-pointer"
    >
      <input
        id={inputId}
        value={c.id}
        type={type}
        name={`q_${q.id}`}               // unique par question
        className={type === "radio" ? "radio" : "checkbox"}
        checked={checked}
        onChange={() => onToggle(q, c)}
      />
      <span className="flex-1">{c.text}</span>
    </label>
  );
}

export default function QuizPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { data: session, status } = useSession();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);

  const [attemptId, setAttemptId] = useState(null);
  const [msg, setMsg] = useState("");

  // selections: Map<questionId, Set<choiceId>>
  const [sel, setSel] = useState(() => new Map());

  // ─────────────────────────────────────────────
  // Charger le quiz par SLUG
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const r = await fetch(`/api/quizzes/${encodeURIComponent(slug)}`, {
          method: "GET",
          credentials: "include", // cookies NextAuth
        });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) {
          if (r.status === 403) {
            throw new Error("Ce quiz est réservé aux membres EDB Plus.");
          }
          throw new Error(j?.error || "LOAD_FAILED");
        }
        setQuiz(j);
        // init selections
        const init = new Map();
        (j.questions || []).forEach((q) => init.set(q.id, new Set()));
        setSel(init);
      } catch (e) {
        setMsg(justText(e.message || e) || "Erreur de chargement");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  // ─────────────────────────────────────────────
  // Démarrer une tentative (NECESSITE session)
  const startAttempt = useCallback(async () => {
    setMsg("");
    try {
      const r = await fetch(`/api/quizzes/${encodeURIComponent(slug)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: "{}",
      });
      const j = await r.json();
      if (!r.ok) {
        if (r.status === 401) throw new Error("Connecte-toi pour commencer le quiz.");
        if (r.status === 404) throw new Error("Quiz introuvable.");
        throw new Error(j?.error || "Unauthorized");
      }
      setAttemptId(j.id);
      setMsg("Tentative démarrée ✅");
    } catch (e) {
      setMsg(justText(e.message || e));
    }
  }, [slug]);

  // ─────────────────────────────────────────────
  // Sélection des réponses
  function toggleChoice(q, c) {
    setSel((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(q.id) || []);
      if (q.kind === "MULTI") {
        if (set.has(c.id)) set.delete(c.id);
        else set.add(c.id);
      } else {
        // SINGLE
        set.clear();
        set.add(c.id);
      }
      next.set(q.id, set);
      return next;
    });
  }

  // ─────────────────────────────────────────────
  // Soumettre
  async function submit() {
    if (!attemptId) {
      setMsg("Commence le quiz d’abord.");
      return;
    }
    setMsg("");
    try {
      const answers = (quiz?.questions || []).map((q) => ({
        questionId: q.id,
        choiceIds: [...(sel.get(q.id) || new Set())],
      }));
      const r = await fetch(`/api/quizzes/${encodeURIComponent(slug)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ attemptId, answers }),
      });
      const j = await r.json();
      if (!r.ok) {
        if (r.status === 401) throw new Error("Session expirée : reconnecte-toi.");
        if (r.status === 405) throw new Error("Méthode non autorisée (POST attendu).");
        throw new Error(j?.error || "SUBMIT_FAILED");
      }
      setMsg(`Score : ${j.scorePct}%  (${j.good}/${j.total}) ✅`);
    } catch (e) {
      setMsg(justText(e.message || e));
    }
  }

  const header = useMemo(() => {
    if (!quiz) return "";
    const vis = quiz.visibility === "PLUS" ? "PLUS" : "PUBLIC";
    return `${vis} • ${quiz.difficulty || "EASY"}`;
  }, [quiz]);

  const needLogin = status !== "authenticated";

  return (
    <PageShell>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div>Chargement…</div>
        ) : !quiz ? (
          <div className="alert alert-error">Quiz introuvable.</div>
        ) : (
          <>
            <div className="glass p-5 rounded-3xl mb-4">
              <div className="text-sm opacity-70 mb-1">{header}</div>
              <h1 className="text-2xl font-bold">{quiz.title}</h1>

              <div className="mt-3 flex gap-3">
                <button
                  className={`btn btn-primary ${needLogin ? "btn-disabled" : ""}`}
                  onClick={startAttempt}
                  disabled={!!attemptId || needLogin}
                  title={needLogin ? "Connecte-toi pour commencer" : ""}
                >
                  {attemptId ? "En cours…" : "Commencer"}
                </button>
                <button
                  className="btn btn-outline"
                  onClick={submit}
                  disabled={!attemptId}
                  title={!attemptId ? "Commence d’abord le quiz" : ""}
                >
                  Valider mes réponses
                </button>
              </div>

              {needLogin && (
                <div className="mt-2 text-sm opacity-80">
                  Tu dois être connecté pour démarrer le quiz.
                </div>
              )}
            </div>

            {(quiz.questions || []).map((q, idx) => (
              <div key={q.id} className="glass p-5 rounded-2xl mb-4">
                <div className="font-semibold mb-2">Question {idx + 1}</div>
                <div className="mb-3">{q.text}</div>
                <div className="space-y-2">
                  {q.choices.map((c) => (
                    <ChoiceItem
                      key={c.id}
                      q={q}
                      c={c}
                      selected={sel.get(q.id) || new Set()}
                      onToggle={toggleChoice}
                    />
                  ))}
                </div>
              </div>
            ))}

            {msg && <div className={`alert mt-4 ${/✅|Score/.test(msg) ? "alert-success" : "alert-info"}`}>{msg}</div>}
          </>
        )}
      </main>
    </PageShell>
  );
}