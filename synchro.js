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
  let pret = false;            // vrai une fois la version du compte reçue et fusionnée
  let minuteurEnvoi = null;
  let contenuEnAttente = null; // modification pas encore envoyée

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

  // Ce qui est envoyé au compte : les listes et les suppressions
  // (la vue et la liste affichée restent propres à chaque appareil)
  const contenuDe = d => JSON.stringify({ version: d.version || 1, listes: d.listes, supprimes: d.supprimes || {} });

  /* --- Envoi des modifications (regroupées sur 0,3 seconde) ---
     Tant que la version du compte n'est pas arrivée (démarrage, réseau
     faible), on n'envoie rien : la modification reste sur l'appareil et
     sera fusionnée puis envoyée dès que le compte répond. */
  function envoyer(donnees, immediat = false) {
    if (!reference || !pret) return;
    clearTimeout(minuteurEnvoi);
    contenuEnAttente = contenuDe(donnees);
    if (immediat) envoyerMaintenant();
    else minuteurEnvoi = setTimeout(envoyerMaintenant, 300);
  }
  function envoyerMaintenant() {
    clearTimeout(minuteurEnvoi);
    if (!contenuEnAttente || !reference) return;
    const contenu = contenuEnAttente;
    contenuEnAttente = null;
    F.setDoc(reference, { contenu, modifieLe: F.serverTimestamp() })
      .catch(e => { console.error(e); appli.etatSynchro("erreur"); });
  }
  appli.auChangement = d => envoyer(d);
  // Application mise en arrière-plan ou fermée : on envoie tout de suite
  document.addEventListener("visibilitychange", () => { if (document.hidden) envoyerMaintenant(); });
  addEventListener("pagehide", envoyerMaintenant);

  /* --- Suivi de l'utilisateur connecté --- */
  A.onAuthStateChanged(auth, utilisateur => {
    envoyerMaintenant();          // dernière modification du compte précédent
    if (arreterEcoute) arreterEcoute();
    arreterEcoute = null;
    reference = null;
    pret = false;

    // Affiche les listes de ce compte (chaque compte a les siennes sur l'appareil)
    appli.changerUtilisateur(utilisateur ? utilisateur.uid : null,
      utilisateur ? { nom: utilisateur.displayName, courriel: utilisateur.email } : {});

    if (!utilisateur) { appli.etatSynchro("deconnecte"); return; }

    const courriel = utilisateur.email;
    appli.etatSynchro("connexion", courriel);
    reference = F.doc(db, "utilisateurs", utilisateur.uid);

    arreterEcoute = F.onSnapshot(reference, { includeMetadataChanges: true }, instantane => {
      const enLigne = !instantane.metadata.fromCache;

      // Modification de cet appareil pas encore arrivée au serveur
      if (instantane.metadata.hasPendingWrites) {
        appli.etatSynchro(enLigne ? "envoi" : "hors-ligne", courriel);
        return;
      }
      // Au démarrage, on attend la vraie version du serveur (pas la copie en cache)
      if (!pret && !enLigne) { appli.etatSynchro("hors-ligne", courriel); return; }

      const premiere = !pret;
      pret = true;
      const locales = appli.obtenirDonnees();

      if (!instantane.exists()) {
        // Compte vide : on y envoie les listes de cet appareil
        envoyer(locales, true);
        appli.etatSynchro("synchronise", courriel);
        if (premiere) appli.notifier("Vos listes sont maintenant enregistrées sur votre compte");
        return;
      }

      let distantes;
      try { distantes = JSON.parse(instantane.data().contenu); }
      catch (e) { console.error("Contenu reçu illisible", e); appli.etatSynchro("erreur", courriel); return; }

      // Appareil neuf (seulement les citations d'exemple) : on prend le compte tel quel.
      // Sinon : fusion, rien n'est perdu d'un côté comme de l'autre.
      const fusion = locales.exemple ? distantes : appli.fusionner(locales, distantes);
      if (contenuDe(fusion) !== contenuDe(locales)) appli.remplacerDonnees(fusion);
      if (contenuDe(fusion) !== contenuDe(distantes)) envoyer(appli.obtenirDonnees(), true);

      appli.etatSynchro(enLigne ? "synchronise" : "hors-ligne", courriel);
    }, e => {
      console.error(e);
      appli.etatSynchro("erreur", courriel);
    });
  });
}
