# automation/ — pipeline IA pour MIRAGE

Bonus du projet Y-Shop. Petit script CLI qui ajoute un nouveau t-shirt
au catalogue à partir d'un simple thème (ex : « forêt cybernétique »,
« gardiens du désert », « néons de Tokyo »).

À chaque exécution :

1. Le script invente un nom et une description pour le design (Gemini).
2. Il génère une image (Imagen).
3. Il sauvegarde l'image dans `frontend/img/products/`.
4. Si Cloudinary est configuré, il uploade l'image et utilise l'URL publique.
5. Il ajoute le produit dans `backend/data.json`.

Le produit apparaît immédiatement dans le catalogue sur le site (au prochain
rafraîchissement).

## Modes

### Mock (par défaut, aucune clé requise)

```bash
node generate.js --theme "forêt cybernétique" --mock
```

Le script utilise un nom plausible inventé à partir du thème, et récupère
une image picsum déterministe à la place de l'IA. Pratique pour des démos
locales sans cramer du quota.

### Réel (Gemini + Imagen)

1. Copier `.env.example` vers `.env` et y mettre ta clé `GEMINI_API_KEY`
   (récupérable sur https://aistudio.google.com/app/apikey, gratuit jusqu'à
   un certain volume).
2. Charger l'env : `export $(cat .env | xargs)` (ou `source .env`).
3. Lancer :

```bash
node generate.js --theme "néons de Tokyo"
```

Le script utilise alors :
- `gemini-3-flash-preview` pour fabriquer le nom + la description (mode JSON).
- `imagen-4.0-generate-001` pour générer l'image en 1024×1024.

Les deux IDs de modèle sont centralisés en haut de `generate.js`
(constantes `TEXT_MODEL` et `IMAGE_MODEL`), à mettre à jour quand
Google sort un nouveau Flash ou un nouvel Imagen.

Aucune dépendance npm — on utilise les modules natifs `https`, `fs`, `path`,
`crypto`. Pas besoin de `npm install` dans ce dossier.

### Upload public (Cloudinary)

Sans cette étape, les images générées vivent uniquement en local
(`frontend/img/products/...`). Le frontend les affiche sans problème, mais
**Printful ne peut pas les récupérer** au moment du push POD.

Pour boucler le pipeline :

1. Créer un compte Cloudinary gratuit (25 GB).
2. Récupérer la `CLOUDINARY_URL` dans le dashboard
   (forme : `cloudinary://api_key:api_secret@cloud_name`).
3. La mettre dans `.env`.
4. Relancer `generate.js` — l'image sera uploadée dans le dossier
   `mirage/designs/` du compte, et l'URL publique sera utilisée dans
   `data.json` à la place du chemin local.

L'upload utilise la méthode signée (HMAC-SHA1 côté serveur), pas un preset
non-signé : c'est la méthode recommandée pour un script qui tourne côté
back avec accès au secret.

## Push POD (Printful)

Le second script `push-pod.js` simule (ou effectue) l'envoi du catalogue
local vers Printful.

```bash
# simulation (par défaut, log seulement) :
node push-pod.js

# un seul produit :
node push-pod.js --id glass-dragon

# vrai push (nécessite PRINTFUL_API_KEY dans l'env) :
PRINTFUL_API_KEY=xxx node push-pod.js
```

Limites de cette V1 :
- Le mapping `(couleur, taille)` → `variant_id` Printful est fictif
  (hash bidon dans le mock). En vrai, il faut le récupérer via
  `GET /products/{id}/variants` côté Printful, selon le tee choisi
  (Bella+Canvas 3001, Stanley/Stella, etc.).
- Si une image n'est pas publique (chemin local), le script log un
  warning une seule fois par produit, et continue avec un placeholder
  d'URL invalide. Le vrai run nécessite donc l'étape Cloudinary.

## Pipeline 100% turn-key (avec toutes les clés)

```bash
# .env contient :
#   GEMINI_API_KEY=...
#   CLOUDINARY_URL=cloudinary://...
#   PRINTFUL_API_KEY=...

source .env

# 1. nouveau design
node generate.js --theme "spectres polaires"

# 2. push POD
node push-pod.js --id <slug-du-design>
```

→ Vrai design Imagen → uploadé sur Cloudinary → produit créé chez
Printful → prêt à recevoir des commandes.

## Limites volontaires (V1 → V2)

- Pas de mockup t-shirt réaliste : l'image générée sert de visuel produit
  tel quel. Pour un vrai rendu il faudrait composite l'image sur une
  photo de t-shirt vide (Sharp + un template PNG).
- Une seule image (`-1`) générée par design. La 2e image (verso ou porté)
  demanderait un second appel Imagen — facile à brancher en V2.
- Pas de webhook commande → fulfillment Printful pour l'instant. Le
  pipeline s'arrête à la création du Sync Product.

## Idée de scénario démo (pour l'oral)

```bash
# 1. lancer le back
cd ../backend && npm start &

# 2. lancer le front
cd ../frontend && python3 -m http.server 8080 &

# 3. ajouter un design en mock (pas besoin de clé)
cd ../automation && node generate.js --theme "spectres polaires" --mock

# 4. rafraîchir http://localhost:8080/index.html
#    -> le nouveau produit apparaît dans le catalogue
```
