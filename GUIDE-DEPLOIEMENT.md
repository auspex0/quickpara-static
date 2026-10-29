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

> **Si vous utilisez une adresse e-mail @quickpara.ma, lisez l'encadré « Ne pas casser les e-mails » ci-dessous AVANT de changer les serveurs de noms.**

### a) Le plus simple : confier le domaine à Cloudflare
1. https://dash.cloudflare.com (compte qui contient le projet `quickpara`) → **Add a domain** (ou « Ajouter un site ») → saisir `quickpara.ma` → laisser la détection automatique des enregistrements DNS → choisir le plan **Free**.
2. Cloudflare affiche la page **« Review your DNS records »**. **Ne cliquez pas tout de suite sur « Continue »** : comparez cette liste avec celle de votre hébergeur DNS (voir l'encadré ci-dessous), supprimez les anciens enregistrements du site (par exemple vers Vercel) et ajoutez ceux qui manquent. Ensuite seulement : **Continue to activation**.
   - Un message « quickpara.ma is not fully protected » peut s'afficher parce que tous les enregistrements sont en « DNS only ». **C'est normal** : les enregistrements e-mail ne doivent jamais être proxifiés. Cliquer **I'll do this later**.
3. Cloudflare affiche **deux serveurs de noms** (par exemple `xxx.ns.cloudflare.com`). Les noter.
4. Aller chez le **registrar / hébergeur DNS** où vous avez acheté quickpara.ma → section **Serveurs DNS / Nameservers** → choisir « serveurs de noms personnalisés » → saisir les deux serveurs de Cloudflare, **vider les autres champs** → enregistrer. (Si une option **DNSSEC** est activée chez eux, la désactiver d'abord.)
5. Dans Cloudflare, cliquer **Check nameservers now**. Attendre que le domaine soit « Active » (quelques minutes à 24 h, parfois 48 h ; un e-mail de confirmation arrive).
6. Ensuite : Cloudflare → **Workers & Pages** → cliquer le projet **quickpara** (il porte l'étiquette *Pages* ; **ne pas créer de Worker**) → onglet **Custom domains** → **Set up a custom domain** → `quickpara.ma` → **Activate domain**. Refaire pour `www.quickpara.ma`.
7. Le certificat HTTPS (cadenas) est créé automatiquement : état « Initializing » pendant quelques minutes, puis « Active ».

> Testé avec un domaine `.ma` dont le DNS était chez Nindohost : le transfert des serveurs de noms vers Cloudflare fonctionne. Si votre registrar refuse, utilisez en attendant `quickpara.pages.dev`.

#### Ne pas casser les e-mails (important)
Les e-mails @quickpara.ma dépendent d'enregistrements DNS que Cloudflare **ne détecte pas toujours** à l'import. Avant de changer les serveurs de noms :

1. Ouvrir la liste des enregistrements chez l'ancien hébergeur DNS (capture d'écran).
2. Vérifier que **chacun** se retrouve dans Cloudflare : `MX`, les `A` des serveurs de messagerie (par exemple `forward`, `mail`), les `TXT` (SPF, DKIM, DMARC).
3. Ajouter à la main ce qui manque, avec **Proxy status = DNS only (nuage gris)** pour **tous** les enregistrements e-mail. Un enregistrement e-mail proxifié (nuage orange) casse la réception.
4. Exemple vécu : l'import avait oublié l'enregistrement `A` du serveur de messagerie (`forward`) et la clé **DKIM** (`default._domainkey`, un `TXT` d'environ 400 caractères). Sans le premier, plus de courrier reçu ; sans le second, le courrier envoyé finit plus souvent en spam.
5. Valeur exacte d'un enregistrement chez l'ancien hébergeur (sans recopier à la main), dans PowerShell :
   ```powershell
   Resolve-DnsName -Name default._domainkey.quickpara.ma -Type TXT -Server ns1.nindohost.net | ForEach-Object { $_.Strings -join '' }
   ```
   (remplacer le nom et le serveur). **À faire avant** le changement de serveurs de noms.
6. Après le changement, comparer : même commande avec `-Server` = l'un des deux serveurs Cloudflare. Les valeurs doivent être **identiques**.
7. Envoyer un e-mail de test **vers** et **depuis** l'adresse @quickpara.ma.

**À savoir :** si le domaine a **deux enregistrements SPF** (`v=spf1 …` deux fois), c'est invalide et peut faire rejeter du courrier. Ne pas régler ça pendant la migration ; fusionner en un seul enregistrement une fois que tout fonctionne.

### b) Seulement un sous-domaine (`www`)
Si vous ne pouvez pas changer les serveurs de noms : chez votre registrar, créer un enregistrement **CNAME** `www` pointant vers `quickpara.pages.dev`, puis ajouter `www.quickpara.ma` dans **Custom domains** (étape 11-a-6). Le domaine « nu » (`quickpara.ma` sans `www`) ne fonctionnera alors pas sans Cloudflare comme serveur DNS.

## Étape 12 — Dernière vérification
Ouvrir **https://quickpara.ma**, **https://www.quickpara.ma** et **https://quickpara.ma/admin** sur ordinateur **et** sur téléphone, passer une commande test complète, puis supprimer le produit de test si besoin.

**Si une adresse « ne se trouve pas » alors que l'autre fonctionne** : c'est presque toujours le cache DNS de votre ordinateur ou de votre box, qui a mémorisé l'ancienne réponse « ce nom n'existe pas ». Le site, lui, est en ligne.
- Tester depuis le téléphone en **4G/5G** (Wi-Fi coupé) : si ça marche, c'est bien un cache local.
- Vider le cache de l'ordinateur :

  **Windows (PowerShell)**
  ```powershell
  ipconfig /flushdns
  ```

  **Mac (Terminal)** : le mot de passe du Mac est demandé ; rien ne s'affiche pendant la saisie, c'est normal.
  ```bash
  sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
  ```

  **Navigateur**
  - Chrome : ouvrir `chrome://net-internals/#dns` → **Clear host cache**.
  - Safari : pas de cache DNS séparé ; quitter complètement Safari (⌘Q) puis le rouvrir.
- Sinon, redémarrer la box, ou faire utiliser à l'ordinateur le DNS de Cloudflare (`1.1.1.1` et `1.0.0.1`) :
  - **Windows** : Paramètres → Réseau et Internet → Wi-Fi (ou Ethernet) → Propriétés du matériel → **Attribution du serveur DNS** → Modifier → Manuel → IPv4 → saisir `1.1.1.1` et `1.0.0.1`.
  - **Mac** : Réglages Système → Réseau → Wi-Fi → **Détails…** → **DNS** → bouton **+** → ajouter `1.1.1.1` et `1.0.0.1` → **OK**. Ou dans le Terminal :
    ```bash
    networksetup -setdnsservers Wi-Fi 1.1.1.1 1.0.0.1
    ```
    Pour revenir en arrière :
    ```bash
    networksetup -setdnsservers Wi-Fi empty
    ```
- Pour vérifier ce que voit le Mac : `dig +short www.quickpara.ma` doit afficher des adresses Cloudflare (par exemple `188.114.96.3`). Une réponse vide signifie que l'ancien cache est toujours là.
- Ça se résout seul au bout de quelques heures au plus.

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
