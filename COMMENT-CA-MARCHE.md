# Comment fonctionne le site QuickPara

Petit guide pour comprendre **où se trouve quoi** : GitHub, Cloudflare, le nom de domaine, WhatsApp.
Pas besoin de savoir coder. Pour l'utilisation de tous les jours, voir le **Manuel d'utilisation**.

---

## En une image

```
   Un client tape quickpara.ma
              │
              ▼
   ┌──────────────────────┐
   │  Nom de domaine      │  quickpara.ma (acheté chez Nindohost)
   │  = l'adresse         │  renvoie vers Cloudflare
   └──────────┬───────────┘
              ▼
   ┌──────────────────────────────────────────────┐
   │  CLOUDFLARE  = la maison où vit le site       │
   │                                               │
   │   • Le site et la console /admin              │
   │   • La base de données : produits,            │
   │     catégories, zones, réglages, commandes    │
   │   • Les photos des produits                   │
   │   • Le mot de passe de la console             │
   └──────────┬────────────────────────────────────┘
              ▼
   Le client clique « Commander »
              │
              ▼
   ┌──────────────────────┐
   │  WhatsApp Business   │  la commande arrive sur votre téléphone
   └──────────────────────┘


   À côté, sans lien direct avec le site en ligne :

   ┌──────────────────────┐
   │  GITHUB              │  = les plans de la maison (le code)
   │                      │  copie de sauvegarde, pour le technicien
   └──────────────────────┘
```

---

## Chaque service, en deux phrases

### Le nom de domaine (Nindohost)
C'est **l'adresse** `quickpara.ma`, comme une adresse postale. Elle est louée **à l'année** chez Nindohost ; Nindohost se contente de dire « pour cette adresse, voyez Cloudflare ».
**À retenir :** si le domaine n'est pas renouvelé, le site **et les e-mails @quickpara.ma** s'arrêtent. Mettez un rappel dans votre agenda.

### Cloudflare
C'est **là où le site vit vraiment**. Tout ce que vous voyez et modifiez s'y trouve :
- **le site** et la **console /admin** ;
- **la base de données** : chaque produit, prix, catégorie, zone de livraison, réglage et commande que vous saisissez dans la console ;
- **les photos** que vous envoyez ;
- **le carnet d'adresses du domaine** (les « DNS ») : il dit où envoyer les visiteurs du site et où envoyer les e-mails ;
- **le mot de passe** de la console, rangé dans un coffre (il n'est écrit nulle part ailleurs dans le site).

C'est **gratuit** dans les limites d'une petite boutique. Pour les photos, Cloudflare a demandé une carte bancaire, mais rien n'est facturé tant qu'on reste sous 10 Go (des milliers de photos).

### GitHub
C'est **le classeur des plans** : le code du site (son apparence, le panier, la console…). Le technicien y range chaque nouvelle version.
**Important :** GitHub **ne contient pas** vos produits, vos photos, vos commandes ni le mot de passe. Et modifier GitHub **ne change pas** le site tout seul : une nouvelle version n'apparaît en ligne que quand le technicien la **publie** sur Cloudflare.

### WhatsApp Business
C'est **votre caisse**. Le site ne prend aucun paiement : il prépare un message avec la commande (produits, total, numéro `QP-…`) et l'ouvre dans WhatsApp. C'est vous qui confirmez, livrez et encaissez.
Le numéro qui reçoit les commandes se change dans la console : **Réglages → WhatsApp**.

### Google (facultatif)
Google trouve le site tout seul. Le technicien peut l'inscrire à **Google Search Console** pour suivre les recherches qui amènent des visiteurs. Rien à faire de votre côté.

---

## Qui touche à quoi

| Je veux… | Où ? | Qui ? |
|---|---|---|
| Ajouter un produit, changer un prix, une photo | Console `quickpara.ma/admin` | **Vous** |
| Suivre et mettre à jour les commandes | Console → **Commandes** | **Vous** |
| Changer les zones et frais de livraison | Console → **Livraison** | **Vous** |
| Changer le numéro WhatsApp, les horaires, les réseaux sociaux | Console → **Réglages** | **Vous** |
| Changer l'apparence du site, ajouter une fonction | Code (GitHub) puis publication sur Cloudflare | Le technicien |
| Changer le mot de passe de la console | Cloudflare | Le technicien |
| Renouveler le domaine | Nindohost | **Vous** (ou le technicien), une fois par an |
| Faire une sauvegarde des produits | Cloudflare | Le technicien |

**Ce que vous faites dans la console est en ligne immédiatement.** Pas besoin de GitHub, pas besoin du technicien.

---

## Et si… ?

| Situation | Conséquence |
|---|---|
| GitHub est en panne ou disparaît | **Rien** pour le site : il continue de tourner. Seul le technicien ne peut plus publier de nouvelle version. |
| Cloudflare est en panne | Le site est inaccessible le temps de la panne (rare et courte). Rien n'est perdu. |
| Le domaine expire | Le site et les e-mails @quickpara.ma s'arrêtent. Renouveler chez Nindohost les rétablit. |
| Vous changez de téléphone | Rien à faire, tant que le numéro WhatsApp reste le même. |
| Vous changez de numéro WhatsApp | Le mettre à jour dans **Réglages**, sinon les commandes partent vers l'ancien. |
| Vous oubliez le mot de passe | Le technicien en crée un nouveau dans Cloudflare. Vos produits ne bougent pas. |
| Le technicien n'est plus disponible | Le site continue de fonctionner et vous gardez la main sur la console. Il faudra quelqu'un seulement pour modifier le code. Le **Guide de déploiement** explique tout à un autre technicien. |

---

## Les comptes à garder en lieu sûr

1. **Le mot de passe de la console** (dans un gestionnaire de mots de passe, jamais par message).
2. **Le compte Nindohost** (pour renouveler le domaine).
3. **Le compte Cloudflare** et **le compte GitHub** : gérés par le technicien. Demandez-lui de noter avec vous à qui appartient chaque compte, pour ne jamais perdre l'accès.
