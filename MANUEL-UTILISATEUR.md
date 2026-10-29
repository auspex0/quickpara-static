# Manuel d'utilisation — QuickPara

*Pour la personne qui gère la boutique. Aucune connaissance technique n'est nécessaire.*

*Pour savoir où vit le site (Cloudflare, GitHub, nom de domaine, WhatsApp), voir le petit guide [Comment ça marche](COMMENT-CA-MARCHE.md).*

---

## 1. En deux mots : comment ça marche

QuickPara est une **vitrine** sur Internet (quickpara.ma) :

1. Vos clients regardent vos produits et les ajoutent à leur **panier**.
2. Ils choisissent leur **zone de livraison** (si vous en avez créé) et voient le total.
3. Ils appuient sur **« Commander sur WhatsApp »**. La commande est **enregistrée avec un numéro** (par exemple **QP-1042**) et WhatsApp s'ouvre avec un **message déjà écrit** qui contient ce numéro.
4. **Vous recevez le message sur votre WhatsApp Business**, vous confirmez, et vous suivez la commande dans l'onglet **Commandes** de la console.

**Il n'y a pas de paiement sur le site et pas de gestion de stock.** Tout se règle par WhatsApp, comme avec un client en boutique.

Vos clients peuvent aussi vous écrire librement (question, produit introuvable) avec le bouton vert WhatsApp en bas à droite du site.

Le site a **deux faces** :
- **Le site public** : ce que voient vos clients → `https://quickpara.ma`
- **La console d'administration** : votre « arrière-boutique » → `https://quickpara.ma/admin`

---

## 2. Ce que vous devez garder précieusement

| Quoi | Pourquoi |
|---|---|
| **Le mot de passe de la console** | Sans lui, impossible de gérer la boutique. Notez-le dans un endroit sûr. Ne le donnez à personne que vous ne connaissez pas bien. |
| **L'adresse de la console** : `quickpara.ma/admin` | Ajoutez-la à vos favoris, sur ordinateur et téléphone. |
| **Le numéro de la personne qui a installé le site** | Pour toute panne ou mot de passe oublié (voir §14). |

---

## 3. Se connecter à la console

1. Ouvrez votre navigateur (Chrome, Safari, Edge…) sur **quickpara.ma/admin**.
2. Saisissez votre **mot de passe** → bouton **Se connecter**.
3. Vous arrivez sur l'onglet **Commandes**.

Bon à savoir :
- Vous restez connecté **7 jours** sur cet appareil. Sur un ordinateur partagé, cliquez sur **Se déconnecter** (en haut à droite) quand vous avez fini.
- Après **5 mots de passe faux**, la console se bloque **15 minutes**. Attendez, puis réessayez calmement.
- La console fonctionne aussi sur **téléphone**.
- **Voir le site ↗** (en haut) ouvre votre site tel que le voient les clients.

---

## 4. Les cinq onglets

| Onglet | À quoi il sert |
|---|---|
| **Commandes** | Suivre chaque commande : nouvelle, confirmée, livrée ou annulée |
| **Produits** | Ajouter, modifier, cacher, supprimer vos produits ; choisir leur ordre |
| **Catégories** | Les rayons du site : Visage, Bébé & maman, Hygiène… |
| **Livraison** | Vos zones de livraison, leurs tarifs, la livraison gratuite et la commande minimum |
| **Réglages** | Votre numéro WhatsApp, le nom du magasin, les horaires, vos réseaux sociaux |

Le petit chiffre rouge à côté de **Commandes** indique le nombre de commandes **nouvelles** à traiter.

---

## 5. Les commandes (onglet Commandes)

### 5.1 Ce qu'est une commande « Nouvelle »
Une commande est enregistrée **dès que le client appuie sur « Commander sur WhatsApp »**. À ce moment, WhatsApp s'ouvre chez lui avec le message prêt, mais **il doit encore appuyer sur Envoyer**.

Donc certaines commandes resteront **« Nouvelle (en attente WhatsApp) »** sans message reçu : le client a changé d'avis ou n'a pas envoyé. C'est normal.

### 5.2 Le bon réflexe quand un message arrive
1. Le message WhatsApp commence par : *« Bonjour QuickPara, je souhaite commander (commande **QP-1042**) »*.
2. Dans l'onglet **Commandes**, tapez **QP-1042** dans la recherche (ou le nom du client).
3. Ouvrez la commande (cliquez dessus) : vous voyez les produits, les prix, la zone, le total et les précisions du client.
4. Quand vous avez confirmé avec le client, changez le statut en **Confirmée**. Une fois livrée : **Livrée**. Si elle n'aboutit pas : **Annulée**.

Les quatre statuts :

| Statut | Signification |
|---|---|
| **Nouvelle (en attente WhatsApp)** | Le client a cliqué. Le message n'est peut-être pas encore arrivé. |
| **Confirmée** | Vous avez confirmé avec le client par WhatsApp. |
| **Livrée** | La commande a été remise. |
| **Annulée** | Commande abandonnée, refusée ou jamais envoyée. |

Bon à savoir :
- Les **prix d'une commande ne changent jamais**, même si vous modifiez ensuite le produit : la commande garde le prix et le nom du moment de la commande.
- Les commandes **ne peuvent pas être supprimées** (c'est voulu, pour garder un historique honnête). Utilisez **Annulée**.
- Le menu déroulant au-dessus de la liste filtre par statut (avec le nombre de commandes pour chacun).
- **Afficher plus de commandes** en bas de la liste montre les plus anciennes.
- Un même client qui clique deux fois crée deux commandes : annulez celle en trop.

---

## 6. Gérer les produits (onglet Produits)

### 6.1 Ajouter un produit
1. Cliquez sur **+ Nouveau produit**.
2. Remplissez la fenêtre :
   - **Choisir une photo** : facultatif, voir §7.
   - **Nom** : **obligatoire**. Exemple : *Crème hydratante visage SPF 50*
   - **Marque** : facultatif. En tapant, la console propose les marques déjà utilisées : choisissez-les pour éviter d'écrire la même marque de deux façons.
   - **Prix (MAD)** : **obligatoire**. Des chiffres seulement. Exemple : `169` ou `89.5`
   - **Ancien prix (barré, facultatif)** : pour une promotion, voir §6.3.
   - **Catégorie** : le rayon.
   - **Description courte** : une ligne utile au client. Exemple : *Protection solaire quotidienne, 50 ml*
   - **Visible sur le site** : laissez coché pour que le client le voie tout de suite.
   - **Afficher le badge « Nouveau »** et **Mettre à la une (affiché en premier)** : voir §6.3 et §6.4.
3. Cliquez sur **Enregistrer**.

Le produit apparaît sur le site **en quelques secondes** (rechargez la page du site si besoin).

### 6.2 Modifier, cacher, supprimer
Sur la ligne du produit :
- **Crayon** : modifier (prix, nom, photo…) puis **Enregistrer**.
- **Interrupteur vert / gris** : **vert** = visible par les clients, **gris** = caché. Le produit reste dans votre console. C'est la bonne méthode pour un produit **en rupture** : cachez-le, réactivez-le au réapprovisionnement.
- **Corbeille rouge** : suppression **définitive** (photo comprise). En cas de doute, **cachez** plutôt que supprimer.

### 6.3 Promotions et badge « Nouveau »
- **Promotion** : dans **Ancien prix (barré, facultatif)**, mettez le prix d'avant. Le site affiche l'ancien prix barré et un badge rouge **« -20 % »** calculé automatiquement. L'ancien prix doit être **plus élevé** que le prix actuel, sinon la console refuse.
- **Fin de la promotion** : videz le champ **Ancien prix**, puis **Enregistrer**.
- **Badge « Nouveau »** : cochez **Afficher le badge « Nouveau »**. Décochez-le quand le produit n'est plus une nouveauté.
- Dans la liste de la console, ces produits portent les étiquettes **Promo** et **Nouveau**.

### 6.4 Ordre d'affichage et produits « à la une »
- **Étoile** : met le produit **à la une**. Les produits à la une s'affichent **toujours en premier** sur le site. Cliquez de nouveau sur l'étoile pour le retirer.
- **Flèches ▲ ▼** : montent ou descendent un produit dans la liste. Le site suit exactement cet ordre.
- Un produit à la une ne peut monter ou descendre que parmi les autres produits à la une (et pareil pour les autres).
- Les flèches sont **grisées pendant une recherche ou un filtre** : effacez la recherche et choisissez « Toutes les catégories » pour réordonner.
- Un **nouveau produit** apparaît **en haut** de la liste.

### 6.5 Retrouver un produit
- Barre de recherche « Rechercher un produit… » : une partie du nom ou de la marque.
- Liste **Toutes les catégories** : filtre par rayon (**Sans catégorie** montre les produits sans rayon).

---

## 7. Les photos

- Formats acceptés : **JPEG, PNG ou WebP**. Une photo de téléphone convient très bien.
- Pas besoin de la réduire : **la console la redimensionne toute seule**.
- Pour une belle photo : **fond clair et uni**, produit au centre, bonne lumière (près d'une fenêtre, sans flash), un seul produit par photo.
- **Changer la photo** : modifiez le produit (crayon) → **Choisir une photo** → **Enregistrer**. L'ancienne est supprimée automatiquement.
- **Enlever la photo** : modifiez le produit → **Retirer la photo** → **Enregistrer**. Le site affiche alors une icône colorée de la catégorie.

---

## 8. Les catégories (onglet Catégories)

Les catégories sont les boutons au-dessus des produits sur le site. Chaque catégorie a aussi **sa propre page**, par exemple `quickpara.ma/c/visage`, que vous pouvez partager (Instagram, WhatsApp) et que Google peut afficher.

- **Ajouter** : tapez le nom, choisissez une **icône**, puis **Ajouter**. L'adresse de la page est créée automatiquement (*Bébé & maman* → `quickpara.ma/c/bebe-maman`).
- **Modifier** : changez le nom, l'icône, l'adresse ou la description sur la ligne, puis **Enregistrer**.
- **Adresse** (champ `quickpara.ma/c/…`) : lettres minuscules sans accent, chiffres et tirets seulement. Si vous renommez une catégorie, **l'adresse ne change pas** (les liens déjà partagés continuent de marcher). Changez-la seulement si nécessaire.
- **Description pour Google** (160 caractères max, facultatif) : une phrase qui présente le rayon. Google peut l'afficher sous le lien de la page. Exemple : *Soins du visage : nettoyants, crèmes, sérums et protection solaire.*
- **Supprimer** (corbeille rouge) : les produits ne sont **pas** supprimés, ils passent en « Sans catégorie ». Rangez-les ensuite dans un autre rayon.
- Deux catégories ne peuvent pas avoir le même nom ni la même adresse.

---

## 9. La livraison (onglet Livraison)

Tant qu'**aucune zone** n'existe, le panier n'affiche pas de frais de livraison (vous les annoncez par WhatsApp). Dès que vous créez une zone, le client **doit choisir sa zone** dans le panier et voit le **sous-total, la livraison et le total**.

### 9.1 Créer une zone
Dans **Nouvelle zone de livraison** :
- **Zone** : par exemple *Casablanca*, *Rabat-Salé*, *Autres villes*.
- **Tarif (MAD)** : le prix de la livraison. Mettez `0` si elle est toujours gratuite.
- **Gratuit dès… (facultatif)** : montant à partir duquel la livraison devient gratuite. Exemple : `300` → livraison gratuite **à partir de 300 MAD** (300 inclus).
- Cliquez sur **Ajouter**.

Le client voit alors par exemple : *« Plus que 25 MAD pour la livraison gratuite »*. Ça l'aide à compléter son panier.

Pour modifier une zone : changez la ligne puis **Enregistrer**. Flèches ▲ ▼ : ordre dans la liste du client. Corbeille : supprimer.

### 9.2 Commande minimum
Champ **Commande minimum** (facultatif) : en dessous de ce montant, le client ne peut pas envoyer sa commande et voit *« Minimum de commande : 100 MAD (il manque 30 MAD) »*. Laissez **vide** pour ne pas fixer de minimum, puis **Enregistrer**.

---

## 10. Les réglages (onglet Réglages)

| Champ | Ce qu'il fait |
|---|---|
| **Numéro WhatsApp (reçoit les commandes)** | **Le numéro qui reçoit les commandes.** Écrivez-le comme d'habitude (`06 12 34 56 78`) : la console le convertit toute seule. |
| **Nom du magasin** | Apparaît au début des messages de commande et dans le titre des pages. |
| **Horaires (affichés en bas du site)** | Exemple : *Lun–Sam, 9h–20h* |
| **Instagram, Facebook, Google Maps, Fiche Google Business** | Facultatif. Collez l'adresse complète de votre page (elle doit commencer par `https://`). Une icône apparaît en bas du site pour chaque réseau rempli. Videz un champ pour retirer l'icône. |

Cliquez sur **Enregistrer les réglages**.

⚠️ **Si vous changez le numéro WhatsApp**, faites **une commande test** juste après (voir §12) pour être sûr que les messages arrivent bien chez vous.

---

## 11. Quand une commande arrive (côté WhatsApp)

Le client vous envoie un message de ce style :

> Bonjour QuickPara, je souhaite commander (commande QP-1042) :
> • 2 × Gel nettoyant purifiant (129 MAD) = 258 MAD
> • 1 × Thermomètre digital (79 MAD) = 79 MAD
> Sous-total : 337 MAD — Zone : Casablanca — Livraison : Gratuite — Total : 337 MAD
> Nom : Sara — Ville / quartier : Rabat Agdal
> Merci de me confirmer la disponibilité et la livraison.

Votre façon de procéder (suggestion) :

1. **Répondre vite** : « Bonjour Sara, merci pour votre commande QP-1042 ! »
2. **Vérifier la disponibilité** des produits.
3. **Confirmer** : produits, total, adresse précise, jour et heure de livraison, mode de paiement (à la livraison, virement…).
4. Dans la console : passez la commande en **Confirmée**, puis **Livrée** une fois remise.

Si le message **n'a pas de numéro** (*« je souhaite commander : »* sans « commande QP-… »), c'est que le site n'a pas pu enregistrer la commande à ce moment-là (problème de connexion par exemple). La commande est valable quand même : traitez-la normalement, elle n'apparaîtra simplement pas dans l'onglet **Commandes**.

Astuce : dans **WhatsApp Business**, enregistrez des **réponses rapides** et utilisez les **étiquettes** (« Nouveau », « À livrer », « Livré »).

---

## 12. Votre routine conseillée

**Au quotidien**
- Répondre aux messages WhatsApp, et mettre à jour le statut dans **Commandes**.
- **Cacher** (interrupteur gris) les produits en rupture ; les réactiver à la livraison du fournisseur.

**Une fois par semaine** (10 minutes)
- Passer en **Annulée** les commandes **Nouvelles** de plus de quelques jours qui n'ont jamais donné de message.
- Ouvrir **quickpara.ma** sur votre téléphone : tout s'affiche ? Les prix et promotions sont à jour ?
- Faire **une commande test** (avec votre propre téléphone) : le message doit arriver sur votre WhatsApp Business avec un numéro **QP-…**. Annulez ensuite cette commande dans la console.

---

## 13. Ce que le site ne fait pas (volontairement)

- Pas de **paiement en ligne** : on s'arrange par WhatsApp.
- Pas de **gestion de stock** : c'est vous qui cachez un produit en rupture.
- Pas de **comptes clients**.
- Les commandes ne sont pas « confirmées » automatiquement : c'est vous qui confirmez par WhatsApp.

---

## 14. En cas de problème

| Ce que vous voyez | Ce qu'il faut faire |
|---|---|
| **« Mot de passe incorrect »** | Vérifiez le clavier (majuscules, langue). Après 5 essais, attendez 15 minutes. |
| **J'ai oublié mon mot de passe** | Contactez la personne qui a installé le site : elle peut le remplacer en 5 minutes. Il n'y a pas de bouton « mot de passe oublié » (c'est voulu, pour la sécurité). |
| **Mon produit n'apparaît pas sur le site** | Vérifiez que l'interrupteur est **vert**. Rechargez la page du site (sur téléphone : fermez et rouvrez le navigateur). |
| **« L'ancien prix doit être supérieur au prix actuel »** | Pour une promo, l'ancien prix doit être plus élevé que le prix. Sinon, videz le champ Ancien prix. |
| **Les flèches ▲ ▼ sont grisées** | Effacez la recherche et choisissez « Toutes les catégories ». |
| **La photo ne s'envoie pas** | Utilisez une photo JPEG, PNG ou WebP. Essayez une autre photo ; sinon, enregistrez le produit sans photo et réessayez plus tard. |
| **Une commande « Nouvelle » sans message reçu** | Normal : le client n'a pas envoyé le message. Passez-la en **Annulée** après quelques jours. |
| **Un message de commande sans numéro QP-…** | Le site n'a pas pu l'enregistrer à ce moment-là. Traitez-la normalement par WhatsApp. Si ça arrive souvent, prévenez la personne qui gère la technique. |
| **Un client dit « le bouton Commander ne marche pas »** | Demandez-lui s'il voit un message dans le panier (zone à choisir, minimum de commande). Sinon, prévenez la personne qui gère la technique avec une capture d'écran. |
| **Le site affiche « Impossible de charger le catalogue »** | Rechargez la page. Si ça dure plus de quelques minutes, prévenez la personne qui gère la technique. |
| **Les commandes arrivent sur un mauvais numéro** | **Réglages** → corrigez **Numéro WhatsApp** → **Enregistrer les réglages** → faites une commande test. |
| **« Votre session a expiré »** | Normal après 7 jours : reconnectez-vous. |

**Avant d'appeler à l'aide**, notez : ce que vous faisiez, ce qui s'affichait (une capture d'écran aide beaucoup), et sur quel appareil.

---

## 15. Sécurité : les bonnes habitudes

- **Ne donnez jamais** votre mot de passe par message ou par téléphone, même à quelqu'un qui prétend travailler pour Cloudflare, WhatsApp ou l'hébergeur.
- Pensez à **vous déconnecter** sur un appareil qui n'est pas le vôtre.
- Si vous pensez que quelqu'un connaît votre mot de passe : prévenez immédiatement la personne qui gère la technique.
- Les commandes contiennent des **noms et villes de clients** : ne faites pas de captures d'écran de la console sur les réseaux sociaux.

---

## 16. Les coûts

- Le site (hébergement, base de données, photos) : **gratuit** tant que l'activité reste raisonnable, ce qui est le cas d'une boutique de cette taille.
- Le nom **quickpara.ma** : à **renouveler une fois par an** auprès de votre registrar. **Mettez un rappel dans votre agenda** : si le domaine expire, le site disparaît.
- WhatsApp Business : gratuit.

---

## 17. Mini-lexique

| Mot | Signification |
|---|---|
| **Console / admin** | La partie privée du site où vous gérez la boutique |
| **Commande QP-…** | Le numéro unique de chaque commande, visible dans le message WhatsApp et dans l'onglet Commandes |
| **Catégorie** | Un rayon (Visage, Bébé…), avec sa propre page `quickpara.ma/c/…` |
| **À la une** | Produit affiché en premier sur le site |
| **Visible / caché** | Affiché ou non aux clients |
| **Zone de livraison** | Une ville ou un secteur, avec son tarif |
| **MAD** | Dirham marocain |
| **WhatsApp Business** | L'application WhatsApp pour les professionnels (gratuite) |
| **Domaine** | L'adresse du site (quickpara.ma) |

---

## 18. Rappel important sur ce que vous vendez

Ce site est conçu pour la **parapharmacie et les produits paramédicaux**. La vente de **médicaments** est réglementée au Maroc et réservée aux pharmaciens autorisés. En cas de doute sur un produit, renseignez-vous **avant** de le proposer. Évitez aussi de promettre des effets médicaux dans les descriptions : restez factuel (contenance, usage, type de peau).
