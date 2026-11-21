# Tests d'IGC Gestion

Lancer en local : `cd tests && npm ci && npx playwright install chromium && npx playwright test`
(rapport dans `tests/rapport/index.html`). Garde-fous : `bash tests/garde-fous.sh origin/main`.

| Fichier | Ce qui est vérifié |
|---|---|
| 1-navigation | Chaque écran s'ouvre sans erreur, aucun appel à un site non autorisé, version affichée |
| 2-commercial | Catalogue (25 prestations), prix repris dans le devis, RCCM/IDU/gérance sur devis et contrat, export Excel sans formule |
| 3-strategie | N'ZI : 352 coordinations, 704 cellules, 1 056 responsables ; « 50 % + 1 voix » ; Toumodi commune seule (26 lieux, 84 BV) ; tranches de 500 ; document candidat sans méthode IGC ni « IA » |
| 4-securite | PIN chiffrés PBKDF2, codes faciles refusés, blocage après 5 essais, politique de sécurité du contenu |
| 5-synchro | Synchronisation fiche par fiche (V1.33) : reprise de l'ancien emplacement sans l'effacer, envoi limité à la fiche modifiée, réception d'un autre appareil, suppressions, appareil resté en V1.32, repli si les règles ne sont pas déployées, journal des erreurs |
| charge/ | Copie fictive (8 925 puis 26 725 fiches) : démarrage, écrans, enregistrement, taille d'un envoi, stratégies des 93 régions. `npx playwright test -c playwright.charge.config.js` |

Les tests de synchronisation utilisent `igc/faux-firebase.js` (base en mémoire) : la vraie base n'est jamais touchée.
L'audit hebdomadaire (`.github/workflows/audit-hebdo.yml`, lundi 03 h 07) lance la sécurité et la charge, et ouvre une « issue » en cas d'anomalie.

Chaque test tourne deux fois : **ordinateur** (1280×850) et **téléphone** (Pixel 5), sans connexion à la vraie base.
Chiffres de référence : CEI, répertoire des lieux de vote 2025 (igc/data/lieux-vote-2025.json).
