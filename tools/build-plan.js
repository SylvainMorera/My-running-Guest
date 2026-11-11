#!/usr/bin/env node
// Convertit les exports CSV du Google Sheet (onglets Plan, Règles, S1…S16) en renfo-cross/data/plan.json.
// Usage : node tools/build-plan.js [dossier-source] [fichier-sortie]
//   par défaut : data-source/  →  renfo-cross/data/plan.json
// Aucune dépendance. Le script n'invente rien : toute valeur vient des CSV.
// Si une ligne ne correspond pas au format attendu, il l'écrit dans « avertissements » (console + plan.json).
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.resolve(process.argv[2] || path.join(RACINE, 'data-source'));
const SORTIE = path.resolve(process.argv[3] || path.join(RACINE, 'renfo-cross', 'data', 'plan.json'));

// Exercices suivis dans l'écran Progression (liste fournie par Sylvain, pas par le Sheet).
const EXERCICES_CLES = ['Squat arrière', 'Soulevé de terre', 'Développé couché', 'Tractions strictes', 'Fente bulgare'];
// Objectif principal de la saison (indiqué par Sylvain ; le Sheet ne le marque pas).
const OBJECTIF_PRINCIPAL = 'Sarrebourg';

const avertissements = [];
function avertir(msg) { avertissements.push(msg); console.warn('⚠ ' + msg); }

// ---------- Lecture CSV (RFC 4180 : guillemets, virgules et retours à la ligne dans les cellules) ----------
function lireCSV(texte) {
  texte = texte.replace(/^﻿/, '');
  // Séparateur : virgule (export Google Sheets) ou point-virgule (export Excel français).
  const premiere = texte.split('\n')[0];
  const sep = (premiere.split(';').length > premiere.split(',').length) ? ';' : ',';
  const lignes = []; let ligne = []; let cell = ''; let entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') entreGuillemets = false;
      else cell += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === sep) { ligne.push(cell); cell = ''; }
    else if (c === '\n') { ligne.push(cell); lignes.push(ligne); ligne = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || ligne.length) { ligne.push(cell); lignes.push(ligne); }
  // Nettoyage : espaces en bord de cellule, cellules vides de fin de ligne.
  return lignes.map(l => { const t = l.map(v => v.trim()); while (t.length && t[t.length - 1] === '') t.pop(); return t; });
}

// Trouve les fichiers : « S1.csv » ou « Nom du classeur - S1.csv » (nom donné par Google Sheets au téléchargement).
function fichiers() {
  if (!fs.existsSync(SOURCE)) { console.error('Dossier source introuvable : ' + SOURCE); process.exit(1); }
  const res = { semaines: {} };
  for (const f of fs.readdirSync(SOURCE)) {
    const m = f.normalize('NFC').match(/(?:^|[\s-])(S(\d{1,2})|Plan|R[èe]gles)\.csv$/i);
    if (!m) continue;
    const p = path.join(SOURCE, f);
    if (m[2]) res.semaines[parseInt(m[2], 10)] = p;
    else if (/^plan$/i.test(m[1])) res.plan = p;
    else res.regles = p;
  }
  return res;
}

// ---------- Outils ----------
const MOIS = { 'janv': 1, 'févr': 2, 'mars': 3, 'avr': 4, 'mai': 5, 'juin': 6, 'juil': 7, 'août': 8, 'sept': 9, 'oct': 10, 'nov': 11, 'déc': 12 };
function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
// « JAMBES » → « Jambes » (titres de séance écrits en capitales dans le Sheet).
function phrase(s) { const b = s.toLocaleLowerCase('fr'); return b.charAt(0).toLocaleUpperCase('fr') + b.slice(1); }
// « championnats du Gard » → « Championnats du Gard » (seule la 1re lettre change).
function majuscule(s) { return s.charAt(0).toLocaleUpperCase('fr') + s.slice(1); }
function nombreFr(s) { return parseFloat(String(s).replace(',', '.')); }
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function ajouterJours(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const TYPES = { 'calibrage': 'calibrage', 'progression': 'progression', 'allégée': 'allegee', 'compétition': 'competition', 'post-course': 'post-course', 'volume réduit': 'volume-reduit', 'affûtage': 'affutage' };

// ---------- Onglet Plan ----------
function lirePlan(lignes) {
  // Date de début : ligne « Début du programme | lun. 9 nov. 2026 ».
  const lDebut = lignes.find(l => /^Début du programme$/i.test(l[0] || ''));
  if (!lDebut) { console.error('Onglet Plan : ligne « Début du programme » introuvable.'); process.exit(1); }
  const md = (lDebut[1] || '').match(/(\d{1,2})\s+([a-zéû]+)\.?\s+(\d{4})/i);
  if (!md || !MOIS[md[2].toLowerCase()]) { console.error('Onglet Plan : date de début illisible « ' + lDebut[1] + ' ».'); process.exit(1); }
  const debut = new Date(+md[3], MOIS[md[2].toLowerCase()] - 1, +md[1]);
  if (debut.getDay() !== 1) avertir('Onglet Plan : la date de début (' + lDebut[1] + ') n\'est pas un lundi.');

  const iEntete = lignes.findIndex(l => l[0] === 'Semaine' && l[1] === 'Du');
  if (iEntete < 0) { console.error('Onglet Plan : ligne d\'en-têtes « Semaine | Du | Au … » introuvable.'); process.exit(1); }
  const entetes = lignes[iEntete];
  const col = nom => entetes.findIndex(h => h.toLowerCase() === nom.toLowerCase());
  const C = { sem: 0, du: col('Du'), au: col('Au'), bloc: col('Bloc'), type: col('Type de semaine'), obj: col('Objectif et consignes'), ech: col('Échéance'), poids: col('Poids (kg)'), fract: col('Qualité du fractionné'), retour: col('Retour coureur') };
  for (const k of Object.keys(C)) if (C[k] < 0) avertir('Onglet Plan : colonne attendue absente (' + k + ').');

  // Séances types : en-têtes « Jambes (lundi) », « Tronc et prévention (mardi) », « Haut du corps (jeudi) ».
  const seancesType = [];
  entetes.forEach(h => { const m = h.match(/^(.+?)\s*\((lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\)$/i); if (m) seancesType.push({ n: seancesType.length + 1, nom: m[1], jour: m[2].toLowerCase(), jourIndex: JOURS.indexOf(m[2].toLowerCase()) }); });
  if (seancesType.length !== 3) avertir('Onglet Plan : ' + seancesType.length + ' colonnes de séance « Nom (jour) » trouvées au lieu de 3.');

  const semaines = [];
  for (let i = iEntete + 1; i < lignes.length; i++) {
    const l = lignes[i]; const m = (l[0] || '').match(/^S(\d{1,2})$/);
    if (!m) continue;
    const n = +m[1];
    const lundi = ajouterJours(debut, (n - 1) * 7);
    // Contrôle : la date « Du » du Sheet doit correspondre au calcul.
    const du = (l[C.du] || '').match(/(\d{1,2})\s+([a-zéû]+)/i);
    if (du && (+du[1] !== lundi.getDate() || MOIS[du[2].toLowerCase()] !== lundi.getMonth() + 1)) {
      avertir('Onglet Plan, S' + n + ' : la date « Du » (' + l[C.du] + ') ne correspond pas à début + ' + (n - 1) + ' semaines (' + iso(lundi) + ').');
    }
    const blocTxt = l[C.bloc] || '';
    const mb = blocTxt.match(/^Bloc\s+(\d+)\s*:\s*(.+)$/);
    if (!mb) avertir('Onglet Plan, S' + n + ' : bloc illisible « ' + blocTxt + ' ».');
    const typeTxt = l[C.type] || '';
    const typeCle = TYPES[typeTxt.toLowerCase()];
    if (!typeCle) avertir('Onglet Plan, S' + n + ' : type de semaine inconnu « ' + typeTxt + ' ».');
    // Échéance : « Dim. 10/01 : championnats du Gard (Uzès) ».
    let course = null; const echTxt = l[C.ech] || '';
    if (echTxt) {
      const me = echTxt.match(/(\d{1,2})\/(\d{1,2})\s*:\s*(.+?)\s*(?:\(([^)]+)\))?$/);
      if (!me) avertir('Onglet Plan, S' + n + ' : échéance illisible « ' + echTxt + ' ».');
      else {
        // Année : celle du jour de la semaine qui porte ce jour/mois.
        let date = null;
        for (let j = 0; j < 7; j++) { const d = ajouterJours(lundi, j); if (d.getDate() === +me[1] && d.getMonth() + 1 === +me[2]) date = d; }
        if (!date) avertir('Onglet Plan, S' + n + ' : la date de l\'échéance (' + me[1] + '/' + me[2] + ') n\'est pas dans la semaine.');
        course = { texte: echTxt, date: date ? iso(date) : null, nom: majuscule(me[3]), lieu: me[4] || '', principal: (me[4] || '') === OBJECTIF_PRINCIPAL };
      }
    }
    semaines.push({
      n, id: 'S' + n, debut: iso(lundi), fin: iso(ajouterJours(lundi, 6)), duTexte: l[C.du] || '', auTexte: l[C.au] || '',
      bloc: mb ? { n: +mb[1], nom: mb[2] } : { n: null, nom: blocTxt },
      type: typeTxt, typeCle: typeCle || null, objectif: l[C.obj] || '', course,
      // Valeurs saisies dans le Sheet (vides dans le plan) : reprises comme valeur initiale, l'app les remplit ensuite.
      poidsSheet: C.poids >= 0 ? (l[C.poids] || '') : '', fractionneSheet: C.fract >= 0 ? (l[C.fract] || '') : '', retourSheet: C.retour >= 0 ? (l[C.retour] || '') : '',
      titre: null, consigne: null, seances: null
    });
  }
  // Ligne « Séances prévues » (total) : contrôle de cohérence avec 3 séances × semaines.
  const lPrev = lignes.find(l => /^Séances prévues$/i.test(l[0] || ''));
  const prevues = lPrev ? parseInt(lPrev.filter(Boolean).pop(), 10) : null;
  return { debut: iso(debut), seancesType, semaines, seancesPrevuesSheet: isNaN(prevues) ? null : prevues };
}

// ---------- Prescription « 4 × 5 · RPE 7-8 · Tempo 3-0-1 · R 2'30 » ----------
function lirePrescription(txt, ou) {
  const p = { series: null, reps: null, unite: '', repsTexte: '', rpeCible: '', tempo: '', recupSec: null, recupTexte: '', autres: [] };
  if (!txt) return p;
  const morceaux = txt.split('·').map(s => s.trim()).filter(Boolean);
  morceaux.forEach((m, i) => {
    let r;
    if (i === 0 && (r = m.match(/^(\d+)\s*[×xX]\s*(\d+)\s*(.*)$/))) { // « 4 × 6 » ou « 4 x 6 »
      p.series = +r[1]; p.reps = +r[2];
      const suite = r[3].trim();
      if (/^"/.test(suite)) { p.unite = 's'; p.repsTexte = suite.replace(/^"/, '').trim(); }   // 3 × 30" (/côté)
      else if (/^m\b/.test(suite)) { p.unite = 'm'; }                                           // 2 × 20 m
      else p.repsTexte = suite;                                                                 // /jambe, /côté, pas/côté, appuis
    } else if (i === 0 && (r = m.match(/^(\d+)\s+(tours?|séries?)$/))) {
      p.series = +r[1]; p.unite = r[2].startsWith('tour') ? 'tours' : '';
    } else if ((r = m.match(/^(\d+)\s+reps$/))) { p.reps = +r[1]; }
    else if (/^max\s*[−-]\s*\d+\s*reps$/i.test(m)) { p.repsTexte = m; }
    else if ((r = m.match(/^RPE\s+(.+)$/))) { p.rpeCible = r[1]; }
    else if ((r = m.match(/^Tempo\s+(.+)$/))) { p.tempo = r[1]; }
    else if ((r = m.match(/^R\s+(.+)$/))) {
      p.recupTexte = r[1];
      const t = r[1].match(/^(\d+)'(\d{1,2})?$|^(\d+)"$/);
      if (t) p.recupSec = t[3] ? +t[3] : (+t[1] * 60 + (t[2] ? +t[2] : 0));
      else avertir(ou + ' : récupération illisible « ' + m + ' ».');
    } else p.autres.push(m);
  });
  return p;
}

// ---------- Charge prévue ----------
function lireCharge(txt) {
  let r;
  if (!txt) return { kg: null, mult: 1, min: null, max: null };
  if ((r = txt.match(/^(\d+(?:,\d+)?)\s*kg$/i))) return { kg: nombreFr(r[1]), mult: 1, min: null, max: null };
  if ((r = txt.match(/^2\s*[×xX]\s*(\d+(?:,\d+)?)\s*kg$/i))) return { kg: nombreFr(r[1]), mult: 2, min: null, max: null };       // 2 haltères
  if ((r = txt.match(/^(\d+(?:,\d+)?)\s*kg\s*\(/i))) return { kg: nombreFr(r[1]), mult: 1, min: null, max: null };          // « 40 kg (42,5 kg si …) » : 1re valeur
  // Fourchette « 14 à 18 kg » (1 haltère) ou « 10 à 12 kg par main » (2 haltères) : pas de valeur unique, rien n'est pré-rempli.
  if ((r = txt.match(/^(\d+(?:,\d+)?)\s*à\s*(\d+(?:,\d+)?)\s*kg(.*)$/i))) return { kg: null, mult: /par main/.test(r[3]) ? 2 : 1, min: nombreFr(r[1]), max: nombreFr(r[2]) };
  return { kg: null, mult: 1, min: null, max: null };
}

// ---------- Onglet semaine ----------
function lireSemaine(lignes, n, seancesType) {
  const ou = 'Onglet S' + n;
  const res = { titre: lignes[0] ? lignes[0][0] || '' : '', consigne: lignes[1] ? lignes[1][0] || '' : '', seances: [] };
  let seance = null, section = null, enteteVue = false;
  lignes.forEach((l, i) => {
    const a = l[0] || '';
    if (i < 2 || !l.length) return;
    // « SÉANCE 1 : JAMBES · lundi midi · 60 min » ou, sans le jour, « SÉANCE 1 : JAMBES · 60 min ».
    let m = a.match(/^SÉANCE\s+(\d+)\s*:\s*([^·]+?)\s*·\s*(.+)$/);
    if (m) {
      const parts = m[3].split('·').map(x => x.trim());
      let jour, moment = '', duree = parts[parts.length - 1];
      if (parts.length >= 2) {
        const mj = parts[0].match(/^(\S+)\s*(.*)$/); jour = mj[1].toLowerCase(); moment = mj[2];
        if (JOURS.indexOf(jour) < 0) avertir(ou + ', ligne ' + (i + 1) + ' : jour inconnu « ' + mj[1] + ' ».');
      } else {
        const t = seancesType[+m[1] - 1];
        jour = t ? t.jour : '';
        avertir(ou + ', ligne ' + (i + 1) + ' : jour absent de « ' + a + ' » ; repris de l\'onglet Plan (' + (jour || 'introuvable') + ').');
      }
      seance = { n: +m[1], nom: phrase(m[2]), jour, jourIndex: JOURS.indexOf(jour), moment, duree, sections: [] };
      res.seances.push(seance); section = null; enteteVue = false; return;
    }
    if (/^SÉANCE/i.test(a)) { avertir(ou + ', ligne ' + (i + 1) + ' : en-tête de séance illisible « ' + a + ' ».'); return; }
    if (!seance) { avertir(ou + ', ligne ' + (i + 1) + ' : ligne hors séance ignorée « ' + l.join(' | ') + ' ».'); return; }
    if (a === 'Exercice') { enteteVue = true; return; }
    if (!enteteVue) avertir(ou + ', séance ' + seance.n + ' : ligne d\'en-têtes « Exercice | Charge prévue … » manquante.');
    // Ligne de section : seule la colonne A est remplie, et le nom est celui d'une section
    // (« Warm up… », « BLOC… », « Retour au calme… » ou durée « (n min) »). Sinon : exercice sans détail.
    const estSection = l.length === 1 && (/\(\d+\s*min\)$/.test(a) || /^(warm up|bloc|retour au calme)/i.test(a));
    if (l.length === 1 && !estSection) avertir(ou + ', ligne ' + (i + 1) + ' : « ' + a + ' » n\'a que la colonne A remplie ; traité comme un exercice sans charge ni séries (pas comme une section).');
    if (estSection) {
      const ms = a.match(/^(.*?)\s*\((\d+)\s*min\)$/);
      const nom = ms ? ms[1] : a;
      section = { nom, minutes: ms ? +ms[2] : null, type: /^(warm up|retour au calme)/i.test(nom) ? 'liste' : 'travail', exercices: [] };
      seance.sections.push(section); return;
    }
    if (!section) { avertir(ou + ', ligne ' + (i + 1) + ' : exercice avant toute section, rangé dans « Sans section ».'); section = { nom: 'Sans section', minutes: null, type: 'travail', exercices: [] }; seance.sections.push(section); }
    if ((l[4] || '') !== '' || (l[5] || '') !== '') avertir(ou + ', ligne ' + (i + 1) + ' : colonnes E/F déjà remplies dans le plan (« ' + (l[4] || '') + ' » / « ' + (l[5] || '') + ' ») : non reprises.');
    const presc = lirePrescription(l[2] || '', ou + ', « ' + a + ' »');
    const charge = lireCharge(l[1] || '');
    // Identifiant stable : nom de l'exercice, suffixé s'il apparaît deux fois dans la séance (ex. marche latérale).
    let id = slug(a), k = 2; const ids = seance.sections.flatMap(s => s.exercices.map(e => e.id));
    while (ids.indexOf(id) >= 0) id = slug(a) + '-' + (k++);
    section.exercices.push({
      id, nom: a, cle: EXERCICES_CLES.indexOf(a) >= 0 ? slug(a) : null,
      chargePrevue: l[1] || '', prescription: l[2] || '', remarques: l[3] || '',
      // Saisie série par série seulement si le nombre de séries est lisible et hors échauffement / retour au calme.
      saisie: section.type === 'travail' && presc.series ? 'series' : 'case',
      p: presc, charge
    });
  });
  if (res.seances.length !== 3) avertir(ou + ' : ' + res.seances.length + ' séance(s) trouvée(s) au lieu de 3.');
  return res;
}

// ---------- Onglet Règles ----------
function lireRegles(lignes) {
  const sections = []; let cour = null;
  lignes.slice(1).forEach(l => {
    if (!l.length) return;
    if (l.length === 1) { cour = { titre: l[0], entrees: [] }; sections.push(cour); return; }
    if (!cour) { cour = { titre: '', entrees: [] }; sections.push(cour); }
    cour.entrees.push({ cle: l[0], texte: l[1] || '' });
  });
  const trouve = cle => { for (const s of sections) for (const e of s.entrees) if (e.cle.toLowerCase() === cle.toLowerCase()) return e.texte; return null; };
  const monter = trouve('Monter'), maintenir = trouve('Maintenir'), reduire = trouve('Réduire');
  // Seuils lus dans le texte des règles. Si la formulation change, le script s'arrête au lieu de deviner.
  const s1 = monter && monter.match(/RPE\s+(\d+)\s+ou moins/);
  const s2 = maintenir && maintenir.match(/RPE\s+(\d+)(?!\s*ou)/);
  const s3 = reduire && reduire.match(/RPE\s+(\d+)\s+ou plus/);
  if (!s1 || !s2 || !s3) { console.error('Onglet Règles : seuils de RPE introuvables dans Monter / Maintenir / Réduire. Mets à jour lireRegles().'); process.exit(1); }
  const decision = {
    monter: { texte: monter, rpeMax: +s1[1], fractionne: /qualité/.test(monter) ? 'qualite' : null },
    maintenir: { texte: maintenir, rpe: +s2[1], fractionne: /dégradé/.test(maintenir) ? 'degrade' : null },
    reduire: { texte: reduire, rpeMin: +s3[1], fractionne: /raté/.test(reduire) ? 'rate' : null, douleur: /douleur/.test(reduire), sommeil: /sommeil/.test(reduire) }
  };
  if (decision.monter.rpeMax + 1 !== decision.maintenir.rpe || decision.maintenir.rpe + 1 !== decision.reduire.rpeMin) {
    avertir('Onglet Règles : les seuils RPE ne se suivent pas (' + decision.monter.rpeMax + ' / ' + decision.maintenir.rpe + ' / ' + decision.reduire.rpeMin + ').');
  }
  return { sections, decision, rpe: trouve('RPE') };
}

// ---------- Assemblage ----------
const f = fichiers();
if (!f.plan) { console.error('Fichier Plan.csv introuvable dans ' + SOURCE); process.exit(1); }
if (!f.regles) { console.error('Fichier Règles.csv introuvable dans ' + SOURCE); process.exit(1); }
const plan = lirePlan(lireCSV(fs.readFileSync(f.plan, 'utf8')));
const regles = lireRegles(lireCSV(fs.readFileSync(f.regles, 'utf8')));
for (const s of plan.semaines) {
  if (!f.semaines[s.n]) continue;
  const d = lireSemaine(lireCSV(fs.readFileSync(f.semaines[s.n], 'utf8')), s.n, plan.seancesType);
  // Contrôle : le titre de l'onglet doit citer le même type de semaine que l'onglet Plan.
  if (s.type && d.titre.indexOf(s.type) < 0) avertir('Onglet S' + s.n + ' : le titre « ' + d.titre + ' » ne mentionne pas le type « ' + s.type + ' » de l\'onglet Plan.');
  Object.assign(s, d);
  // Contrôle : nom et jour de chaque séance identiques aux en-têtes de l'onglet Plan.
  d.seances.forEach(se => { const t = plan.seancesType[se.n - 1]; if (!t || t.nom.toLowerCase() !== se.nom.toLowerCase() || t.jour !== se.jour) avertir('Onglet S' + s.n + ', séance ' + se.n + ' (' + se.nom + ', ' + se.jour + ') : différente de l\'onglet Plan (' + (t ? t.nom + ', ' + t.jour : 'absente') + ').'); });
}
for (const n of Object.keys(f.semaines)) if (!plan.semaines.find(s => s.n === +n)) avertir('Onglet S' + n + ' : semaine absente de l\'onglet Plan, ignorée.');
if (plan.seancesPrevuesSheet !== null && plan.seancesPrevuesSheet !== plan.semaines.length * 3) {
  avertir('Onglet Plan : « Séances prévues » = ' + plan.seancesPrevuesSheet + ', alors que ' + plan.semaines.length + ' semaines × 3 = ' + plan.semaines.length * 3 + '.');
}

const sortie = {
  format: 1,
  genereLe: new Date().toISOString(),
  sources: [f.plan, f.regles].concat(Object.values(f.semaines)).map(p => path.basename(p)).sort(),
  debut: plan.debut,
  seancesParSemaine: plan.seancesType.length,
  seancesType: plan.seancesType,
  seancesPrevues: plan.seancesPrevuesSheet,
  exercicesCles: EXERCICES_CLES.map(nom => ({ cle: slug(nom), nom })),
  regles,
  semaines: plan.semaines,
  avertissements
};
// Sécurité : un onglet semaine présent mais sans ses séances donnerait une app vide pour cette semaine.
const incompletes = plan.semaines.filter(s => s.seances && s.seances.length !== plan.seancesType.length).map(s => s.id);
if (incompletes.length) { console.error('Plan NON écrit : séances manquantes dans ' + incompletes.join(', ') + '. Corrige le Sheet ou le script.'); process.exit(1); }
fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, JSON.stringify(sortie, null, 1) + '\n');
const detaillees = plan.semaines.filter(s => s.seances).map(s => s.id);
console.log('plan.json écrit : ' + path.relative(RACINE, SORTIE));
console.log(plan.semaines.length + ' semaines, détaillées : ' + (detaillees.join(', ') || 'aucune') + '. Avertissements : ' + avertissements.length + '.');
