import { useRouter } from "next/router";

const CONTENT = {
  "analyse-technique": {
    title: "Analyse technique — bases",
    body: `
### Sommaire
- Tendances
- Supports & résistances
- Moyennes mobiles (MME)

**Note:** version démo.
    `,
  },
  "gestion-risque": {
    title: "Gestion du risque",
    body: `Règles de base: 1–2% par trade, stop loss défini, etc. (démo)`,
  },
  "options-basiques": {
    title: "Options (basics)",
    body: `Calls, puts, valeur intrinsèque/temps, grecques (démo).`,
  },
};

export default function ResourceView() {
  const { query } = useRouter();
  const doc = CONTENT[query.slug] || { title: "Document", body: "Contenu non trouvé (démo)." };

  return (
    <main className="min-h-screen bg-grid p-6 md:p-10">
      <article className="max-w-3xl mx-auto glass rounded-2xl p-6 prose prose-invert">
        <h1 className="text-3xl font-bold">{doc.title}</h1>
        <div className="mt-4 whitespace-pre-wrap">{doc.body}</div>
      </article>
    </main>
  );
}