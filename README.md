# Registre des pronostics — agent d'analyse de paris sportifs

Registre cumulatif tenu par la tâche programmée « Analyse paris football — chaque matin ».
Rien n'est jamais supprimé : les pronostics perdants restent dans le registre.

- `registre.csv` (séparateur `;`) : une ligne par pronostic émis.
  - `issue` : EN_ATTENTE, GAGNÉ, PERDU, REMBOURSÉ (match annulé/reporté) ou INCONNU (résultat introuvable).
  - `mise_unites` : 1 unité par pari (mise plate, aucune martingale).
  - `gain_perte_unites` : cote − 1 si gagné, −1 si perdu, 0 si remboursé.
  - `valeur_attendue` : proba_estimee × cote − 1.
- `journal/AAAA-MM-JJ.md` : rapport du jour (sélections, candidats rejetés et raisons, sources et heures de consultation).

Aucun pari n'est placé et aucun argent n'est engagé par l'agent.
