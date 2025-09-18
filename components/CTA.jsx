// components/CTA.jsx
export default function CTA() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-4xl mx-auto px-6 text-center rounded-3xl bg-gradient-to-br from-primary/10 to-secondary/10 p-10">
        <h3 className="text-2xl md:text-3xl font-bold">Prêt à te lancer ?</h3>
        <p className="mt-2 opacity-80">
          Rejoins le mini-cours gratuit du jeudi, ou débloque tout avec la formule Plus.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <a href="/register" className="btn btn-outline">Créer un compte</a>
          <a href="/plus" className="btn btn-primary">Découvrir l’offre Plus</a>
        </div>
      </div>
    </section>
  );
}