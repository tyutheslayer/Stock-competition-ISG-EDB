// components/Hero.jsx
export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              L’École de la <span className="text-primary">Bourse</span>
            </h1>
            <p className="mt-4 text-lg opacity-80">
              Apprends à investir avec des sessions guidées, des challenges
              et un simulateur de trading. Choisis une formule et rejoins la
              communauté.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#pricing" className="btn btn-primary">Voir les formules</a>
              <a href="/calendar" className="btn btn-outline">Calendrier</a>
            </div>

            <div className="mt-6 text-sm opacity-70">
              Mini-cours gratuit chaque jeudi, 13h–13h30. Sans carte bancaire.
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl shadow-xl bg-base-100 border p-5">
              <div className="font-semibold mb-2">Extrait de l’espace membre</div>
              <ul className="space-y-2 text-sm opacity-80">
                <li>• Suivi des positions et de la perf</li>
                <li>• Classement par période</li>
                <li>• Mini-cours live & replays (Plus)</li>
                <li>• Ressources, fiches, TP</li>
              </ul>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-base-200">
                  <div className="text-xl font-bold">30 min</div>
                  <div className="text-xs opacity-70">chaque jeudi</div>
                </div>
                <div className="p-3 rounded-xl bg-base-200">
                  <div className="text-xl font-bold">0€</div>
                  <div className="text-xs opacity-70">mini-cours</div>
                </div>
                <div className="p-3 rounded-xl bg-base-200">
                  <div className="text-xl font-bold">+</div>
                  <div className="text-xs opacity-70">accès complet en Plus</div>
                </div>
              </div>
            </div>
            <div className="absolute -z-10 -right-6 -bottom-6 h-40 w-40 bg-primary/20 blur-3xl rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
}