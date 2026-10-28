# Guide de mise en ligne — QuickPara

Ce guide explique, pas à pas, comment mettre le site en ligne sur **quickpara.ma**, gratuitement, avec Cloudflare.
Il se fait **une seule fois**. Compter environ 45 minutes, plus l'attente éventuelle du nom de domaine (voir étape 11).

> **À savoir avant de commencer**
> - Les commandes se tapent dans **PowerShell** (Windows). Pour l'ouvrir : touche Windows, taper « PowerShell », Entrée.
> - Copier-coller chaque commande, appuyer sur Entrée, **attendre la fin** avant de passer à la suivante.
> - Ne jamais publier votre mot de passe admin ni votre « SESSION_SECRET » (étape 8) : ce sont des secrets.
> - Tout ce guide utilise des services dont le plan gratuit suffit pour une petite boutique. Cloudflare peut modifier ses écrans ou ses conditions : si un écran diffère légèrement de ce guide, suivez l'idée générale.

---

## Ce dont vous avez besoin

| Élément | Où l'obtenir | Coût |
|---|---|---|
| Un ordinateur Windows avec accès Internet | — | — |
| **Node.js** (version LTS) | https://nodejs.org → bouton « LTS » → installer (tout laisser par défaut) | Gratuit |
| Un compte **Cloudflare** | https://dash.cloudflare.com/sign-up | Gratuit |
| Le nom de domaine **quickpara.ma** | Déjà acheté (renouvellement annuel chez votre registrar) | Déjà payé |
| Le dossier du projet | Voir étape 1 | Gratuit |
| Votre numéro WhatsApp Business | — | — |

---

## Étape 1 — Récupérer le projet

**Option A (la plus simple, sans Git)** : sur https://github.com/auspex0/quickpara-static cliquer sur le bouton vert **Code** → **Download ZIP**. Extraire le ZIP, par exemple dans `D:\QuickParaStatic`.

**Option B (avec Git)** :
```powershell
git clone https://github.com/auspex0/quickpara-static.git D:\QuickParaStatic
```

Ouvrir PowerShell **dans ce dossier** (explorateur de fichiers → clic droit dans le dossier → « Ouvrir dans le Terminal »), puis vérifier :
```powershell
node --version
```
Un numéro de version doit s'afficher (par exemple `v22.x`). Si « commande introuvable » : refermer PowerShell, le rouvrir, et si cela ne change rien, réinstaller Node.js.

## Étape 2 — Installer les outils du projet
```powershell
npm install
```
Attendre la fin (1 à 2 minutes). Des messages d'avertissement (« warn ») sont normaux ; une erreur en rouge qui s'arrête ne l'est pas.

## Étape 3 — Se connecter à Cloudflare
```powershell
npx wrangler login
```
Une page web s'ouvre : cliquer sur **Allow / Autoriser**. Revenir dans PowerShell : le message « Successfully logged in » doit apparaître.

## Étape 4 — Créer la base de données (les produits)
```powershell
npx wrangler d1 create quickpara
```
Cloudflare affiche un bloc de texte contenant une ligne comme :
```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
1. **Copier** la valeur entre guillemets (l'identifiant).
2. Ouvrir le fichier **`wrangler.toml`** (clic droit → Ouvrir avec → Bloc-notes).
3. Remplacer `REPLACE_WITH_ID_FROM_d1_create` par cet identifiant (garder les guillemets).
4. Enregistrer (Ctrl+S).

Puis créer les tables (la structure) :
```powershell
npx wrangler d1 execute quickpara --remote --file=db/schema.sql
```
Si Wrangler demande « Ok to proceed? », taper `y` puis Entrée. Cela crée aussi les 6 catégories de départ (Visage, Corps & cheveux, Bébé & maman, Compléments, Hygiène, Premiers soins) que vous pourrez modifier ensuite.

> ⚠️ Ne **jamais** lancer `db/seed-demo.sql` en ligne : ce sont des produits d'exemple pour les tests.

## Étape 5 — Créer l'espace des photos
```powershell
npx wrangler r2 bucket create quickpara-photos
```
- Si Cloudflare répond qu'il faut **activer R2** : aller sur https://dash.cloudflare.com → menu **R2 Object Storage** → suivre l'activation, puis relancer la commande.
- **Attention** : l'activation de R2 peut demander d'enregistrer un moyen de paiement (carte). L'offre gratuite (10 Go de stockage) est largement suffisante pour une boutique, mais **vérifiez les conditions affichées par Cloudflare avant de valider**. Si vous ne souhaitez pas donner de carte, voir « Alternatives » en bas de ce guide.

## Étape 6 — Créer le projet du site
```powershell
npx wrangler pages project create quickpara --production-branch main
```
Si Wrangler pose une question, accepter les valeurs par défaut (Entrée).

## Étape 7 — Choisir le mot de passe administrateur
Choisir un **mot de passe long et unique** (12 caractères minimum, ne l'utiliser nulle part ailleurs). Le noter dans un gestionnaire de mots de passe ou sur papier, en lieu sûr.
```powershell
npx wrangler pages secret put ADMIN_PASSWORD --project-name quickpara
```
Wrangler demande la valeur : **taper (ou coller) le mot de passe**, puis Entrée. Rien ne s'affiche pendant la saisie, c'est normal.

## Étape 8 — Créer la clé de sécurité des connexions
D'abord générer une suite aléatoire :
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copier la longue suite de lettres et de chiffres affichée, puis :
```powershell
npx wrangler pages secret put SESSION_SECRET --project-name quickpara
```
Coller la suite, Entrée. (Vous n'aurez **plus jamais** besoin de la connaître ; ne la partagez pas.)

## Étape 9 — Publier le site
```powershell
npx wrangler pages deploy public --project-name quickpara
```
À la fin, Wrangler affiche une adresse du type `https://xxxxxxxx.quickpara.pages.dev`.

## Étape 10 — Vérifier que tout marche (avant de brancher le vrai domaine)
Ouvrir **https://quickpara.pages.dev** (ou l'adresse affichée à l'étape 9).

1. Le site s'affiche. Il ne contient pas encore de produits : le message « Le catalogue arrive très bientôt » est normal.
2. Aller sur **https://quickpara.pages.dev/admin** → saisir le mot de passe de l'étape 7 → vous arrivez dans la console.
3. Onglet **Settings** : saisir votre **vrai numéro WhatsApp** (par exemple `0612345678` : il est converti automatiquement en `212612345678`), vérifier le nom du magasin et les horaires → **Save settings**.
4. Onglet **Products** → **+ New product** → ajouter un premier produit avec une photo → **Save**.
5. Revenir sur le site (bouton « View site »), recharger la page : le produit apparaît.
6. **Test de commande** : ajouter le produit au panier, cliquer **Commander sur WhatsApp**. WhatsApp doit s'ouvrir avec le message de commande **vers votre numéro**. Avec votre téléphone, testez aussi : le message arrive bien dans WhatsApp Business.

Si une de ces vérifications échoue, voir « Dépannage » plus bas.

## Étape 11 — Brancher quickpara.ma
Deux situations.

### a) Le plus simple : confier le domaine à Cloudflare
1. https://dash.cloudflare.com → **Add a domain** (ou « Ajouter un site ») → saisir `quickpara.ma` → choisir le plan **Free**.
2. Cloudflare affiche **deux serveurs de noms** (par exemple `xxx.ns.cloudflare.com`). Les noter.
3. Aller chez le **registrar** où vous avez acheté quickpara.ma, dans la gestion du domaine → section **DNS / Serveurs de noms (nameservers)** → remplacer les serveurs actuels par les deux de Cloudflare → enregistrer.
4. Attendre que Cloudflare confirme que le domaine est « Active » (de quelques minutes à 24 h, parfois 48 h).
5. Ensuite : Cloudflare → **Workers & Pages** → projet **quickpara** → onglet **Custom domains** → **Set up a custom domain** → `quickpara.ma` → confirmer. Faire de même pour `www.quickpara.ma`.
6. Le certificat HTTPS (cadenas) est créé automatiquement, en quelques minutes.

> Je n'ai pas pu tester le transfert des serveurs de noms d'un domaine en `.ma` : la procédure est standard, mais si votre registrar ou Cloudflare refuse, utilisez en attendant l'adresse gratuite `quickpara.pages.dev` et demandez au support de votre registrar comment changer les serveurs de noms.

### b) Seulement un sous-domaine (`www`)
Si vous ne pouvez pas changer les serveurs de noms : chez votre registrar, créer un enregistrement **CNAME** `www` pointant vers `quickpara.pages.dev`, puis ajouter `www.quickpara.ma` dans **Custom domains** (étape 11-a-5). Le domaine « nu » (`quickpara.ma` sans `www`) ne fonctionnera alors pas sans Cloudflare comme serveur DNS.

## Étape 12 — Dernière vérification
Ouvrir **https://quickpara.ma** (et `/admin`) sur ordinateur **et** sur téléphone, passer une commande test complète, puis supprimer le produit de test si besoin.

---

## Mettre à jour le site plus tard

- **Produits, prix, photos, catégories, numéro WhatsApp** : uniquement via `/admin`. Aucune commande à taper. (Voir le **Manuel d'utilisation**.)
- **Changer le design ou le code** : modifier les fichiers puis relancer l'étape 9.
- **Changer le mot de passe admin** : refaire l'étape 7, puis relancer l'étape 9 (nouveau déploiement).

## Sauvegarde
Les produits sont dans la base D1, les photos dans R2. Pour sauvegarder les produits :
```powershell
npx wrangler d1 export quickpara --remote --output=sauvegarde-produits.sql
```
Le fichier `sauvegarde-produits.sql` est créé dans le dossier. À garder ailleurs (clé USB, Drive). **Ne pas le publier sur GitHub.**

## Dépannage

| Symptôme | Cause probable | Que faire |
|---|---|---|
| Le site affiche « Impossible de charger le catalogue » | La base n'est pas reliée | Vérifier que `database_id` est bien rempli dans `wrangler.toml` (étape 4), et que l'étape 4 « Créer les tables » a été faite avec `--remote`. Puis relancer l'étape 9. |
| `/admin` affiche « Admin is not configured » | Les secrets manquent | Refaire les étapes 7 et 8, puis l'étape 9. |
| « Wrong password » alors que le mot de passe est bon | Faute de frappe lors de l'étape 7 | Refaire l'étape 7 puis l'étape 9. |
| « Too many attempts » | 5 erreurs de mot de passe | Attendre 15 minutes. |
| L'envoi d'une photo échoue | Photo trop lourde ou format non supporté | Utiliser une photo JPEG, PNG ou WebP. Elle est réduite automatiquement. |
| Les photos ne s'affichent pas | R2 non activé / bucket absent | Refaire l'étape 5, vérifier le nom `quickpara-photos` dans `wrangler.toml`, puis étape 9. |
| WhatsApp s'ouvre vers un mauvais numéro | Numéro non mis à jour | `/admin` → Settings → corriger le numéro → Save settings. |
| La commande `npx` ou `node` n'est pas reconnue | Node.js absent | Installer Node.js (voir « Ce dont vous avez besoin »), fermer et rouvrir PowerShell. |
| Une commande Wrangler dit « not authenticated » | Session expirée | Refaire l'étape 3. |

## Alternatives si vous ne voulez pas activer R2 (photos)
Le site fonctionne **sans photos** : chaque produit affiche une icône colorée de sa catégorie. Vous pouvez donc déployer d'abord sans R2 (sauter l'étape 5 et retirer le bloc `[[r2_buckets]]` de `wrangler.toml`, puis ne pas ajouter de photos). Demandez-moi si vous voulez une version qui stocke les photos ailleurs.

## Où sont les secrets ?
- `ADMIN_PASSWORD` et `SESSION_SECRET` : stockés **uniquement** chez Cloudflare (étapes 7 et 8). Ils ne sont **pas** dans ce dépôt GitHub.
- Le fichier `.dev.vars` (mot de passe de test local) n'est **jamais** publié (il est exclu par `.gitignore`).
