# Stock Competition — MVP (Near‑Free)

Projet Next.js (Pages Router) prêt à l’emploi pour organiser une compétition d’investissement éducative :
- Authentification (NextAuth Credentials)
- Portefeuille virtuel (cash initial 100 000)
- Ordres au marché (exécution au dernier prix connu)
- Cotations via **yahoo-finance2** (non officiel, gratuit)
- Classement en « quasi temps réel »

## Démarrage rapide

1) Prérequis : Node 18+, npm (ou pnpm/yarn).

2) Installer les dépendances :
```bash
npm i
```

3) Configurer l’environnement :
```bash
cp .env.example .env
# Éditer NEXTAUTH_SECRET (mettre une chaîne aléatoire), garder DATABASE_URL par défaut
```

4) Initialiser la base (SQLite) :
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed   # optionnel : crée un compte demo@example.com / demo1234
```

5) Lancer en dev :
```bash
npm run dev
```

6) Ouvrir http://localhost:3000

## Pages clés
- `/register` : création de compte
- `/login` : connexion
- `/trade` : recherche symbole, cotation, achat/vente
- `/portfolio` : positions, P&L, équité
- `/leaderboard` : classement

## Notes importantes
- Les cotations « globales » via Yahoo nécessitent d’utiliser les suffixes de places (ex: `AIR.PA` pour Airbus à Paris, `RDSA.AS` etc.). La recherche aide à trouver les symboles.
- Données **différées** et non garanties, usage **pédagogique**. Pour de vraies données temps réel multi‑bourses, il faut des fournisseurs payants.
- Tout est calculé côté serveur à la demande ; pour scaler, envisager Redis + jobs planifiés.

## Déploiement
- Vercel (front+API) + SQLite (fichier) convient en dev local seulement. En production, préférer Postgres (Neon/Supabase/Render free tier) et adapter `DATABASE_URL` + exécuter les migrations.
- Définir `NEXTAUTH_URL` dans l’environnement de prod.

## Sécurité / limites
- Pas de 2FA ni de protections avancées (rate limiting), à ajouter si besoin.
- Aucune marge/vente à découvert. Ordres « market » uniquement.
- Anti-triche minimal : journal des ordres en base, pas de rétrodatage possible.

Bon build !
