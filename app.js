"use strict";

/* =========================================================
   MesListes — logique de l'application
   ---------------------------------------------------------
   Principe général :
   1. NATURES décrit chaque nature de liste (ses champs, ses tris,
      sa façon de s'afficher).
   2. Les données (toutes les listes et leurs éléments) sont gardées
      dans la variable "donnees" et enregistrées dans le stockage
      local du navigateur (localStorage) à chaque modification.
   3. La fonction afficherTout() redessine l'écran à partir des données.
   ========================================================= */


/* ---------- 1. Les natures de listes ----------
   Le formulaire de saisie est construit automatiquement à partir
   de la liste "champs". Types de champ possibles :
     - "texte"       : une ligne
     - "texte-long"  : plusieurs lignes
     - "tags"        : mots séparés par des virgules
     - "choix"       : liste déroulante (voir "options")
   Pour ajouter une nature, il suffit d'ajouter une entrée ici. */

const NATURES = {

  /* ----- Citations ----- */
  citations: {
    libelle: "Citations",
    singulier: "citation",
    pluriel: "citations",
    feminin: true,
    champs: [
      { cle: "texte",  libelle: "Citation", type: "texte-long", lignes: 4, obligatoire: true,
        placeholder: "Le texte de la citation…" },
      { cle: "auteur", libelle: "Auteur", type: "texte", placeholder: "ex. Montaigne",
        chercherAuteurDe: "texte" },   // bouton « Trouver l'auteur » à partir du champ texte
      { cle: "source", libelle: "Source", type: "texte", placeholder: "Livre, film, discours, chanson…" },
      { cle: "annee",  libelle: "Année ou époque", type: "texte", placeholder: "ex. 1580" },
      { cle: "tags",   libelle: "Thèmes", type: "tags", placeholder: "amitié, sagesse…",
        aide: "Séparez les thèmes par des virgules." },
      { cle: "notes",  libelle: "Notes personnelles", type: "texte-long", lignes: 2,
        placeholder: "Où vous l'avez lue, ce qu'elle vous inspire…" },
    ],
    champsRecherche: ["texte", "auteur", "source", "annee", "notes", "tags"],
    tris: {
      recent: { libelle: "Ajoutées récemment", comparer: (a, b) => b.creeLe - a.creeLe },
      auteur: { libelle: "Auteur (A → Z)",    comparer: (a, b) => comparerTexte(a.auteur, b.auteur) || comparerTexte(a.texte, b.texte) },
      texte:  { libelle: "Citation (A → Z)",  comparer: (a, b) => comparerTexte(a.texte, b.texte) },
    },
    afficher(el) {
      let attribution = "";
      if (el.auteur) attribution += echapper(el.auteur);
      if (el.source) attribution += (attribution ? ", " : "") + `<cite>${echapper(el.source)}</cite>`;
      if (el.annee)  attribution += ` (${echapper(el.annee)})`;
      return `
        <blockquote class="citation">${echapper(el.texte)}</blockquote>
        ${attribution ? `<p class="attribution">— ${attribution}</p>` : ""}
        ${afficherTags(el.tags)}
        ${el.notes ? `<p class="notes">${echapper(el.notes)}</p>` : ""}`;
    },
    enTexte(el) {
      let t = `« ${el.texte} »`;
      const ref = [el.auteur, el.source].filter(Boolean).join(", ");
      if (ref) t += ` — ${ref}`;
      if (el.annee) t += ` (${el.annee})`;
      return t;
    },
  },

  /* ----- Livres à lire ----- */
  livres: {
    libelle: "Livres",
    singulier: "livre",
    pluriel: "livres",
    feminin: false,
    champs: [
      { cle: "titre",  libelle: "Titre", type: "texte", obligatoire: true, placeholder: "ex. Le Comte de Monte-Cristo" },
      { cle: "auteur", libelle: "Auteur", type: "texte", placeholder: "ex. Alexandre Dumas" },
      { cle: "statut", libelle: "Statut", type: "choix", defaut: "a-lire",
        options: { "a-lire": "À lire", "en-cours": "En cours", "lu": "Lu" } },
      { cle: "note",   libelle: "Ma note", type: "choix", defaut: "",
        options: { "": "—", "1": "★", "2": "★★", "3": "★★★", "4": "★★★★", "5": "★★★★★" } },
      { cle: "conseille", libelle: "Conseillé par", type: "texte", placeholder: "Un ami, une émission, un article…" },
      { cle: "tags",   libelle: "Genres", type: "tags", placeholder: "roman, histoire, polar…",
        aide: "Séparez les genres par des virgules." },
      { cle: "notes",  libelle: "Notes / avis", type: "texte-long", lignes: 3 },
    ],
    champsRecherche: ["titre", "auteur", "conseille", "notes", "tags"],
    tris: {
      recent: { libelle: "Ajoutés récemment", comparer: (a, b) => b.creeLe - a.creeLe },
      statut: { libelle: "Statut",            comparer: (a, b) => ordreStatut(a) - ordreStatut(b) || b.creeLe - a.creeLe },
      titre:  { libelle: "Titre (A → Z)",     comparer: (a, b) => comparerTexte(a.titre, b.titre) },
      auteur: { libelle: "Auteur (A → Z)",    comparer: (a, b) => comparerTexte(a.auteur, b.auteur) || comparerTexte(a.titre, b.titre) },
      note:   { libelle: "Mieux notés",       comparer: (a, b) => (Number(b.note) || 0) - (Number(a.note) || 0) },
    },
    afficher(el) {
      const statuts = this.champs.find(c => c.cle === "statut").options;
      const statut = el.statut || "a-lire";
      const note = Number(el.note) || 0;
      return `
        <p class="livre-titre">${echapper(el.titre)}</p>
        ${el.auteur ? `<p class="livre-auteur">${echapper(el.auteur)}</p>` : ""}
        <div class="livre-infos">
          <button class="statut statut-${statut}" data-action="cycle" data-champ="statut"
            title="Changer le statut">${statuts[statut]}</button>
          ${note ? `<span class="etoiles" aria-label="${note} sur 5">${"★".repeat(note)}${"☆".repeat(5 - note)}</span>` : ""}
          ${el.conseille ? `<span>Conseillé par ${echapper(el.conseille)}</span>` : ""}
        </div>
        ${afficherTags(el.tags)}
        ${el.notes ? `<p class="notes">${echapper(el.notes)}</p>` : ""}`;
    },
    enTexte(el) {
      return el.auteur ? `${el.titre} — ${el.auteur}` : el.titre;
    },
  },

  /* ----- Films et séries ----- */
  films: {
    libelle: "Films et séries",
    singulier: "titre",
    pluriel: "titres",
    feminin: false,
    champs: [
      { cle: "titre",  libelle: "Titre", type: "texte", obligatoire: true, placeholder: "ex. Les Enfants du paradis" },
      { cle: "genre",  libelle: "Type", type: "choix", defaut: "film",
        options: { "film": "Film", "serie": "Série", "documentaire": "Documentaire" } },
      { cle: "realisateur", libelle: "Réalisation / création", type: "texte", placeholder: "ex. Marcel Carné" },
      { cle: "annee",  libelle: "Année", type: "texte", placeholder: "ex. 1945" },
      { cle: "statut", libelle: "Statut", type: "choix", defaut: "a-voir",
        options: { "a-voir": "À voir", "en-cours": "En cours", "vu": "Vu" } },
      { cle: "note",   libelle: "Ma note", type: "choix", defaut: "",
        options: { "": "—", "1": "★", "2": "★★", "3": "★★★", "4": "★★★★", "5": "★★★★★" } },
      { cle: "ou",     libelle: "Où le voir", type: "texte", placeholder: "Cinéma, Netflix, Arte, DVD…" },
      { cle: "conseille", libelle: "Conseillé par", type: "texte", placeholder: "Un ami, une critique…" },
      { cle: "tags",   libelle: "Genres", type: "tags", placeholder: "comédie, polar, science-fiction…",
        aide: "Séparez les genres par des virgules." },
      { cle: "notes",  libelle: "Notes / avis", type: "texte-long", lignes: 3 },
    ],
    champsRecherche: ["titre", "realisateur", "annee", "ou", "conseille", "notes", "tags"],
    tris: {
      recent: { libelle: "Ajoutés récemment", comparer: (a, b) => b.creeLe - a.creeLe },
      statut: { libelle: "Statut",            comparer: (a, b) => ordreStatut(a) - ordreStatut(b) || b.creeLe - a.creeLe },
      titre:  { libelle: "Titre (A → Z)",     comparer: (a, b) => comparerTexte(a.titre, b.titre) },
      annee:  { libelle: "Année",             comparer: (a, b) => comparerTexte(a.annee, b.annee) || comparerTexte(a.titre, b.titre) },
      note:   { libelle: "Mieux notés",       comparer: (a, b) => (Number(b.note) || 0) - (Number(a.note) || 0) },
    },
    afficher(el) {
      const champ = cle => this.champs.find(c => c.cle === cle).options;
      const statut = el.statut || "a-voir";
      const genre = el.genre || "film";
      const note = Number(el.note) || 0;
      const sousTitre = [el.realisateur, el.annee].filter(Boolean).map(echapper).join(" · ");
      return `
        <p class="livre-titre">${echapper(el.titre)}</p>
        ${sousTitre ? `<p class="livre-auteur">${sousTitre}</p>` : ""}
        <div class="livre-infos">
          <span class="type-film">${champ("genre")[genre]}</span>
          <button class="statut statut-${statut}" data-action="cycle" data-champ="statut"
            title="Changer le statut">${champ("statut")[statut]}</button>
          ${note ? `<span class="etoiles" aria-label="${note} sur 5">${"★".repeat(note)}${"☆".repeat(5 - note)}</span>` : ""}
          ${el.ou ? `<span>📺 ${echapper(el.ou)}</span>` : ""}
          ${el.conseille ? `<span>Conseillé par ${echapper(el.conseille)}</span>` : ""}
        </div>
        ${afficherTags(el.tags)}
        ${el.notes ? `<p class="notes">${echapper(el.notes)}</p>` : ""}`;
    },
    enTexte(el) {
      let t = el.titre;
      const details = [el.realisateur, el.annee].filter(Boolean).join(", ");
      if (details) t += ` (${details})`;
      return t;
    },
  },

  /* ----- Restaurants ----- */
  restaurants: {
    libelle: "Restaurants",
    singulier: "restaurant",
    pluriel: "restaurants",
    feminin: false,
    champs: [
      { cle: "nom",     libelle: "Nom", type: "texte", obligatoire: true, placeholder: "ex. Le Petit Bouillon" },
      { cle: "cuisine", libelle: "Cuisine", type: "texte", placeholder: "ex. française, japonaise, pizzeria…" },
      { cle: "ville",   libelle: "Ville / quartier", type: "texte", placeholder: "ex. Paris 11e" },
      { cle: "adresse", libelle: "Adresse", type: "texte", placeholder: "ex. 12 rue de la Roquette",
        aide: "L'adresse devient un lien vers la carte." },
      { cle: "prix",    libelle: "Prix", type: "choix", defaut: "",
        options: { "": "—", "1": "€ (bon marché)", "2": "€€ (moyen)", "3": "€€€ (cher)", "4": "€€€€ (très cher)" } },
      { cle: "statut",  libelle: "Statut", type: "choix", defaut: "a-essayer",
        options: { "a-essayer": "À essayer", "teste": "Testé", "a-eviter": "À éviter" } },
      { cle: "note",    libelle: "Ma note", type: "choix", defaut: "",
        options: { "": "—", "1": "★", "2": "★★", "3": "★★★", "4": "★★★★", "5": "★★★★★" } },
      { cle: "contact", libelle: "Téléphone ou site", type: "texte", placeholder: "ex. 01 23 45 67 89 ou https://…" },
      { cle: "conseille", libelle: "Conseillé par", type: "texte", placeholder: "Un ami, un guide, un article…" },
      { cle: "tags",    libelle: "Occasions / ambiance", type: "tags", placeholder: "terrasse, en famille, romantique…",
        aide: "Séparez les mots par des virgules." },
      { cle: "notes",   libelle: "Notes / avis", type: "texte-long", lignes: 3,
        placeholder: "Plats à goûter, réserver à l'avance, fermé le lundi…" },
    ],
    champsRecherche: ["nom", "cuisine", "ville", "adresse", "conseille", "notes", "tags"],
    tris: {
      recent: { libelle: "Ajoutés récemment", comparer: (a, b) => b.creeLe - a.creeLe },
      statut: { libelle: "Statut",            comparer: (a, b) => ordreStatut(a) - ordreStatut(b) || b.creeLe - a.creeLe },
      nom:    { libelle: "Nom (A → Z)",       comparer: (a, b) => comparerTexte(a.nom, b.nom) },
      ville:  { libelle: "Ville (A → Z)",     comparer: (a, b) => comparerTexte(a.ville, b.ville) || comparerTexte(a.nom, b.nom) },
      note:   { libelle: "Mieux notés",       comparer: (a, b) => (Number(b.note) || 0) - (Number(a.note) || 0) },
      prix:   { libelle: "Moins chers",       comparer: (a, b) => (Number(a.prix) || 9) - (Number(b.prix) || 9) },
    },
    afficher(el) {
      const statuts = this.champs.find(c => c.cle === "statut").options;
      const statut = el.statut || "a-essayer";
      const note = Number(el.note) || 0;
      const prix = Number(el.prix) || 0;
      const sousTitre = [el.cuisine, el.ville].filter(Boolean).map(echapper).join(" · ");
      // L'adresse (complétée par la ville) ouvre la carte Google Maps
      const lieu = [el.adresse, el.ville].filter(Boolean).join(", ");
      const carte = el.adresse
        ? `<a class="lien-resto" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(el.nom + ", " + lieu)}"
             target="_blank" rel="noopener">📍 ${echapper(el.adresse)}</a>` : "";
      return `
        <p class="livre-titre">${echapper(el.nom)}</p>
        ${sousTitre ? `<p class="livre-auteur">${sousTitre}</p>` : ""}
        <div class="livre-infos">
          <button class="statut statut-${statut}" data-action="cycle" data-champ="statut"
            title="Changer le statut">${statuts[statut]}</button>
          ${prix ? `<span class="prix" aria-label="Prix ${prix} sur 4">${"€".repeat(prix)}</span>` : ""}
          ${note ? `<span class="etoiles" aria-label="${note} sur 5">${"★".repeat(note)}${"☆".repeat(5 - note)}</span>` : ""}
          ${el.conseille ? `<span>Conseillé par ${echapper(el.conseille)}</span>` : ""}
        </div>
        ${carte || el.contact ? `<div class="livre-infos">${carte}${lienContact(el.contact)}</div>` : ""}
        ${afficherTags(el.tags)}
        ${el.notes ? `<p class="notes">${echapper(el.notes)}</p>` : ""}`;
    },
    enTexte(el) {
      let t = el.nom;
      const details = [el.cuisine, el.adresse, el.ville].filter(Boolean).join(", ");
      if (details) t += ` (${details})`;
      if (el.contact) t += ` — ${el.contact}`;
      return t;
    },
  },
};

// Téléphone ou site web : devient un lien cliquable (appel ou ouverture du site)
function lienContact(contact) {
  if (!contact) return "";
  const c = contact.trim();
  if (/^https?:\/\//i.test(c) || /^www\./i.test(c)) {
    const url = /^www\./i.test(c) ? "https://" + c : c;
    return `<a class="lien-resto" href="${echapper(url)}" target="_blank" rel="noopener">🌐 Site</a>`;
  }
  if (/^[+\d][\d\s.\-()]{5,}$/.test(c)) {
    return `<a class="lien-resto" href="tel:${c.replace(/[^\d+]/g, "")}">📞 ${echapper(c)}</a>`;
  }
  return `<span>${echapper(c)}</span>`;
}

// Ordre du tri « Statut » : en cours d'abord, puis à faire, puis terminé (puis à éviter)
function ordreStatut(el) {
  return { "en-cours": 0, "a-lire": 1, "a-voir": 1, "a-essayer": 1,
           "lu": 2, "vu": 2, "teste": 2, "a-eviter": 3 }[el.statut] ?? 1;
}

// Natures prévues mais pas encore disponibles (affichées grisées)
const NATURES_A_VENIR = ["Courses", "Actions à faire", "Idées de voyage"];

// Accord masculin / féminin des messages : accord(nature, "Nouvelle", "Nouveau")
function accord(nature, feminin, masculin) {
  return nature.feminin ? feminin : masculin;
}


/* ---------- 2. Les données ---------- */

const CLE_STOCKAGE = "mesListes.donnees.v1";

// Quelques citations d'exemple (textes anciens, libres de droits)
const EXEMPLES_CITATIONS = [
  { texte: "Parce que c'était lui, parce que c'était moi.", auteur: "Montaigne", source: "Essais", annee: "1580", tags: ["amitié"] },
  { texte: "Le cœur a ses raisons que la raison ne connaît point.", auteur: "Blaise Pascal", source: "Pensées", annee: "1670", tags: ["amour", "philosophie"] },
  { texte: "Il faut cultiver notre jardin.", auteur: "Voltaire", source: "Candide", annee: "1759", tags: ["sagesse"] },
  { texte: "Rien ne sert de courir ; il faut partir à point.", auteur: "Jean de La Fontaine", source: "Le Lièvre et la Tortue", annee: "1668", tags: ["sagesse"] },
  { texte: "Je pense, donc je suis.", auteur: "René Descartes", source: "Discours de la méthode", annee: "1637", tags: ["philosophie"] },
];

let donnees = charger();

// Point de contact avec synchro.js (complété plus bas, section 12)
const MesListes = window.MesListes = {};

// État de l'écran (non enregistré) : recherche en cours, filtres…
const ecran = { recherche: "", tag: null, favorisSeulement: false, tri: "recent" };

function nouvelId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function nouvelElement(champs) {
  const maintenant = Date.now();
  return { id: nouvelId(), favori: false, creeLe: maintenant, modifieLe: maintenant, ...champs };
}

function donneesInitiales() {
  const id = nouvelId();
  return {
    version: 1,
    exemple: true,     // retiré dès la première modification (voir sauvegarder)
    vue: "tuiles",
    listeActive: id,
    supprimes: {},
    listes: [{
      id,
      nom: "Mes citations",
      nature: "citations",
      // creeLe décalé pour garder l'ordre des exemples dans le tri « récent »
      elements: EXEMPLES_CITATIONS.map((c, i) => ({ ...nouvelElement(c), creeLe: Date.now() - i * 1000 })),
    }],
  };
}

function charger() {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (brut) {
      const d = JSON.parse(brut);
      if (d && Array.isArray(d.listes) && d.listes.length) return d;
    }
  } catch (e) {
    console.warn("Lecture des données impossible :", e);
  }
  return donneesInitiales();
}

function enregistrerLocalement() {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
  } catch (e) {
    notifier("⚠ Impossible d'enregistrer (stockage du navigateur indisponible)");
  }
}

// Enregistre sur l'appareil, puis prévient la synchronisation (si active).
// contenuModifie = false pour les simples préférences de cet appareil
// (liste affichée, vue liste/tuiles) : elles ne sont pas envoyées.
function sauvegarder(contenuModifie = true) {
  if (contenuModifie) delete donnees.exemple;
  enregistrerLocalement();
  if (contenuModifie) MesListes.auChangement?.(donnees);
}

// Note la suppression d'une liste ou d'un élément, pour que les autres
// appareils la suppriment aussi (au lieu de la faire réapparaître).
function noterSuppression(id) {
  donnees.supprimes ??= {};
  donnees.supprimes[id] = Date.now();
}

/* Fusion de deux versions des données (cet appareil + le compte en ligne).
   Rien n'est perdu : on garde toutes les listes et tous les éléments des
   deux côtés ; pour un élément présent des deux côtés, on garde la version
   modifiée le plus récemment ; un élément supprimé (et pas modifié depuis)
   disparaît des deux côtés. La vue et la liste affichée restent celles
   de cet appareil. */
function fusionner(local, distant) {
  const supprimes = { ...(distant.supprimes || {}) };
  Object.entries(local.supprimes || {}).forEach(([id, t]) => supprimes[id] = Math.max(t, supprimes[id] || 0));
  // On oublie les traces de suppression de plus de 6 mois
  const limite = Date.now() - 183 * 24 * 3600 * 1000;
  Object.keys(supprimes).forEach(id => { if (supprimes[id] < limite) delete supprimes[id]; });

  const vivant = obj => !(supprimes[obj.id] >= (obj.modifieLe || 0));
  const plusRecent = (a, b) => !a ? b : !b ? a : ((b.modifieLe || 0) > (a.modifieLe || 0) ? b : a);

  const listesDistantes = new Map((distant.listes || []).map(l => [l.id, l]));
  const ids = [...new Set([...(local.listes || []).map(l => l.id), ...listesDistantes.keys()])];
  const listeLocale = id => (local.listes || []).find(l => l.id === id);

  const listes = ids.map(id => {
    const a = listeLocale(id), b = listesDistantes.get(id);
    const base = plusRecent(a, b);
    const elementsB = new Map(((b && b.elements) || []).map(e => [e.id, e]));
    const idsElements = [...new Set([...((a && a.elements) || []).map(e => e.id), ...elementsB.keys()])];
    const elements = idsElements
      .map(eid => plusRecent((a && a.elements || []).find(e => e.id === eid), elementsB.get(eid)))
      .filter(vivant);
    return { ...base, elements };
  }).filter(vivant);

  return { ...distant, ...local, listes: listes.length ? listes : local.listes, supprimes };
}

function listeActive() {
  return donnees.listes.find(l => l.id === donnees.listeActive) || donnees.listes[0];
}


/* ---------- 3. Petits outils ---------- */

const $ = sel => document.querySelector(sel);

// Empêche qu'un texte saisi soit interprété comme du HTML
function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function comparerTexte(a, b) {
  return (a || "").localeCompare(b || "", "fr", { sensitivity: "base" });
}

// Pour la recherche : minuscules et sans accents (« ete » trouve « été »)
function normaliser(texte) {
  return String(texte ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function afficherTags(tags) {
  if (!tags || !tags.length) return "";
  return `<div class="tags">${tags.map(t =>
    `<button class="tag" data-action="tag" data-tag="${echapper(t)}">${echapper(t)}</button>`).join("")}</div>`;
}

let minuteurNotification;
function notifier(message) {
  const n = $("#notification");
  n.textContent = message;
  n.classList.add("visible");
  clearTimeout(minuteurNotification);
  minuteurNotification = setTimeout(() => n.classList.remove("visible"), 2000);
}


/* ---------- 4. Fenêtres et bouton « retour » d'Android ----------
   Quand une fenêtre s'ouvre, on ajoute une étape dans l'historique :
   ainsi le bouton retour du téléphone ferme la fenêtre au lieu de
   quitter l'application. */

function ouvrirDialogue(dialogue) {
  if (dialogue.open) return;
  dialogue.showModal();
  history.pushState({ dialogue: dialogue.id }, "");
}

window.addEventListener("popstate", () => {
  document.querySelectorAll("dialog[open]").forEach(d => d.close());
  fermerMenu();
});

document.querySelectorAll("dialog").forEach(d => d.addEventListener("close", () => {
  if (history.state?.dialogue === d.id) history.back();
}));


/* ---------- 5. Affichage ---------- */

function afficherTout() {
  const liste = listeActive();
  const nature = NATURES[liste.nature];

  // Sélecteur de listes
  $("#choixListe").innerHTML = donnees.listes.map(l =>
    `<option value="${l.id}" ${l.id === liste.id ? "selected" : ""}>${echapper(l.nom)}</option>`).join("");

  // En-tête
  $("#natureListe").textContent = nature.libelle;
  $("#titreListe").textContent = liste.nom;
  document.title = `${liste.nom} — MesListes`;

  // Tris
  if (!nature.tris[ecran.tri]) ecran.tri = Object.keys(nature.tris)[0];
  $("#tri").innerHTML = Object.entries(nature.tris).map(([cle, t]) =>
    `<option value="${cle}" ${cle === ecran.tri ? "selected" : ""}>${t.libelle}</option>`).join("");

  // Boutons de vue et favoris
  document.querySelectorAll(".bascule-vue button").forEach(b =>
    b.classList.toggle("actif", b.dataset.vue === donnees.vue));
  $("#btnFavoris").setAttribute("aria-pressed", ecran.favorisSeulement);

  afficherFiltresTags(liste);
  afficherElements(liste, nature);
}

function afficherFiltresTags(liste) {
  // Compte combien d'éléments portent chaque thème
  const compte = {};
  liste.elements.forEach(el => (el.tags || []).forEach(t => compte[t] = (compte[t] || 0) + 1));
  const tags = Object.keys(compte).sort(comparerTexte);
  if (ecran.tag && !compte[ecran.tag]) ecran.tag = null;

  $("#filtresTags").innerHTML = tags.map(t =>
    `<button class="tag ${t === ecran.tag ? "actif" : ""}" data-tag="${echapper(t)}">${echapper(t)}<span class="nb">${compte[t]}</span></button>`
  ).join("");
}

// Applique recherche, filtre de thème, favoris et tri
function elementsFiltres(liste, nature) {
  const mots = normaliser(ecran.recherche).split(/\s+/).filter(Boolean);
  return liste.elements
    .filter(el => !ecran.favorisSeulement || el.favori)
    .filter(el => !ecran.tag || (el.tags || []).includes(ecran.tag))
    .filter(el => {
      if (!mots.length) return true;
      const texte = normaliser(nature.champsRecherche.map(c => [].concat(el[c] ?? "").join(" ")).join(" "));
      return mots.every(m => texte.includes(m));
    })
    .sort(nature.tris[ecran.tri].comparer);
}

function afficherElements(liste, nature) {
  const visibles = elementsFiltres(liste, nature);
  const total = liste.elements.length;
  const zone = $("#contenu");
  const mot = n => n > 1 ? nature.pluriel : nature.singulier;

  $("#compteur").textContent = visibles.length === total
    ? `${total} ${mot(total)}`
    : `${visibles.length} sur ${total} ${mot(total)}`;

  if (!total) {
    zone.className = "";
    zone.innerHTML = `<div class="vide"><p>${accord(nature, "Aucune", "Aucun")} ${nature.singulier} pour l'instant.</p>
      <button class="btn btn-principal" data-action="ajouter">+ Ajouter ${accord(nature, "la première", "le premier")}</button></div>`;
    return;
  }
  if (!visibles.length) {
    zone.className = "";
    zone.innerHTML = `<div class="vide"><p>Aucun résultat.</p>
      <button class="btn" data-action="reinitialiser">Effacer les filtres</button></div>`;
    return;
  }

  zone.className = donnees.vue === "liste" ? "vue-liste" : "vue-tuiles";
  zone.innerHTML = visibles.map(el => `
    <article class="carte ${el.favori ? "favori" : ""}" data-id="${el.id}">
      <div class="carte-corps">${nature.afficher(el)}</div>
      <div class="carte-actions">
        <button data-action="favori" class="${el.favori ? "actif" : ""}" aria-label="${el.favori ? "Retirer des favoris" : "Ajouter aux favoris"}">${el.favori ? "★" : "☆"}</button>
        <button data-action="copier">Copier</button>
        <button data-action="modifier">Modifier</button>
        <button data-action="supprimer">Supprimer</button>
      </div>
    </article>`).join("");
}


/* ---------- 6. Ajouter / modifier un élément ---------- */

// Identifiant de l'élément modifié (null = ajout). On garde l'identifiant
// plutôt que l'élément lui-même, car la synchronisation peut remplacer
// les données pendant que la fenêtre est ouverte.
let idElementEnCours = null;

function ouvrirFormulaireElement(element = null) {
  const nature = NATURES[listeActive().nature];
  idElementEnCours = element ? element.id : null;
  $("#titreFormElement").textContent = element
    ? `Modifier ${accord(nature, "la", "le")} ${nature.singulier}`
    : `${accord(nature, "Nouvelle", "Nouveau")} ${nature.singulier}`;

  $("#champsElement").innerHTML = nature.champs.map(c => {
    let valeur = element ? element[c.cle] ?? "" : (c.defaut ?? "");
    if (c.type === "tags") valeur = (valeur || []).join(", ");
    const id = `champ-${c.cle}`;
    const attributs = `id="${id}" name="${c.cle}" ${c.obligatoire ? "required" : ""}`;
    const indication = `placeholder="${echapper(c.placeholder || "")}"`;
    let saisie;
    if (c.type === "texte-long") {
      saisie = `<textarea ${attributs} ${indication} rows="${c.lignes || 3}">${echapper(valeur)}</textarea>`;
    } else if (c.type === "choix") {
      saisie = `<select ${attributs}>${Object.entries(c.options).map(([v, l]) =>
        `<option value="${echapper(v)}" ${String(valeur) === v ? "selected" : ""}>${echapper(l)}</option>`).join("")}</select>`;
    } else {
      saisie = `<input type="text" ${attributs} ${indication} value="${echapper(valeur)}"
        ${c.type === "tags" ? 'autocapitalize="none"' : 'autocapitalize="sentences"'}>`;
    }
    return `<label for="${id}">${c.libelle}${c.obligatoire ? " *" : ""}</label>${saisie}
            ${c.aide ? `<p class="aide">${c.aide}</p>` : ""}
            ${c.chercherAuteurDe ? `<div class="recherche-auteur">
              <button type="button" class="btn btn-petit" data-action="chercher-auteur">🔎 Trouver l'auteur</button>
              <div id="pistesAuteur" class="pistes" aria-live="polite"></div></div>` : ""}`;
  }).join("");

  // Citation saisie sans auteur : on cherche l'auteur automatiquement en quittant le champ
  const champSource = nature.champs.find(c => c.chercherAuteurDe);
  if (champSource) {
    // Petit délai : si l'on quitte le champ en touchant « Enregistrer », l'enregistrement
    // passe d'abord (sinon le texte ajouté décalerait le bouton sous le doigt).
    $(`#champ-${champSource.chercherAuteurDe}`).addEventListener("change", () => {
      setTimeout(() => {
        if ($("#dlgElement").open && !$(`#champ-${champSource.cle}`).value.trim()) chercherAuteur(true);
      }, 400);
    });
  }

  ouvrirDialogue($("#dlgElement"));
  // Sur ordinateur, on place le curseur dans le premier champ.
  // Sur téléphone on s'abstient : le clavier cacherait la moitié de la fenêtre.
  if (!matchMedia("(pointer: coarse)").matches) $("#champsElement [name]")?.focus();
}

/* ---------- Recherche de l'auteur d'une citation sur internet ----------
   1. On interroge Wikiquote (le recueil de citations de Wikipédia) avec un
      extrait de la citation : les pages trouvées portent en général le nom
      de l'auteur (ou de l'œuvre). On les propose ; un toucher remplit le champ.
   2. Un lien ouvre aussi une recherche Google, pour vérifier ou si Wikiquote
      ne trouve rien. */

let numeroRecherche = 0;   // pour ignorer une réponse arrivée trop tard

async function chercherAuteur(automatique) {
  const zone = $("#pistesAuteur");
  if (!zone) return;
  const citation = $("#champ-texte").value.replace(/\s+/g, " ").trim();
  if (!citation) {
    zone.innerHTML = `<p class="aide">Saisissez d'abord la citation.</p>`;
    return;
  }

  const lienWeb = `<a class="lien-resto" target="_blank" rel="noopener"
    href="https://www.google.com/search?q=${encodeURIComponent(`"${extraitCitation(citation, 16)}" citation auteur`)}">Chercher sur le web ↗</a>`;
  const numero = ++numeroRecherche;
  zone.innerHTML = `<p class="aide">Recherche de l'auteur…</p>`;

  let pistes = [];
  try {
    // D'abord la phrase exacte (début de la citation), puis les mots en vrac
    for (const langue of ["fr", "en"]) {
      pistes = await chercherSurWikiquote(langue, `"${extraitCitation(citation, 10)}"`);
      if (!pistes.length) pistes = await chercherSurWikiquote(langue, extraitCitation(citation, 8));
      if (pistes.length) break;
    }
  } catch {
    // Hors connexion ou Wikiquote inaccessible : seul le lien web reste proposé
  }
  if (numero !== numeroRecherche || !document.body.contains(zone)) return;

  if (pistes.length) {
    zone.innerHTML = `<p class="aide">Auteur possible (touchez pour l'utiliser) :</p>
      <div class="pistes-liste">${pistes.map(p => `
        <span class="piste">
          <button type="button" class="tag" data-action="piste-auteur" data-valeur="${echapper(p.titre)}">${echapper(p.titre)}</button>
          <a href="${p.url}" target="_blank" rel="noopener" title="Voir la page Wikiquote">↗</a>
        </span>`).join("")}</div>
      <p class="aide">À vérifier : une piste peut être le titre d'une œuvre plutôt que l'auteur. ${lienWeb}</p>`;
  } else if (automatique) {
    zone.innerHTML = `<p class="aide">Auteur introuvable sur Wikiquote. ${lienWeb}</p>`;
  } else {
    zone.innerHTML = `<p class="aide">Rien trouvé sur Wikiquote. ${lienWeb}</p>`;
  }
}

// Les premiers mots de la citation, sans guillemets ni ponctuation finale
function extraitCitation(citation, nbMots) {
  return citation.replace(/[«»"“”„]/g, " ").replace(/\s+/g, " ").trim()
    .split(" ").slice(0, nbMots).join(" ").replace(/[\s.,;:!?…]+$/, "");
}

// Interroge Wikiquote ; renvoie au plus 3 pages : [{ titre, url }]
// Les pages de personnes (catégories « Naissance en… », « Décès en… ») passent
// en priorité : si on en trouve, on écarte les pages de thèmes (« Amour »…) et d'œuvres.
async function chercherSurWikiquote(langue, requete) {
  const adresse = `https://${langue}.wikiquote.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrnamespace=0&gsrlimit=6&gsrsearch=${encodeURIComponent(requete)}` +
    `&prop=categories&cllimit=max&clshow=!hidden`;
  const reponse = await fetch(adresse);
  if (!reponse.ok) return [];
  const resultat = await reponse.json();
  const pages = Object.values(resultat.query?.pages || {})
    .sort((a, b) => a.index - b.index)
    .map(p => ({
      titre: p.title,
      url: `https://${langue}.wikiquote.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
      personne: (p.categories || []).some(c => /naissance en|décès en|births|deaths|personnalit|people/i.test(c.title)),
    }));
  const personnes = pages.filter(p => p.personne);
  return (personnes.length ? personnes : pages).slice(0, 3);
}

function enregistrerElement(evenement) {
  evenement.preventDefault();
  const liste = listeActive();
  const nature = NATURES[liste.nature];
  const saisie = new FormData($("#formElement"));

  // Lit chaque champ selon son type
  const valeurs = {};
  nature.champs.forEach(c => {
    const v = String(saisie.get(c.cle) ?? "").trim();
    valeurs[c.cle] = c.type === "tags"
      ? [...new Set(v.split(",").map(t => t.trim().toLowerCase()).filter(Boolean))]
      : v;
  });

  const elementEnCours = idElementEnCours && liste.elements.find(el => el.id === idElementEnCours);
  if (elementEnCours) {
    Object.assign(elementEnCours, valeurs, { modifieLe: Date.now() });
    notifier("Modifications enregistrées");
  } else {
    liste.elements.push(nouvelElement(valeurs));
    notifier(`${nature.singulier[0].toUpperCase() + nature.singulier.slice(1)} ${accord(nature, "ajoutée", "ajouté")}`);
  }
  sauvegarder();
  $("#dlgElement").close();
  afficherTout();
}


/* ---------- 7. Actions sur les cartes ---------- */

function actionCarte(action, carte, bouton) {
  const liste = listeActive();
  const nature = NATURES[liste.nature];
  const element = carte && liste.elements.find(el => el.id === carte.dataset.id);

  switch (action) {
    case "favori":
      element.favori = !element.favori;
      element.modifieLe = Date.now();
      sauvegarder();
      afficherTout();
      break;
    case "cycle": {
      // Passe à la valeur suivante d'un champ « choix » (ex. À lire → En cours → Lu)
      if (!element) break;
      const champ = nature.champs.find(c => c.cle === bouton.dataset.champ);
      const valeurs = Object.keys(champ.options);
      const actuelle = element[champ.cle] || champ.defaut;
      element[champ.cle] = valeurs[(valeurs.indexOf(actuelle) + 1) % valeurs.length];
      element.modifieLe = Date.now();
      sauvegarder();
      afficherTout();
      notifier(champ.options[element[champ.cle]]);
      break;
    }
    case "copier":
      copier(nature.enTexte(element));
      break;
    case "modifier":
      ouvrirFormulaireElement(element);
      break;
    case "supprimer":
      if (confirm(`Supprimer ${accord(nature, "cette", "ce")} ${nature.singulier} ?`)) {
        liste.elements = liste.elements.filter(el => el !== element);
        noterSuppression(element.id);
        sauvegarder();
        afficherTout();
        notifier(accord(nature, "Supprimée", "Supprimé"));
      }
      break;
    case "tag":
      ecran.tag = ecran.tag === bouton.dataset.tag ? null : bouton.dataset.tag;
      if ($("#dlgHasard").open) $("#dlgHasard").close();
      afficherTout();
      break;
    case "chercher-auteur":
      chercherAuteur(false);
      break;
    case "piste-auteur":
      $("#champ-auteur").value = bouton.dataset.valeur;
      $("#pistesAuteur").innerHTML = `<p class="aide">Auteur renseigné : ${echapper(bouton.dataset.valeur)} ✓</p>`;
      break;
    case "ajouter":
      ouvrirFormulaireElement();
      break;
    case "reinitialiser":
      reinitialiserFiltres();
      afficherTout();
      break;
  }
}

function reinitialiserFiltres() {
  ecran.recherche = ""; ecran.tag = null; ecran.favorisSeulement = false;
  $("#recherche").value = "";
}

async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
  } catch {
    // Méthode de secours pour les navigateurs plus anciens
    const zone = document.createElement("textarea");
    zone.value = texte;
    document.body.appendChild(zone);
    zone.select();
    document.execCommand("copy");
    zone.remove();
  }
  notifier("Copié dans le presse-papiers");
}


/* ---------- 8. Au hasard ---------- */

let dernierHasard = null;

function tirerAuHasard() {
  const liste = listeActive();
  const nature = NATURES[liste.nature];
  let candidats = elementsFiltres(liste, nature);
  if (!candidats.length) { notifier("Rien à tirer au sort"); return; }
  // Évite de retomber deux fois de suite sur le même
  if (candidats.length > 1) candidats = candidats.filter(el => el.id !== dernierHasard);
  const choisi = candidats[Math.floor(Math.random() * candidats.length)];
  dernierHasard = choisi.id;
  $("#contenuHasard").innerHTML = nature.afficher({ ...choisi, notes: "" });
  ouvrirDialogue($("#dlgHasard"));
}


/* ---------- 9. Gérer les listes ---------- */

let modeListe = "creer"; // "creer" ou "modifier"

function ouvrirFormulaireListe(mode) {
  modeListe = mode;
  const liste = listeActive();
  $("#titreFormListe").textContent = mode === "creer" ? "Nouvelle liste" : "Gérer la liste";
  $("#nomListe").value = mode === "creer" ? "" : liste.nom;
  $("#blocNature").hidden = mode !== "creer";
  $("#btnSupprimerListe").hidden = mode === "creer";
  $("#natureNouvelleListe").innerHTML =
    Object.entries(NATURES).map(([cle, n]) => `<option value="${cle}">${n.libelle}</option>`).join("") +
    NATURES_A_VENIR.map(n => `<option disabled>${n} (bientôt)</option>`).join("");
  ouvrirDialogue($("#dlgListe"));
  if (!matchMedia("(pointer: coarse)").matches) $("#nomListe").focus();
}

function enregistrerListe(evenement) {
  evenement.preventDefault();
  const nom = $("#nomListe").value.trim();
  if (!nom) return;
  if (modeListe === "creer") {
    const nouvelle = { id: nouvelId(), nom, nature: $("#natureNouvelleListe").value, modifieLe: Date.now(), elements: [] };
    donnees.listes.push(nouvelle);
    donnees.listeActive = nouvelle.id;
    reinitialiserFiltres();
  } else {
    listeActive().nom = nom;
    listeActive().modifieLe = Date.now();
  }
  sauvegarder();
  $("#dlgListe").close();
  afficherTout();
}

function supprimerListe() {
  const liste = listeActive();
  if (donnees.listes.length === 1) {
    alert("C'est votre seule liste : créez-en une autre avant de supprimer celle-ci.");
    return;
  }
  const n = liste.elements.length;
  if (!confirm(`Supprimer la liste « ${liste.nom} » et ses ${n} élément${n > 1 ? "s" : ""} ? Cette action est définitive.`)) return;
  donnees.listes = donnees.listes.filter(l => l !== liste);
  noterSuppression(liste.id);
  donnees.listeActive = donnees.listes[0].id;
  sauvegarder();
  $("#dlgListe").close();
  afficherTout();
}


/* ---------- 10. Sauvegarde dans un fichier (export / import) ----------
   Les données vivent dans le navigateur. L'export crée un fichier .json
   qui permet de les sauvegarder ou de les transférer sur un autre appareil. */

function exporter() {
  const date = new Date().toISOString().slice(0, 10);
  const fichier = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(fichier);
  lien.download = `MesListes-sauvegarde-${date}.json`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  notifier("Sauvegarde téléchargée");
}

function importer(evenement) {
  const fichier = evenement.target.files[0];
  evenement.target.value = "";
  if (!fichier) return;
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      const d = JSON.parse(lecteur.result);
      if (!d || !Array.isArray(d.listes) || !d.listes.length) throw new Error("format");
      if (!confirm(`Remplacer vos listes actuelles par celles du fichier (${d.listes.length} liste${d.listes.length > 1 ? "s" : ""}) ?`)) return;
      // Ce qui n'est pas dans le fichier est noté « supprimé » (aussi sur les autres
      // appareils) ; ce qui est dans le fichier devient la version la plus récente.
      const maintenant = Date.now();
      const gardes = new Set(d.listes.flatMap(l => [l.id, ...(l.elements || []).map(e => e.id)]));
      const supprimes = { ...(donnees.supprimes || {}), ...(d.supprimes || {}) };
      donnees.listes.forEach(l => [l, ...l.elements].forEach(o => { if (!gardes.has(o.id)) supprimes[o.id] = maintenant; }));
      d.listes.forEach(l => { l.modifieLe = maintenant; (l.elements || []).forEach(e => { e.modifieLe = maintenant; delete supprimes[e.id]; }); delete supprimes[l.id]; });
      donnees = { ...d, supprimes, vue: donnees.vue };
      if (!donnees.listes.some(l => l.id === donnees.listeActive)) donnees.listeActive = donnees.listes[0].id;
      sauvegarder();
      reinitialiserFiltres();
      afficherTout();
      notifier("Sauvegarde rechargée");
    } catch {
      alert("Ce fichier n'est pas une sauvegarde MesListes valide.");
    }
  };
  lecteur.readAsText(fichier);
}


/* ---------- 11. Menu ⋮ ---------- */

function basculerMenu() {
  const ouvert = $("#menu").hidden;
  $("#menu").hidden = !ouvert;
  $("#btnMenu").setAttribute("aria-expanded", ouvert);
}
function fermerMenu() {
  $("#menu").hidden = true;
  $("#btnMenu").setAttribute("aria-expanded", false);
}


/* ---------- 12. Lien avec la synchronisation (fichier synchro.js) ----------
   synchro.js utilise ces fonctions pour lire et remplacer les données,
   et pour afficher l'état de la synchronisation. */

const ETATS_SYNCHRO = {
  "non-configuree": { icone: "",  texte: "" },
  "deconnecte":     { icone: "☁", texte: "Non synchronisé" },
  "connexion":      { icone: "⟳", texte: "Connexion…" },
  "envoi":          { icone: "⟳", texte: "Envoi…" },
  "synchronise":    { icone: "✓", texte: "Synchronisé" },
  "hors-ligne":     { icone: "⚠", texte: "Hors ligne" },
  "erreur":         { icone: "⚠", texte: "Erreur de synchronisation" },
};

let etatSynchroActuel = "non-configuree";

Object.assign(MesListes, {
  obtenirDonnees: () => donnees,
  fusionner,
  // Remplace les listes par celles reçues, en gardant les préférences de cet appareil
  remplacerDonnees(nouvelles) {
    if (!nouvelles || !Array.isArray(nouvelles.listes) || !nouvelles.listes.length) return;
    donnees = { ...nouvelles, vue: donnees.vue, listeActive: donnees.listeActive };
    delete donnees.exemple;
    if (!donnees.listes.some(l => l.id === donnees.listeActive)) donnees.listeActive = donnees.listes[0].id;
    enregistrerLocalement();
    afficherTout();
  },
  notifier,
  etatSynchro(etat, courriel = "") {
    etatSynchroActuel = etat;
    const e = ETATS_SYNCHRO[etat] || ETATS_SYNCHRO.erreur;
    const indicateur = $("#etatSynchro");
    indicateur.hidden = etat === "non-configuree";
    indicateur.dataset.etat = etat;
    indicateur.innerHTML = `<span aria-hidden="true">${e.icone}</span><span class="libelle-long"> ${e.texte}</span>`;
    indicateur.title = courriel ? `${e.texte} — ${courriel}` : e.texte;

    const bouton = $("#btnCompte");
    bouton.hidden = etat === "non-configuree";
    bouton.textContent = etat === "deconnecte"
      ? "Se connecter pour synchroniser"
      : `Se déconnecter${courriel ? ` (${courriel})` : ""}`;
  },
});

function clicCompte() {
  fermerMenu();
  if (etatSynchroActuel === "deconnecte") {
    MesListes.connecter?.();
  } else if (confirm("Se déconnecter ? Les listes restent sur cet appareil mais ne seront plus synchronisées.")) {
    MesListes.deconnecter?.();
  }
}
$("#btnCompte").addEventListener("click", clicCompte);
$("#etatSynchro").addEventListener("click", () => {
  if (etatSynchroActuel === "deconnecte") MesListes.connecter?.();
  else notifier($("#etatSynchro").title);
});


/* ---------- 13. Installation sur téléphone (PWA) ----------
   Le « service worker » garde une copie de l'application sur
   l'appareil : elle s'ouvre alors même sans connexion internet. */

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("service-worker.js").catch(e => console.warn("Service worker :", e));
}

let invitationInstallation = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  invitationInstallation = e;
  $("#btnInstaller").hidden = false;
});
$("#btnInstaller").addEventListener("click", async () => {
  fermerMenu();
  if (!invitationInstallation) return;
  invitationInstallation.prompt();
  await invitationInstallation.userChoice;
  invitationInstallation = null;
  $("#btnInstaller").hidden = true;
});


/* ---------- 14. Branchement des événements ---------- */

$("#choixListe").addEventListener("change", e => {
  donnees.listeActive = e.target.value;
  reinitialiserFiltres();
  sauvegarder(false);
  afficherTout();
  window.scrollTo(0, 0);
});

$("#btnMenu").addEventListener("click", e => { e.stopPropagation(); basculerMenu(); });
$("#btnNouvelleListe").addEventListener("click", () => { fermerMenu(); ouvrirFormulaireListe("creer"); });
$("#btnExporter").addEventListener("click", () => { fermerMenu(); exporter(); });
$("#fichierImport").addEventListener("change", e => { fermerMenu(); importer(e); });

$("#btnGererListe").addEventListener("click", () => ouvrirFormulaireListe("modifier"));
$("#formListe").addEventListener("submit", enregistrerListe);
$("#btnSupprimerListe").addEventListener("click", supprimerListe);

$("#btnAjouter").addEventListener("click", () => ouvrirFormulaireElement());
$("#btnAjouterFlottant").addEventListener("click", () => ouvrirFormulaireElement());
$("#formElement").addEventListener("submit", enregistrerElement);

$("#btnHasard").addEventListener("click", tirerAuHasard);
$("#btnAutreHasard").addEventListener("click", tirerAuHasard);

$("#recherche").addEventListener("input", e => { ecran.recherche = e.target.value; afficherTout(); });
$("#tri").addEventListener("change", e => { ecran.tri = e.target.value; afficherTout(); });
$("#btnFavoris").addEventListener("click", () => { ecran.favorisSeulement = !ecran.favorisSeulement; afficherTout(); });

document.querySelectorAll(".bascule-vue button").forEach(b =>
  b.addEventListener("click", () => { donnees.vue = b.dataset.vue; sauvegarder(false); afficherTout(); }));

$("#filtresTags").addEventListener("click", e => {
  const b = e.target.closest(".tag");
  if (b) actionCarte("tag", null, b);
});

// Un seul écouteur pour tous les boutons des cartes (et des fenêtres)
document.addEventListener("click", e => {
  if (!e.target.closest(".menu-conteneur")) fermerMenu();
  const bouton = e.target.closest("[data-action]");
  if (bouton && !bouton.closest("#filtresTags")) actionCarte(bouton.dataset.action, bouton.closest(".carte"), bouton);
  if (e.target.closest("[data-fermer]")) e.target.closest("dialog").close();
});

// Raccourci clavier (ordinateur) : touche « n » pour ajouter
document.addEventListener("keydown", e => {
  if (e.key === "Escape") fermerMenu();
  if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.target.closest("input, textarea, select") && !document.querySelector("dialog[open]")) {
    e.preventDefault();
    ouvrirFormulaireElement();
  }
});

afficherTout();
