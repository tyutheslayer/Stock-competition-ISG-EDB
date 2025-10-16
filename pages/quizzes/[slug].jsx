import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PageShell from "../../components/PageShell";
import QuizRunner from "../../components/QuizRunner";

export default function QuizDetail() {
  const router = useRouter();
  const { slug } = router.query;
  const [quiz, setQuiz] = useState(null);
  const [attempt, setAttempt] = useState(null);

  useEffect(()=> {
    if (!slug) return;
    (async ()=>{
      const q = await fetch(`/api/quizzes/${slug}`).then(r=>r.json()).catch(()=>null);
      setQuiz(q);
    })();
  }, [slug]);

  async function start() {
    const a = await fetch(`/api/quizzes/${quiz.id}/start`, { method:"POST" }).then(r=>r.json());
    setAttempt(a);
  }

  if (!quiz) return <PageShell><main className="p-6">Chargement…</main></PageShell>;

  if (!attempt) {
    return (
      <PageShell>
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="glass p-5">
            <h1 className="text-2xl font-bold">{quiz.title}</h1>
            <div className="opacity-80 mt-1">{quiz.description || "—"}</div>
            <div className="text-sm opacity-60 mt-2">
              {quiz.topic ? <>Thème : {quiz.topic} · </> : null}
              Difficulté : {quiz.difficulty?.toLowerCase()}
              {quiz.timeLimitSec ? <> · {Math.round(quiz.timeLimitSec/60)} min</> : null}
            </div>
            <div className="mt-4">
              <button className="btn btn-primary" onClick={start}>Démarrer</button>
            </div>
          </div>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <QuizRunner quiz={quiz} attempt={attempt} />
    </PageShell>
  );
}