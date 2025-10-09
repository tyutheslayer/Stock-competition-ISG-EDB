✅ CHANGELOG v2.5

v2.5 – Améliorations UI/UX & mobile

Accueil (Hero)
	•	Réécriture du Hero : meilleure gestion du wrapping, anti “texte coupé”, z-index/isolation pour éviter que le dégradé ou le canvas 3D ne masque le texte.
	•	Suppression du compte à rebours sur la page d’accueil (CTA redevenu standard).
	•	Alignements et tailles fluides en mobile (text-wrap, overflow-wrap, hyphenation).

Shell & fond
	•	PageShell : couches fond dégradé + NeonBackground3D correctement ordonnées (z-index) et non cliquables.
	•	Thèmes automatiques saisonniers : theme-pink (octobre) et theme-gold (décembre) + logo adapté.
	•	Nettoyage du style global (navbar transparente, glass affiné, tables transparentes dans les GlassPanel).

Trading / Portfolio
	•	Trade : hauteur du TradingViewChart responsive (mobile vs desktop).
	•	PositionsPlusPaneLite : mini-panneau des positions à levier (auto-refresh, close / close all).
	•	Bannière des frais (bps) : visibilité claire et intégrée au calcul du P&L estimé.
	•	Portfolio : séparation Spot / Plus, cartes Plus avec métriques utiles et actions rapides.
	•	Historique d’ordres : export CSV robuste (fallback JSON→CSV si le serveur ne renvoie pas du CSV).

Classement
	•	Filtres période (jour/semaine/mois/saison) et promo (liste blanche).
	•	Affichage badges par joueur + compat perf (0–1 ou %).

EDB Plus
	•	Page /plus modernisée (bénéfices, comparatif, FAQ), bouton d’aperçu lab, statut d’abonnement.
	•	/plus/sheets : gating + squelettes de chargement + liste des fiches.

Règles
	•	Page /rules : règles claires, FAQ & bonnes pratiques.

Divers
	•	Composant GlassPanel factorisé (glassmorphism cohérent).
	•	Petites optimisations d’accessibilité & réductions de risques de “layout shift”.
