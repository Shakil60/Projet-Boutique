# automation/ — pipeline IA pour MIRAGE

Bonus du projet Y-Shop. Petit script CLI qui ajoute un nouveau t-shirt
au catalogue à partir d'un simple thème (ex : « forêt cybernétique »,
« néons de Tokyo »).

À chaque exécution :

1. Le script invente un nom et une description pour le design (Gemini).
2. Il génère une image (Imagen).
3. Il sauvegarde l'image dans `frontend/img/products/`.
4. Il ajoute le produit dans `backend/data.json`.

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
   (gratuite jusqu'à un certain volume sur Google AI Studio).
2. Charger l'env : `export $(cat .env | xargs)` (ou `source .env`).
3. Lancer :

```bash
node generate.js --theme "néons de Tokyo"
```

Aucune dépendance npm n'est nécessaire — on utilise les modules natifs
`https`, `fs`, `path`. Pas besoin de `npm install` dans ce dossier.

## Limites

- Une seule image (`-1`) générée par design. La 2e image (verso ou porté)
  demanderait un second appel Imagen — facile à brancher mais on a pas eu
  le temps.
- Les images vivent uniquement en local. Pour un vrai pipeline POD, il
  faudrait les uploader sur un host public (S3, Cloudinary…) avant de
  les envoyer chez un provider type Printful. C'était dans le scope au
  départ mais on a coupé pour rentrer dans les délais du rendu.
- Pas de mockup réaliste : l'image générée est utilisée telle quelle
  comme visuel produit.

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
