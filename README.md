# MIRAGE - Y-Shop

Projet de fin de module Challenge JS (Ynov Aix). Boutique de t-shirts streetwear
en édition courte, dont les prints sont des designs « dreamcore » générés par IA.

Stack : HTML / CSS / JS pur côté front (aucun framework), Express côté back,
fichiers JSON pour la persistance.

## Sommaire

- [Structure du dépôt](#structure-du-dépôt)
- [Lancement](#lancement)
- [Architecture](#architecture)
- [Endpoints de l'API](#endpoints-de-lapi)
- [Schémas des données](#schémas-des-données)
- [Fonctionnalités](#fonctionnalités)
- [Stockage navigateur](#stockage-navigateur)
- [Identifiants de démo](#identifiants-de-démo)
- [Codes promo](#codes-promo)
- [Bonus : pipeline IA](#bonus--pipeline-ia)
- [Auteurs](#auteurs)

## Structure du dépôt

```
Projet-Boutique/
├─ backend/
│  ├─ app.js                      # Express + CORS + JSON + montage des routers
│  ├─ data.json                   # 20 produits, variantes, stocks
│  ├─ users.json                  # comptes (1 admin par défaut)
│  ├─ orders.json                 # commandes
│  ├─ package.json
│  ├─ controller/
│  │  ├─ shop.js                  # crud produits, filtres, tri, pagination, stock
│  │  ├─ auth.js                  # signup, login, middleware
│  │  └─ orders.js                # création commande, historique
│  └─ router/
│     ├─ shop.js
│     ├─ auth.js
│     └─ orders.js
├─ frontend/
│  ├─ index.html                  # catalogue
│  ├─ produit.html                # détail produit (?id=…)
│  ├─ panier.html
│  ├─ favoris.html
│  ├─ checkout.html               # finaliser une commande
│  ├─ commandes.html              # historique utilisateur
│  ├─ connexion.html / inscription.html
│  ├─ admin.html                  # back-office produits (admin)
│  ├─ style.css
│  ├─ common.js                   # helpers partagés (panier, fav, auth, recherche, thème)
│  ├─ script.js                   # logique catalogue
│  ├─ produit.js · panier.js · favoris.js · checkout.js · commandes.js · admin.js · auth.js
├─ automation/                    # bonus oral - pipeline IA Gemini + Imagen + Cloudinary + Printful
└─ README.md
```

## Lancement

### 1. Backend

```bash
cd backend
npm install
npm start
```

Le serveur écoute sur `http://localhost:3000`. Il affiche
`API MIRAGE en ligne sur le port 3000` au démarrage.

### 2. Frontend

Le frontend est purement statique. Plusieurs options pour le servir :

```bash
# Option A - extension Live Server dans VS Code (clic droit sur frontend/index.html)

# Option B - serveur Python intégré
cd frontend
python3 -m http.server 8080

# Option C - npx serve
npx serve frontend
```

Puis ouvrir `http://localhost:8080/index.html`.

Si le port du backend change, ajuster `API_URL` en haut de `frontend/common.js`.

## Architecture

```
                 ┌──────────────────────┐
                 │   Navigateur (front)  │
                 │  HTML / CSS / JS pur  │
                 └──────────┬───────────┘
                            │  fetch (HTTP + JSON)
                            │  + X-User-Id header
                            ▼
                 ┌──────────────────────┐
                 │   API Express (back) │
                 │   :3000              │
                 ├──────────────────────┤
                 │  /products           │  catalogue (filtres, tri, pagination)
                 │  /products/:id       │  détail / similaires
                 │  /products/:id/stock │  PATCH décrément
                 │  /products (POST..)  │  CRUD admin
                 │  /auth/...           │  signup, login, me
                 │  /orders             │  création, historique
                 └──────────┬───────────┘
                            │  fs read/write
                            ▼
                 ┌──────────────────────┐
                 │  Fichiers JSON (data) │
                 │  data.json   users.json
                 │  orders.json
                 └──────────────────────┘

                 ┌──────────────────────┐
                 │  automation/ (bonus)  │
                 │  Gemini + Imagen + Cloudinary + Printful
                 │  écrit dans data.json
                 └──────────────────────┘
```

## Endpoints de l'API

### Produits

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/products` | - | Liste. Filtres : `gender`, `type`, `color`, `size`, `minPrice`, `maxPrice`, `search`. Tri : `sort=price_asc \| price_desc \| name`. Pagination : `limit` + `offset` (renvoie `{ items, total, hasMore }`). |
| `GET` | `/products/:id` | - | Détail d'un produit. |
| `GET` | `/products/:id/similar` | - | Jusqu'à 4 produits similaires. |
| `PATCH` | `/products/:id/stock` | - | Décrémente le stock d'une variante. Body : `{ color, size, qty }`. |
| `POST` | `/products` | admin | Crée un produit. |
| `PUT` | `/products/:id` | admin | Remplace un produit complet. |
| `DELETE` | `/products/:id` | admin | Supprime un produit. |

### Auth

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | - | `{ email, password, name }` → `{ token, user }`. |
| `POST` | `/auth/login` | - | `{ email, password }` → `{ token, user }`. |
| `GET` | `/auth/me` | user | Renvoie l'utilisateur courant. |

Le « token » renvoyé est l'`id` utilisateur. Le front l'envoie ensuite dans
le header `X-User-Id` sur les routes protégées (pas de JWT, projet école).

### Commandes

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/orders` | user | Crée une commande à partir du panier + adresse. Décrémente le stock atomiquement. |
| `GET` | `/orders/me` | user | Historique de l'utilisateur courant. |
| `GET` | `/orders/:id` | owner ou admin | Détail. |
| `GET` | `/orders` | admin | Toutes les commandes. |

## Schémas des données

### Product (`data.json`)

```js
{
    id: "cosmic-wolf",
    name: "Cosmic Wolf",
    description: "...",                 // 200 à 500 caractères
    price: 34.90,
    currency: "EUR",
    gender: "unisexe" | "femme" | "homme",
    type: "graphique" | "typo" | "minimal",
    fit: "oversized" | "regular" | "cropped",
    material: "Coton bio 220 g/m²",
    colors: ["noir", "blanc", "sand"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    images: ["url1", "url2", "url3"],   // 2 à 3
    stock: [
        { color: "noir", size: "M", quantity: 14 },
        ...                              // une entrée par variante
    ]
}
```

### User (`users.json`)

```js
{
    id: "u-1697...",
    email: "client@mirage.fr",
    password: "...",                    // en clair (projet école), à hasher en prod
    name: "Jean Test",
    role: "user" | "admin",
    createdAt: "2026-04-29T..."
}
```

### Order (`orders.json`)

```js
{
    id: "ord-1697...",
    userId: "u-...",
    items: [
        { productId, name, image, color, size, qty, unitPrice, lineTotal }
    ],
    shipping: { name, email, address, zip, city, country, phone },
    subtotal, discount, promoCode, shippingCost, total,
    status: "pending" | "shipped" | "delivered",
    createdAt: "2026-04-29T..."
}
```

## Fonctionnalités

- **Catalogue** : grille responsive, hover qui permute la 1re / 2e image,
  filtres combinables (genre, type, couleur, taille, prix), tri,
  pagination « voir plus », skeletons pendant le chargement, état vide
  illustré.
- **Recherche** : barre dans le header avec autocomplete (5 résultats live)
  + page de résultats filtrés (`?search=…`).
- **Page produit** : carrousel d'images, description tronquée à 150 car. avec
  bouton « voir plus », sélection couleur (variantes obligatoires) et taille
  (rupture grisée), indication du stock, ajout panier, favoris, produits
  similaires.
- **Panier** : `localStorage`, modification quantité, suppression, sous-total,
  redirection vers checkout.
- **Checkout** : formulaire livraison, récap, frais de port (offert dès 50 €,
  sinon 4,90 €), code promo, création de commande qui décrémente le stock
  côté API.
- **Mes commandes** : historique utilisateur avec détail (items, livraison,
  totaux, statut).
- **Favoris** : `localStorage`, page dédiée.
- **Comptes** : inscription / connexion / déconnexion, header dynamique selon
  l'état, badge admin si rôle admin.
- **Espace admin** : CRUD produits (création, édition, suppression), formulaire
  modal, validation côté API.
- **Mode sombre / clair** : toggle dans le header, persistance, transitions.
- **UX** : toasts de feedback, animations fade-in sur les cartes, pulse du
  badge panier, respect de `prefers-reduced-motion`.

## Stockage navigateur

| Clé | Contenu |
|---|---|
| `mirage_cart` | tableau d'articles (id, color, size, qty, unitPrice…) |
| `mirage_favs` | tableau d'ids produits |
| `mirage_auth` | `{ token, user }` après login |
| `mirage_theme` | `"light"` ou `"dark"` |

## Identifiants de démo

Un compte admin est créé par défaut dans `users.json` :

```
email     : admin@mirage.fr
password  : admin123
```

N'importe quel autre compte se crée via la page `inscription.html`.

## Codes promo

| Code | Effet |
|---|---|
| `MIRAGE10` | -10 % sur le sous-total |
| `WELCOME5` | -5 € fixes |

À taper sur la page `checkout.html`, champ « code promo ».

## Bonus : pipeline IA

Voir `automation/README.md`. En résumé :

```bash
cd automation
node generate.js --theme "spectres polaires" --mock   # ajoute un produit auto
node push-pod.js --id <slug>                           # simule push Printful
```

En mode réel : Gemini 3 Flash (texte) + Imagen 4 (image) + Cloudinary
(hébergement) + Printful (POD).

## Auteurs

Projet réalisé en binôme dans le cadre du module Challenge JS - Ynov Aix.
