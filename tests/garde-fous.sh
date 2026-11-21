#!/usr/bin/env bash
# Garde-fous IGC Gestion : bloquent une demande de fusion qui enfreint les règles de travail.
# Usage : tests/garde-fous.sh <branche de référence, ex. origin/main>
set -u; REF="${1:-origin/main}"; KO=0
ko(){ echo "❌ $1"; KO=1; }; ok(){ echo "✅ $1"; }
cd "$(git rev-parse --show-toplevel)"
CHANGE=$(git diff --name-only "$REF"...HEAD -- igc/ | grep -v '^igc/data/' || true)
if [ -n "$CHANGE" ]; then
  v0=$(git show "$REF":igc/index.html | grep -oE "const VERSION = 'V[0-9.]+'" | grep -oE "V[0-9.]+"); v1=$(grep -oE "const VERSION = 'V[0-9.]+'" igc/index.html | grep -oE "V[0-9.]+")
  [ "$v0" != "$v1" ] && ok "Numéro de version augmenté ($v0 → $v1)" || ko "L'application change mais la version reste $v1 : augmentez le numéro."
  c0=$(git show "$REF":igc/sw.js | grep -oE "igc-shell-[0-9]+"); c1=$(grep -oE "igc-shell-[0-9]+" igc/sw.js)
  [ "$c0" != "$c1" ] && ok "Cache hors ligne renouvelé ($c1)" || ko "Le cache hors ligne ($c1) n'est pas renouvelé : les téléphones garderaient l'ancienne version."
else ok "Application inchangée : pas de nouvelle version requise"; fi
grep -nE '<script[^>]+src="https?://' igc/index.html && ko "Script chargé depuis un site extérieur : hébergez-le dans igc/vendor/." || ok "Aucun script extérieur"
grep -q 'http-equiv="Content-Security-Policy"' igc/index.html && ok "Politique de sécurité du contenu présente" || ko "Politique de sécurité du contenu absente"
if git diff "$REF"...HEAD -- . ':!tests/garde-fous.sh' | grep -E '^\+' | grep -nE "(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|-----BEGIN (RSA |EC )?PRIVATE KEY|\"private_key\"|AIza[0-9A-Za-z_-]{35}.*(secret|admin))"; then ko "Possible clé secrète dans les changements"; else ok "Aucune clé secrète dans les changements"; fi
git diff "$REF"...HEAD -- igc/ | grep -E '^\+' | grep -nE "\b(NNI|numéro d'électeur|date de naissance)\b" && ko "Donnée nominative d'électeur possible (loi 2013-450)" || ok "Aucune donnée nominative d'électeur ajoutée"
git diff --name-only --diff-filter=D "$REF"...HEAD | grep -E '^(igc/|end/)' && ko "Fichier de l'application supprimé : vérifiez qu'aucune fonction n'est retirée" || ok "Aucun fichier de l'application supprimé"
n0=$(git show "$REF":igc/index.html | grep -cE "^(async )?function |^const [A-Za-z_]+ = .*=>"); n1=$(grep -cE "^(async )?function |^const [A-Za-z_]+ = .*=>" igc/index.html)
[ "$n1" -ge "$n0" ] && ok "Fonctions : $n0 → $n1 (aucune retirée)" || ko "Le nombre de fonctions baisse ($n0 → $n1) : une fonction existante a peut-être été supprimée."
python3 -c "import json;json.load(open('end/regles-firebase.json'))" && ok "Règles Firebase valides" || ko "Règles Firebase illisibles"
exit $KO
