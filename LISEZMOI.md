# MesListes

Application web de listes (citations, livres… et bientôt films, restaurants, voyages),
utilisable sur ordinateur et installable sur Android.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page |
| `style.css` | Apparence (dont la version téléphone) |
| `app.js` | Logique de l'application ; les natures de listes sont décrites dans `NATURES` |
| `synchro.js` | Synchronisation entre appareils (Firebase) |
| `firebase-config.js` | Paramètres de votre projet Firebase |
| `manifest.webmanifest`, `service-worker.js`, `icones/` | Installation sur téléphone et fonctionnement hors connexion |

**À chaque modification de l'application**, augmenter le numéro `VERSION` dans `service-worker.js`
pour que les téléphones récupèrent la nouvelle version.

## Mise en place de la synchronisation (Firebase)

1. Aller sur https://console.firebase.google.com et se connecter avec son compte Google.
2. **Créer un projet** nommé `MesListes`. Google Analytics peut être désactivé.
3. Dans le projet, cliquer sur l'icône **Web `</>`** (« Ajouter une application »), la nommer `MesListes`,
   ne pas cocher Firebase Hosting, puis valider. Firebase affiche un bloc `const firebaseConfig = { … }` :
   recopier ces valeurs dans `firebase-config.js`.
4. Menu **Build → Authentication** → *Commencer* → onglet *Mode de connexion* → activer **Google**.
5. Toujours dans Authentication → onglet **Paramètres → Domaines autorisés** → *Ajouter un domaine* :
   `thierrypoyatos-maker.github.io`
6. Menu **Build → Firestore Database** → *Créer une base de données* → emplacement `eur3 (europe)` →
   démarrer en **mode production**.
7. Dans Firestore, onglet **Règles**, remplacer tout le contenu par ce qui suit, puis *Publier* :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /utilisateurs/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Cette règle garantit que chacun ne peut lire et modifier que ses propres listes.

## Utilisation

- Ouvrir l'adresse GitHub Pages dans Chrome (PC ou téléphone).
- Menu ⋮ → **Se connecter pour synchroniser** (compte Google).
- Sur Android : menu de Chrome ⋮ → **Installer l'application** / **Ajouter à l'écran d'accueil**.
- Ouvert directement en double-cliquant `index.html`, l'application marche mais sans synchronisation.

Remarque : si la même liste est modifiée sur deux appareils **hors connexion en même temps**,
la dernière version envoyée l'emporte.
