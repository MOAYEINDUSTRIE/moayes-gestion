# Tests d'IGC Gestion

Lancer en local : `cd tests && npm ci && npx playwright install chromium && npx playwright test`
(rapport dans `tests/rapport/index.html`). Garde-fous : `bash tests/garde-fous.sh origin/main`.

| Fichier | Ce qui est vérifié |
|---|---|
| 1-navigation | Chaque écran s'ouvre sans erreur, aucun appel à un site non autorisé, version affichée |
| 2-commercial | Catalogue (25 prestations), prix repris dans le devis, RCCM/IDU/gérance sur devis et contrat, export Excel sans formule |
| 3-strategie | N'ZI : 352 coordinations, 704 cellules, 1 056 responsables ; « 50 % + 1 voix » ; Toumodi commune seule (26 lieux, 84 BV) ; tranches de 500 ; document candidat sans méthode IGC ni « IA » |
| 4-securite | PIN chiffrés PBKDF2, codes faciles refusés, blocage après 5 essais, politique de sécurité du contenu |

Chaque test tourne deux fois : **ordinateur** (1280×850) et **téléphone** (Pixel 5), sans connexion à la vraie base.
Chiffres de référence : CEI, répertoire des lieux de vote 2025 (igc/data/lieux-vote-2025.json).
