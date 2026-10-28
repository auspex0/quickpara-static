# QuickPara

Boutique vitrine pour produits de parapharmacie et paramédicaux (Maroc) :
catalogue, panier, **commande par WhatsApp**, et **console d'administration** pour gérer produits, photos, catégories et réglages.

Tout fonctionne sur le plan **gratuit** de Cloudflare : Pages (site), D1 (base de données), R2 (photos).
Pas de paiement en ligne, pas de gestion de stock.

## Documentation

| Document | Pour qui | Contenu |
|---|---|---|
| [**GUIDE-DEPLOIEMENT.md**](GUIDE-DEPLOIEMENT.md) | La personne qui met le site en ligne | Mise en ligne pas à pas sur quickpara.ma, sauvegarde, dépannage |
| [**MANUEL-UTILISATEUR.md**](MANUEL-UTILISATEUR.md) | La personne qui gère la boutique (non technique) | Utiliser la console, recevoir les commandes, problèmes courants |

## Contenu du projet

```
public/            Site (index.html, css, js) + console /admin
functions/         API : catalogue public, admin, photos (Cloudflare Pages Functions)
src/lib/           Code partagé (connexion, utilitaires)
db/schema.sql      Structure de la base + catégories de départ
db/seed-demo.sql   14 produits d'EXEMPLE (essais locaux uniquement, jamais en ligne)
tests/             Tests de l'API
wrangler.toml      Configuration Cloudflare (base D1, photos R2)
```

## Essayer en local (développeurs)

Prérequis : [Node.js](https://nodejs.org) (version LTS).

```powershell
npm install
echo "ADMIN_PASSWORD=choisissez-un-mot-de-passe-de-test" > .dev.vars
echo "SESSION_SECRET=une-longue-chaine-aleatoire-de-32-caracteres-ou-plus" >> .dev.vars
npm run db:local       # crée la base locale (une seule fois)
npm run db:demo        # produits d'exemple (facultatif)
npm run dev            # http://localhost:5173  — console : /admin
npm test               # dans un autre terminal, serveur lancé : 13 tests de l'API
```

Le fichier `.dev.vars` contient des secrets de test : il est **exclu de Git** et ne doit jamais être publié.

## Sécurité en bref

- Une seule console, protégée par un mot de passe stocké comme **secret Cloudflare** (jamais dans le code).
- Session de 7 jours (cookie HttpOnly, SameSite=Strict). 5 mauvais essais → blocage de 15 minutes par adresse IP.
- Photos : JPEG/PNG/WebP vérifiés sur le contenu réel, 2 Mo maximum.
- Les produits cachés ne sont jamais envoyés au site public.
