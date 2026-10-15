/* =========================================================
   MesListes — synchronisation entre appareils (Firebase)
   ---------------------------------------------------------
   - Connexion avec un compte Google (Firebase Authentication).
   - Les listes sont rangées dans Firestore (base de données en
     ligne de Google), dans un document par utilisateur :
       utilisateurs/{identifiant}  →  { contenu: "<toutes les listes en JSON>", modifieLe }
   - Chaque modification est envoyée ; chaque modification faite
     sur un autre appareil arrive ici en direct.
   - Sans connexion internet, les modifications sont gardées et
     envoyées dès le retour du réseau.
   Ce fichier ne fait rien tant que firebase-config.js est vide.
   ========================================================= */

import { firebaseConfig } from "./firebase-config.js";

const appli = window.MesListes;
const VERSION_FIREBASE = "10.14.1";

if (firebaseConfig && firebaseConfig.apiKey) {
  demarrer().catch(e => {
    console.error("Synchronisation :", e);
    appli.etatSynchro("erreur");
  });
} else {
  appli.etatSynchro("non-configuree");
}

async function demarrer() {
  // Chargement des bibliothèques Firebase depuis les serveurs de Google
  const base = `https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/`;
  const [FA, A, F] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-auth.js"),
    import(base + "firebase-firestore.js"),
  ]);

  const app = FA.initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  auth.languageCode = "fr";
  const db = F.initializeFirestore(app, {
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
  });

  let reference = null;        // le document de l'utilisateur connecté
  let arreterEcoute = null;    // pour arrêter l'écoute à la déconnexion
  let decisionPrise = false;   // vrai une fois la première synchronisation réglée
  let minuteurEnvoi = null;

  /* --- Connexion / déconnexion --- */
  appli.connecter = async () => {
    const fournisseur = new A.GoogleAuthProvider();
    fournisseur.setCustomParameters({ prompt: "select_account" });
    try {
      await A.signInWithPopup(auth, fournisseur);
    } catch (e) {
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(e.code)) {
        await A.signInWithRedirect(auth, fournisseur);
      } else if (!["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(e.code)) {
        console.error(e);
        alert("Connexion impossible : " + (e.code || e.message));
      }
    }
  };
  appli.deconnecter = () => A.signOut(auth);
  A.getRedirectResult(auth).catch(e => console.warn(e));

  /* --- Envoi des modifications (regroupées sur une demi-seconde) --- */
  function envoyer(donnees) {
    if (!reference || !decisionPrise) return;
    clearTimeout(minuteurEnvoi);
    const contenu = JSON.stringify(donnees);
    minuteurEnvoi = setTimeout(() => {
      F.setDoc(reference, { contenu, modifieLe: F.serverTimestamp() })
        .catch(e => { console.error(e); appli.etatSynchro("erreur"); });
    }, 500);
  }
  appli.auChangement = envoyer;

  /* --- Suivi de l'utilisateur connecté --- */
  A.onAuthStateChanged(auth, utilisateur => {
    if (arreterEcoute) arreterEcoute();
    arreterEcoute = null;
    reference = null;
    decisionPrise = false;

    if (!utilisateur) { appli.etatSynchro("deconnecte"); return; }

    const courriel = utilisateur.email;
    const cleAppareil = "mesListes.synchro." + utilisateur.uid;
    appli.etatSynchro("connexion", courriel);
    reference = F.doc(db, "utilisateurs", utilisateur.uid);

    arreterEcoute = F.onSnapshot(reference, { includeMetadataChanges: true }, instantane => {
      const enLigne = !instantane.metadata.fromCache;

      // Modification de cet appareil pas encore arrivée au serveur
      if (instantane.metadata.hasPendingWrites) {
        appli.etatSynchro(enLigne ? "envoi" : "hors-ligne", courriel);
        return;
      }

      // Première fois : on attend la réponse du serveur pour décider
      if (!decisionPrise) {
        if (!enLigne) { appli.etatSynchro("hors-ligne", courriel); return; }
        decisionPrise = true;
        const dejaSynchronise = localStorage.getItem(cleAppareil) === "1";
        localStorage.setItem(cleAppareil, "1");

        if (!instantane.exists()) {
          // Compte vide : on y envoie les listes de cet appareil
          envoyer(appli.obtenirDonnees());
          appli.etatSynchro("synchronise", courriel);
          appli.notifier("Vos listes sont maintenant enregistrées sur votre compte");
          return;
        }
        if (!dejaSynchronise) {
          const utiliserCompte = confirm(
            "Votre compte contient déjà des listes.\n\n" +
            "OK : utiliser les listes du compte sur cet appareil (celles de cet appareil seront remplacées).\n" +
            "Annuler : garder les listes de cet appareil et les envoyer sur le compte.");
          if (!utiliserCompte) {
            envoyer(appli.obtenirDonnees());
            appli.etatSynchro("synchronise", courriel);
            return;
          }
        }
      }

      // Une version (éventuellement venue d'un autre appareil) est arrivée
      if (instantane.exists()) {
        const contenu = instantane.data().contenu;
        if (contenu && contenu !== JSON.stringify(appli.obtenirDonnees())) {
          try { appli.remplacerDonnees(JSON.parse(contenu)); }
          catch (e) { console.error("Contenu reçu illisible", e); }
        }
      }
      appli.etatSynchro(enLigne ? "synchronise" : "hors-ligne", courriel);
    }, e => {
      console.error(e);
      appli.etatSynchro("erreur", courriel);
    });
  });
}
