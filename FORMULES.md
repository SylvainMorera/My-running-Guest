# Formules utilisées par l'outil

Chaque formule indique son **statut** :

- **définition** : arithmétique pure, sans hypothèse ;
- **convention** : règle d'usage répandue, pas une loi physiologique ;
- **convention de l'outil** : choix fait pour cet outil, modifiable ;
- **modèle publié** : issu d'une publication citée ;
- **à valider** : pas encore vérifié sur une source fiable.

Les tests associés se trouvent dans `index.html`, bloc `<script id="core">`, tableau `TESTS`. Pour les lancer :

- dans le navigateur : onglet Données, puis « Lancer les autotests » (`#/tests`) ;
- en ligne de commande : `node tests/run.mjs`.

## Phase 1 : champs calculés d'une séance

| Grandeur | Formule | Statut | Test de référence (calculé à la main) |
|---|---|---|---|
| Allure moyenne (s/km) | durée (s) / distance (km) | définition | 3000 s / 10 km = 300 s/km = 5:00 /km |
| Vitesse moyenne (km/h) | distance (km) / (durée (s) / 3600) | définition | 10 km en 3000 s = 12 km/h |
| Allure depuis une vitesse | allure (min/km) = 60 / v (km/h), soit 3600 / v en s/km | définition | 14,4 km/h → 250 s = 4:10 /km |
| km-effort | km + D+ (m) / 100 | convention (trail) | 30 km + 1200 m D+ = 42 km-effort |
| % de VMA moyen | vitesse moyenne / VMA × 100 | définition | 12 km/h, VMA 19,6 → 61,22 % |
| VMA courante | mesure la plus récente de l'historique (par date) | convention de l'outil | — |

### Précisions

**Arrondi de l'allure.** L'allure est arrondie à la seconde la plus proche. Par exemple, 299,6 s s'affiche 5:00 et non 4:60.

**Durée ou distance nulle.** Si la durée ou la distance vaut zéro, l'allure, la vitesse et le % de VMA ne sont pas calculés : l'interface affiche « — ». C'est le cas d'une séance de renfo à 0 km.

**% de VMA moyen.** C'est la moyenne sur toute la séance, récupérations comprises. Sur une séance fractionnée, ce n'est pas l'intensité des répétitions.

**km-effort : sources.**

- Convention utilisée par l'ITRA pour classer la difficulté des courses : 1 km de distance = 1 km-effort, et 100 m de D+ = 1 km-effort. Le D− n'est pas compté.
  - Source : ITRA, « Discover trail running », https://itra.run/About/DiscoverTrailRunning.
  - Limite : la page a été repérée par une recherche web le 11/10/2026, mais elle n'a pas pu être consultée directement (domaine inaccessible depuis l'environnement de développement). **Formule à confirmer en lisant cette page.**
- Formulation « km + D+/100 » reprise par des sources secondaires, par exemple Campus Coach, « Analyser le parcours de son prochain trail », https://www.campus.coach/blog/analyser-parcours-prochain-trail (exemple cité : 30 km et 1200 m D+ = 42 km-effort).
- Limite de la convention : elle ignore la technicité du terrain et la descente.

## Dates et fuseau horaire (convention de l'outil)

- Les dates sont stockées au format `AAAA-MM-JJ` (date civile, sans heure).
- La « date du jour » est calculée dans le fuseau **Europe/Paris**, quel que soit le fuseau de l'appareil. Les tests couvrent les passages à l'heure d'été et à l'heure d'hiver.
- Les semaines vont du **lundi au dimanche** (ISO 8601).
- Saisie acceptée : `jj/mm/aaaa`, `j/m/aaaa`, `jj-mm-aaaa`, `jj.mm.aaaa` et `aaaa-mm-jj`. Une date impossible, comme le 31/02, est refusée.
- Les nombres s'écrivent avec une virgule ou un point décimal. Les espaces de milliers sont acceptés (« 1 234,5 »).

## Phase 2 : règles d'import

### Séance réalisée ou prévue : champs obligatoires (convention de l'outil)

- **Séance réalisée** : la durée est obligatoire. La distance est obligatoire aussi, sauf pour le type « renfo ».
- **Séance prévue** : la durée et la distance sont facultatives.

### Statut déduit (convention de l'outil)

Si aucune colonne « statut » n'est associée, une ligne est **réalisée** dès qu'une durée ou des km sont renseignés. Sinon, elle est **prévue**.

### Valeurs lues dans un tableau

| Valeur | Lecture | Statut |
|---|---|---|
| Date Excel (nombre) | système 1900 : date = 30/12/1899 + partie entière du nombre (valable à partir du 01/03/1900, série 61) ; système 1904 : date = 01/01/1904 + nombre | définition du format (le faux 29/02/1900 hérité de Lotus 1-2-3 explique le décalage d'origine) |
| Durée Excel (nombre) | secondes = fraction de jour × 86 400, arrondi à la seconde | définition du format |
| Durée texte | `h:mm:ss` uniquement. `48:42` est refusé : on ne peut pas savoir s'il s'agit de mm:ss ou de h:mm | convention de l'outil |
| Intensité | premier chiffre de 1 à 5 en tête du texte (« 3 = Modérée » → 3) | convention de l'outil |
| Conformité | ✓ → conforme ; ~ → partiel ; ✗ → non conforme | convention de l'outil |

**Champs essentiels** (date, durée, distance) : une valeur illisible fait rejeter la ligne, et le rapport donne la raison. Exemple : « 10;94 » n'est jamais corrigé en 10,94 de manière automatique.

**Autres champs** : une valeur illisible est signalée dans les avertissements et conservée dans les notes.

**Lignes ignorées** (repos, avant la date de début) : si elles contiennent des notes ou des commentaires, elles sont signalées dans les avertissements.

### Dates des cellules fusionnées (convention de l'outil)

Quand deux séances ont lieu le même jour, la date est souvent dans une cellule fusionnée. Les lignes concernées reprennent la date de cette cellule. Pour un CSV, elles reprennent la date de la ligne précédente.

### Extraction de la durée ou de la distance d'une consigne (convention de l'outil, désactivable)

Elle ne s'applique qu'aux séances prévues sans durée ni distance. Étapes :

1. Le texte entre parenthèses est ignoré.
2. Les allures (`5:05 min/km`, `3'50''/km`) et les vitesses (`18,4 km/h`) sont ignorées.
3. Une séance à répétitions (`5x3'`, `10x 200m`) n'est jamais extraite.
4. Les durées reconnues sont `40'`, `40' min`, `40 min`, `2'30`, `1h30`, `2h` et `30"`. Une durée n'est retenue que si la consigne en contient **exactement une**. Même règle pour les distances (`12 km`).
5. Toute valeur extraite porte la mention « extraite », avec le texte d'origine. Elle perd cette mention dès qu'elle est modifiée à la main.

Exemples (testés) :

| Consigne | Résultat |
|---|---|
| `80' min à 5:05 min/km (environ 129-139BPM) (plafond 85')` | 80 min (la valeur entre parenthèses est ignorée) |
| `45' min à 5:05 min/km + 10' Gammes` | non extraite (deux durées) |
| `…, 6 h après le footing` | non extraite (l'heure doit être collée au nombre) |

### Doublons (règle du cahier des charges)

Deux séances réalisées sont un doublon possible si elles tombent le même jour, avec une distance à ±1 % et une durée à ±1 %. L'écart se compare à la plus grande des deux valeurs ; deux valeurs absentes comptent comme égales.

Lors d'un import de tableau, une séance réalisée liée à la même séance prévue qu'une séance existante est aussi un doublon possible.

### Ré-import d'un tableau (convention de l'outil)

Chaque séance importée reçoit une clé : nom de la source + date + rang dans la journée. Au ré-import, cette clé sert à classer chaque séance : nouvelle, identique ou modifiée (avec le détail avant → après), ou absente du fichier.

Les séances absentes sont conservées par défaut. Si une séance est ajoutée en tête d'une journée, le rang des suivantes change : ces séances apparaissent alors comme modifiées, jamais modifiées sans que tu le voies.

### Fichiers d'activité

**FIT.** Lecture du message « session » (n° 18). Numéros de champs vérifiés dans le profil officiel du SDK FIT JavaScript de Garmin, version 21.218.0 (paquet npm `@garmin/fitsdk`, https://github.com/garmin/fit-javascript-sdk) :

| Champ | N° | Unité |
|---|---|---|
| start_time | 2 | — |
| sport | 5 | 1 = course à pied |
| sub_sport | 6 | 1 tapis, 3 trail, 4 piste |
| total_elapsed_time | 7 | ms |
| total_timer_time | 8 | ms |
| total_distance | 9 | cm |
| avg_heart_rate | 16 | bpm |
| total_ascent | 22 | m |

- Les dates FIT sont des secondes comptées depuis le 31/12/1989 00:00 UTC ; elles sont converties en date de Paris.
- Le contrôle CRC-16 reprend l'algorithme du SDK.
- Le lecteur a été validé sur un fichier produit par l'encodeur officiel du SDK.
- La durée retenue est au choix : temps chrono (`total_timer_time`, par défaut) ou temps total écoulé (`total_elapsed_time`).

**TCX.** La durée et la distance sont la somme des tours (`TotalTimeSeconds`, `DistanceMeters`). La FC est la moyenne des tours, pondérée par leur durée. Le D+ est la somme brute des hausses de `AltitudeMeters`, sans lissage.

**GPX.** Il n'y a pas de totaux dans le fichier, donc tout est calculé :

- **Distance** : somme des distances orthodromiques entre points, par la formule de haversine sur une sphère de rayon R = 6 371 008,8 m.
  - Statut : modèle sphérique, approximation.
  - Rayon : rayon moyen R1 de l'ellipsoïde GRS80 (Moritz, H., 2000, « Geodetic Reference System 1980 », *Journal of Geodesy* 74, p. 128-133). Valeur non revérifiée en ligne dans cette session.
- **D+** : somme brute des hausses d'altitude, sans lissage. Il est en général supérieur au D+ affiché par la montre.
- **FC** : moyenne simple des points.
- **Durée** : dernier horodatage moins le premier.

Ces limites sont notées dans les notes de chaque séance importée.

## Phase 3 : tableau de bord

Le tableau de bord n'affiche que des faits chiffrés, sans conseil ni alerte. Seules les séances **réalisées** entrent dans les totaux de volume.

| Indicateur | Calcul | Statut |
|---|---|---|
| Cartes semaine / mois / année | somme des séances réalisées de la période en cours (semaine du lundi au dimanche, mois civil, année civile ; heure de Paris) | définition |
| Écart avec la période précédente | réalisé de la période en cours moins réalisé de la période précédente **arrêtée au même jour**. Exemple : un mercredi, on compare au lundi-mercredi de la semaine précédente. Un 31 mars, on compare au 1er-28 février. Un 29 février, on compare au 28 février de l'année précédente | convention de l'outil, pour comparer des durées égales |
| Numéro de semaine | semaine ISO 8601 : la semaine 1 contient le premier jeudi de l'année. Le 01/01/2027 est en S53 de 2026 | norme ISO 8601 |
| Durée prévue d'une semaine | somme des durées des séances prévues qui en ont une, avec le nombre de séances prévues sans durée | définition |
| Écart prévu / réalisé | réalisé − prévu, calculé **seulement si toutes** les séances prévues de la semaine ont la valeur. Sinon « n.c. » (non calculé) | convention de l'outil |
| Allure moyenne par type | durée totale / distance totale des séances du type qui ont une durée et une distance. C'est une moyenne pondérée par la distance, pas la moyenne des allures. Exemple : 10 km en 50:00 et 5 km en 30:00 donnent 5:20 /km, pas 5:30 | définition |
| Records | plus grande distance, durée, D+ et km-effort. Meilleure allure moyenne d'une séance d'au moins 5 km, 10 km, 21,0975 km et 42,195 km. À égalité, la séance la plus ancienne garde le record | convention de l'outil |
| Compte à rebours | nombre de jours entre aujourd'hui (Paris) et la date de la prochaine course A | définition |
| Chaussures | km de départ + distance des séances réalisées avec la paire. La part du km max indicatif vaut km cumulés / km max × 100 | définition |
| Objectifs du mois | réalisé du mois civil / objectif saisi × 100 | définition |

**Limite des records d'allure.** Les données ne contiennent que les totaux de chaque séance. La « meilleure allure sur 10 km » est donc l'allure moyenne de la séance entière la plus rapide parmi celles d'au moins 10 km, échauffement compris. Ce n'est pas un meilleur segment de 10 km.

**Vérification.** La page d'autotests (`#/tests`) compare chaque carte à une somme directe des séances du journal (km, D+, durée, nombre de séances).

## Phase 4 : plan et calendrier (conventions de l'outil)

**Calendrier**
- Les semaines vont du lundi au dimanche.
- La grille du mois couvre les semaines complètes qui contiennent au moins un jour du mois. Exemple : octobre 2026 va du lundi 28/09 au dimanche 01/11, soit 5 lignes.
- Dans la vue semaine, une séance prévue est placée sur la même ligne que la séance réalisée qui lui est liée, si elles tombent le même jour. Sinon, la séance prévue indique « réalisée le … ».

**Totaux prévus**
- Mêmes règles que le tableau de bord : on fait la somme des valeurs connues, et on indique « (n sans) » pour les séances prévues sans la valeur.
- On affiche « — » si aucune séance prévue n'a la valeur.

**Récurrence**
- On choisit des jours de la semaine (lundi à dimanche) et un nombre de semaines, compté à partir de la semaine qui contient la date de début. Les dates antérieures à cette date de début sont exclues.
- Exemple : mardi et jeudi, 2 semaines, à partir du jeudi 15/10/2026 donnent 15/10, 20/10 et 22/10. Le mardi 13/10 est exclu.
- La liste des dates est affichée et doit être confirmée avant la création.
- Les séances créées partagent un identifiant de série. « Supprimer la série à partir de cette date » ne supprime que les séances **prévues** de la série, à partir de la date choisie, et peut être annulé.

**Semaine type**
- C'est un modèle de semaine : jour (lundi à dimanche), type, intitulé, consigne, et durée, distance et D+ prévus s'ils sont connus.
- On l'enregistre à partir des séances prévues de la semaine affichée.
- L'appliquer crée des séances prévues aux mêmes jours de la semaine choisie. Rien n'est remplacé : si la semaine contient déjà des séances prévues, une confirmation est demandée avant d'ajouter.

**Déplacement**
- Seules les séances prévues se déplacent, par glisser-déposer sur ordinateur ou avec le bouton « Déplacer » sur tous les écrans. Une séance réalisée se modifie depuis sa fiche.
- Chaque déplacement peut être annulé.
- Une séance importée garde sa clé d'import quand on la déplace. Au ré-import suivant, son changement de date apparaît dans les « modifications à appliquer » : tu peux alors garder ta date en décochant la ligne.

## Phase 5 : calculateurs VMA

Tous les calculateurs utilisent la « VMA utilisée » saisie en haut de la page. Elle est préremplie avec la mesure la plus récente de l'historique et peut être modifiée sans changer cet historique. Sans VMA, les calculateurs qui en ont besoin le demandent au lieu de calculer.

| Calculateur | Formule | Statut | Test (calculé à la main) |
|---|---|---|---|
| Zones d'allure | vitesse = VMA × % / 100 ; allure (min/km) = 60 / vitesse | définition | VMA 18 × 80 % = 14,4 km/h → 4:10 /km ; VMA 20 × 65 % = 13 km/h → 4:37 /km |
| Séances types | voir le détail ci-dessous | définition | 10 × 400 m à 100 % de VMA 18, récupération 1:00 à l'arrêt → 1:20 par répétition, 22:20, 4 km |
| Temps de passage | temps = allure × distance ; avec un temps cible, allure = temps / distance (allure constante) | définition | semi à 5:00 /km → 1:45:29 |
| Prédiction de chrono | T2 = T1 × (D2 / D1)^k, k = 1,06 par défaut (modifiable) | modèle publié ; **exposant non vérifié** sur la source primaire | 10 km en 40:00 → semi en 1:28:15 |
| Allure en pente | Cr(i) = 155,4 i⁵ − 30,4 i⁴ − 43,3 i³ + 46,3 i² + 19,5 i + 3,6 ; allure en pente = allure sur plat × Cr(i) / Cr(0) | modèle publié (vérifié par extrait) + convention de l'outil pour l'équivalence | 5:00 /km sur plat ≡ 8:17 à +10 % et 2:59 à −10 % |
| VMA, test de 6 min (demi-Cooper) | VMA (km/h) = distance (m) / 100, soit la vitesse moyenne sur 6 min | convention de terrain | 1 650 m → 16,5 km/h |
| VMA, test à paliers | VMA = vitesse du dernier palier complété. Option : + incrément × (secondes tenues / durée du palier) | convention de terrain ; **option non vérifiée** | 19,5 → 19,5 ; avec 30 s sur 60 s d'un palier de +0,5 → 19,75 |
| Convertisseur | allure (s/km) = 3600 / vitesse ; vitesse = 3600 / allure | définition | 14,4 km/h ↔ 4:10 /km |

### Détail du calculateur de séances types

- La séance compte **n répétitions et n − 1 récupérations** : il n'y a pas de récupération après la dernière répétition.
- **Durée totale** = n × durée de l'effort + (n − 1) × récupération + échauffement + retour au calme.
- **Distance totale** = n × distance de l'effort + (n − 1) × distance de récupération + échauffement + retour au calme.
- **Distance de récupération** : 0 % = récupération statique (distance nulle). Un champ vide = trot à allure non précisée : la distance totale n'est alors pas estimée.
- **Côtes** : seule la durée est estimée. La distance dépend de la pente.
- **Valeurs par défaut** (nombre de répétitions, %, récupérations) : ce sont des valeurs courantes à adapter, pas des prescriptions.

### Zones d'allure par défaut

Les pourcentages par défaut reprennent ta feuille « Mes Zones » (fichier Excel du plan, zones établies sur une VMA de 20,0 km/h) :

| Zone | % de VMA |
|---|---|
| Endurance fondamentale | 60-65 |
| Endurance active | 70-75 |
| Seuil bas | 80 |
| Seuil haut | 85 |
| Allure 10 km | 90-92 |
| VMA longue | 95 |
| VMA courte | 100-105 |

Ce sont tes valeurs, pas des valeurs physiologiques universelles. Elles sont modifiables et enregistrables.

### Sources et niveau de vérification

L'environnement de développement n'avait pas accès aux PDF des publications : le proxy refusait les domaines `iris.unibs.it`, `nku.edu`, `journals.physiology.org` et `semanticscholar.org`. Les vérifications ont donc été faites par recherche web le 11/10/2026.

**Riegel**
- Référence : Riegel, P. S. (1981). « Athletic Records and Human Endurance ». *American Scientist*, 69(3), 285-290.
- Ce qui est confirmé : la formule T2 = T1 × (D2/D1)^k, attribuée à cet article par de nombreuses sources.
- Ce qui ne l'est pas : la valeur **k = 1,06**. Elle vient de sources secondaires et **n'a pas été lue dans l'article**. Une analyse de la figure de l'article (Northern Kentucky University, https://nku.edu/~longa/classes/mat375/docs/CrossCountry/riegel.pdf, non lue directement) donne un exposant ajusté d'environ 1,077.
- Limite : le modèle est ajusté sur des records du monde.

**Minetti**
- Référence : Minetti, A. E., Moia, C., Roi, G. S., Susta, D. & Ferretti, G. (2002). « Energy cost of walking and running at extreme uphill and downhill slopes ». *Journal of Applied Physiology*, 93(3), 1039-1046, doi:10.1152/japplphysiol.01177.2001.
- Coefficients du polynôme : vérifiés sur un extrait du texte de l'article (copie PDF hébergée sur softrun.fr et runscribe.com, restituée par la recherche web) et sur deux sources secondaires concordantes. **Lecture intégrale de l'article non faite.**
- Domaine de validité : pentes de −0,45 à +0,45, mesures sur tapis roulant, 10 coureurs.
- Équivalence plat ↔ pente : elle suppose une puissance métabolique égale (vitesse × coût identiques sur plat et en pente). C'est une **application** du modèle (convention de l'outil), pas un résultat publié. Elle ignore la technicité du terrain et la fatigue musculaire en descente.

**Demi-Cooper**
- Règle concordante dans des sources de vulgarisation, par exemple Campus Coach, « Test demi-Cooper », https://www.campus.coach/blog/test-demi-cooper.
- Certaines sources signalent une sous-estimation si l'allure est mal gérée.

**Test à paliers**
- La règle du dernier palier validé est concordante dans plusieurs sources, par exemple The Running Collective, https://blog.therunningcollective.fr/test-vma-methodes-conseils-et-comparatif-complet/.
- Ces sources évoquent un ajustement pour un palier inachevé sans en donner la formule. La correction proposée ici est donc affichée « non vérifiée » et désactivée par défaut.
- Le protocole Vameval décrit dans ces sources (départ à 8 km/h, +0,5 km/h par minute) correspond à celui de ton test sur tapis.

## Phase 6 : bilan mensuel et export CSV

- **Bilan mensuel** : mêmes définitions que le tableau de bord (séances réalisées uniquement), limitées aux jours du mois civil choisi (heure de Paris).
- **Comparaison** : avec le mois précédent **complet**. C'est différent du tableau de bord, qui compare « au même jour ».
- **Semaines** : du lundi au dimanche, tronquées aux jours du mois.
- **Allure moyenne par type** : moyenne pondérée (durée totale / distance totale).
- **Export CSV** : les valeurs dérivées (allure, vitesse, km-effort, % de VMA) sont recalculées avec les formules ci-dessus. Le % de VMA utilise la VMA courante au moment de l'export. Les valeurs extraites d'une consigne sont signalées dans une colonne dédiée.

## Phase 2 optionnelle : synchronisation Strava (correspondance des champs)

| Séance | Champ Strava (liste `GET /athlete/activities`) | Statut |
|---|---|---|
| Date | partie date de `start_date_local` (heure locale du lieu de l'activité) | champ documenté ; usage de la date locale = convention de l'outil |
| Durée | `moving_time` (temps en mouvement) ou `elapsed_time` (temps total), au choix | champs documentés, en secondes |
| Distance | `distance` / 1000 | mètres → km |
| D+ | `total_elevation_gain`, arrondi au mètre | mètres |
| FC moyenne | `average_heartrate`, arrondie au bpm | présence dans la liste **non vérifiée** : vide si absent |
| Intitulé | `name` | — |
| Clé d'import | `strava:` + `id` (une activité n'est jamais importée deux fois) | convention de l'outil |

- **Fenêtre de lecture** : à la première synchronisation, depuis la date de reprise (01/01/2026 par défaut, moins un jour de marge). Ensuite, depuis l'activité la plus récente déjà lue, moins un jour.
- **Volume** : 100 activités par requête, au plus 30 requêtes par synchronisation, pour rester sous la limite de lecture Strava (100 requêtes par 15 min).
- **Doublons** : même règle que les autres imports (date, distance ±1 %, durée ±1 %).
