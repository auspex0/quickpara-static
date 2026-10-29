# QuickPara

Boutique vitrine pour produits de parapharmacie et paramédicaux (Maroc) :
catalogue, panier, **commande par WhatsApp avec numéro de commande**, et **console d'administration** en français.

Tout fonctionne sur le plan **gratuit** de Cloudflare : Pages (site + API), D1 (base de données), R2 (photos).
Pas de paiement en ligne, pas de gestion de stock.

## Fonctions

- **Boutique** : catégories (chacune avec sa page `/c/…`), recherche, filtre par marque, badges « Promo -X % » et « Nouveau », produits à la une, panier.
- **Commande** : zones de livraison avec livraison gratuite dès un montant, commande minimum ; la commande est enregistrée (`QP-1042`) puis WhatsApp s'ouvre avec le message. Si l'enregistrement échoue, WhatsApp s'ouvre quand même (message sans numéro).
- **Console `/admin`** : Commandes (statuts), Produits (photos, promo, ordre, visibilité), Catégories (adresse et description pour Google), Livraison, Réglages (WhatsApp, horaires, réseaux sociaux).
- **Référencement** : titre, description, adresse canonique et données produits (JSON-LD) écrits côté serveur ; `sitemap.xml` et `robots.txt`.

## Documentation

| Document | Pour qui | Contenu |
|---|---|---|
| [**GUIDE-DEPLOIEMENT.md**](GUIDE-DEPLOIEMENT.md) | La personne qui met le site en ligne | Mise en ligne pas à pas, passage à une nouvelle version, Google Search Console, sauvegarde, dépannage |
| [**COMMENT-CA-MARCHE.md**](COMMENT-CA-MARCHE.md) | La personne qui gère la boutique (non technique) | Où vit le site : Cloudflare, GitHub, nom de domaine, WhatsApp ; qui touche à quoi |
| [**MANUEL-UTILISATEUR.md**](MANUEL-UTILISATEUR.md) | La personne qui gère la boutique (non technique) | Utiliser la console, traiter les commandes, problèmes courants |
| [**PLAN-V2.md**](PLAN-V2.md) | Développeurs | Plan et notes techniques de la version 2 |

## Contenu du projet

```
public/                 Site (index.html, css, js), console /admin, robots.txt
functions/index.js      Page d'accueil avec titre et données produits (SEO)
functions/c/[slug].js   Page de chaque catégorie : /c/visage…
functions/sitemap.xml.js
functions/api/          API : catalogue public, commandes, admin
functions/img/          Photos (servies depuis R2)
src/lib/                Code partagé : connexion, règle de livraison, SEO
db/migrations/          Structure de la base, en étapes numérotées (0001, 0002, 0003…)
db/seed-demo.sql        14 produits d'EXEMPLE (essais locaux uniquement, jamais en ligne)
tests/                  Tests de l'API
wrangler.toml           Configuration Cloudflare (base D1, photos R2, adresse du site)
```

## Essayer en local (développeurs)

Prérequis : [Node.js](https://nodejs.org) (version LTS).

```powershell
npm install
Set-Content -Path .dev.vars -Encoding ascii -Value "ADMIN_PASSWORD=choisissez-un-mot-de-passe-de-test","SESSION_SECRET=une-longue-chaine-aleatoire-de-32-caracteres-ou-plus"
npm run db:local       # crée la base locale (applique toutes les migrations)
npm run db:demo        # produits d'exemple (facultatif)
npm run dev            # http://localhost:5173  — console : /admin
npm test               # dans un autre terminal, serveur lancé : 31 tests
```

Le fichier `.dev.vars` contient des secrets de test : il est **exclu de Git** et ne doit jamais être publié.
Les tests créent des produits et des commandes de test dans la base **locale** ; ne jamais les lancer contre le site en ligne.

## Sécurité en bref

- Une seule console, protégée par un mot de passe stocké comme **secret Cloudflare** (jamais dans le code).
- Session de 7 jours (cookie HttpOnly, SameSite=Strict). 5 mauvais essais → blocage de 15 minutes par adresse IP.
- Commandes : prix toujours recalculés par le serveur, 10 commandes par heure et par visiteur, 50 lignes maximum.
- Photos : JPEG/PNG/WebP vérifiés sur le contenu réel, 2 Mo maximum.
- Les produits cachés ne sont jamais envoyés au site public ni dans les données pour Google.
- Liens des réseaux sociaux : `https://` uniquement.
