/**
 * Calendriers culturaux — RDC, anciennes provinces d'Équateur et de Bandundu.
 *
 * ⚠️ STATUT : PROVISIONAL. Ces fenêtres de semis sont déduites du régime
 * pluviométrique bimodal général de la zone (deux saisons des pluies, une
 * sécheresse médiane plus marquée au sud). **Elles n'ont pas été validées par
 * un agronome local.** Toute recommandation produite à partir d'ici est
 * étiquetée « indicative » par le moteur.
 *
 * Comment remplacer ces valeurs :
 *   1. faire valider chaque fenêtre par un agronome local (dates réelles de
 *      semis observées dans la province, pas le calendrier théorique) ;
 *   2. renseigner `validatedBy` (nom + date) et passer `status` à `VALIDATED` ;
 *   3. remplacer `source.reference` par la référence réelle (service agricole
 *      provincial, station INERA, campagne observée).
 *   Le moteur refuse de marquer une recommandation « non indicative » tant que
 *   `status` vaut `PROVISIONAL` — il ne suffit pas de changer la date.
 *
 * Portée volontairement limitée : RDC uniquement, deux provinces. Aucune
 * abstraction multi-pays.
 */

/** Statut de validation du référentiel. */
export const REFERENCE_STATUS = Object.freeze({
  /** Non validé par un agronome : les sorties sont « indicatives ». */
  PROVISIONAL: 'PROVISIONAL',
  /** Validé : `validatedBy` et `validatedAt` doivent être renseignés. */
  VALIDATED: 'VALIDATED',
});

/**
 * Fenêtres de semis par culture et par province.
 *
 * `months` utilise la numérotation 1 = janvier. Une fenêtre peut couvrir le
 * passage d'année (`sowingStartMonth` > `sowingEndMonth`).
 *
 * `cycleDays` est la durée du cycle semis → récolte ; le moteur s'en sert pour
 * vérifier que la période demandée (ex. 60 jours) tient dans le cycle.
 */
export const CROP_CALENDARS = Object.freeze({
  Equateur: {
    province: 'Équateur',
    status: REFERENCE_STATUS.PROVISIONAL,
    validatedBy: null,
    validatedAt: null,
    source: {
      reference: null,
      note: 'Régime équatorial humide : précipitations abondantes presque toute '
        + 'l’année, courte saison sèche autour de janvier–février. Fenêtres '
        + 'déduites du climat général, **non validées localement**.',
    },
    /** Saison sèche courte — contrainte principale de la province. */
    drySeasonMonths: [1, 2],
    crops: Object.freeze({
      mais: {
        cropSlug: 'mais',
        label: 'Maïs',
        cycleDays: null, // à renseigner : varie fortement selon la variété
        windows: Object.freeze([
          // Première saison des pluies.
          { sowingStartMonth: 3, sowingEndMonth: 4, label: 'Saison A (mars–avril)' },
          // Seconde saison des pluies.
          { sowingStartMonth: 9, sowingEndMonth: 10, label: 'Saison B (septembre–octobre)' },
        ]),
        notes: 'Le maïs craint l’engorgement : éviter les bas-fonds en pleine saison des pluies.',
      },
      manioc: {
        cropSlug: 'manioc',
        label: 'Manioc',
        cycleDays: null,
        windows: Object.freeze([
          { sowingStartMonth: 9, sowingEndMonth: 11, label: 'Début de la grande saison des pluies' },
        ]),
        notes: 'Culture à cycle long ; la fenêtre de semis importe moins que pour les céréales.',
      },
      arachide: {
        cropSlug: 'arachide',
        label: 'Arachide',
        cycleDays: null,
        windows: Object.freeze([
          { sowingStartMonth: 3, sowingEndMonth: 4, label: 'Saison A' },
          { sowingStartMonth: 9, sowingEndMonth: 9, label: 'Saison B (fenêtre courte)' },
        ]),
        notes: 'Sensible à l’excès d’eau en fin de cycle : préférer une récolte avant les fortes pluies.',
      },
      riz: {
        cropSlug: 'riz',
        label: 'Riz',
        cycleDays: null,
        windows: Object.freeze([
          { sowingStartMonth: 9, sowingEndMonth: 10, label: 'Grande saison des pluies' },
        ]),
        notes: 'Riz pluvial ou de bas-fond selon la topographie — à préciser par l’agronome.',
      },
      'banane-plantain': {
        cropSlug: 'banane-plantain',
        label: 'Banane plantain',
        cycleDays: null,
        windows: Object.freeze([
          { sowingStartMonth: 3, sowingEndMonth: 5, label: 'Saison des pluies' },
          { sowingStartMonth: 9, sowingEndMonth: 11, label: 'Grande saison des pluies' },
        ]),
        notes: 'Culture permanente : la plantation peut s’étaler, mais l’enracinement exige de l’eau.',
      },
    }),
  },

  Bandundu: {
    province: 'Bandundu',
    status: REFERENCE_STATUS.PROVISIONAL,
    validatedBy: null,
    validatedAt: null,
    source: {
      reference: null,
      note: 'Climat tropical humide à saison sèche plus marquée qu’en Équateur '
        + '(juin–août). Fenêtres déduites du climat général, **non validées '
        + 'localement**.',
    },
    drySeasonMonths: [6, 7, 8],
    crops: Object.freeze({
      mais: {
        cropSlug: 'mais',
        label: 'Maïs',
        cycleDays: null,
        windows: Object.freeze([
          { sowingStartMonth: 9, sowingEndMonth: 10, label: 'Saison A (septembre–octobre)' },
          { sowingStartMonth: 2, sowingEndMonth: 3, label: 'Saison B (février–mars)' },
        ]),
        notes: 'La saison sèche juin–août exclut un semis sans irrigation.',
      },
      manioc: {
        cropSlug: 'manioc',
        label: 'Manioc',
        cycleDays: null,
        windows: Object.freeze([
          { sowingStartMonth: 9, sowingEndMonth: 11, label: 'Grande saison des pluies' },
        ]),
        notes: 'Culture dominante de la province.',
      },
      arachide: {
        cropSlug: 'arachide',
        label: 'Arachide',
        cycleDays: null,
        windows: Object.freeze([
          { sowingStartMonth: 10, sowingEndMonth: 11, label: 'Saison A' },
          { sowingStartMonth: 2, sowingEndMonth: 3, label: 'Saison B' },
        ]),
        notes: null,
      },
      niebe: {
        cropSlug: 'niebe',
        label: 'Niébé',
        cycleDays: null,
        windows: Object.freeze([
          { sowingStartMonth: 3, sowingEndMonth: 4, label: 'Petite saison des pluies' },
          { sowingStartMonth: 9, sowingEndMonth: 9, label: 'Saison B (fenêtre courte)' },
        ]),
        notes: 'Légumineuse à cycle court : utile en culture intercalaire.',
      },
      'patate-douce': {
        cropSlug: 'patate-douce',
        label: 'Patate douce',
        cycleDays: null,
        windows: Object.freeze([
          { sowingStartMonth: 3, sowingEndMonth: 4, label: 'Saison A' },
          { sowingStartMonth: 9, sowingEndMonth: 10, label: 'Saison B' },
        ]),
        notes: 'Supporte des sols pauvres ; sensible à l’engorgement prolongé.',
      },
    }),
  },
});

/** Provinces couvertes par le déploiement actuel. */
export const SUPPORTED_PROVINCES = Object.freeze(Object.keys(CROP_CALENDARS));

/**
 * Résout le calendrier d'une province.
 *
 * L'appariement est insensible aux accents et à la casse : la province vient de
 * `Farm.province`, un champ libre, et « Equateur » comme « Équateur » doivent
 * trouver le même calendrier plutôt que de faire échouer la recommandation.
 *
 * @returns {object|null} le calendrier, ou `null` si la province n'est pas couverte.
 */
export const resolveCalendar = (province) => {
  if (!province) return null;
  const normalise = (value) =>
    String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  const target = normalise(province);
  const key = SUPPORTED_PROVINCES.find((candidate) => normalise(candidate) === target);
  return key ? CROP_CALENDARS[key] : null;
};

/**
 * Cultures semables dans une fenêtre de mois donnée.
 *
 * Une fenêtre peut couvrir le passage d'année ; on teste donc l'appartenance
 * circulaire plutôt qu'une simple comparaison.
 */
export const cropsPlantableInMonths = (calendar, startMonth, endMonth) => {
  if (!calendar) return [];
  const spans = (from, to) => {
    const months = [];
    let current = from;
    // Garde-fou : une fenêtre de plus de 12 mois serait une donnée corrompue.
    for (let step = 0; step < 12; step += 1) {
      months.push(current);
      if (current === to) break;
      current = current >= 12 ? 1 : current + 1;
    }
    return months;
  };
  const requested = spans(startMonth, endMonth);
  const plantable = [];
  for (const crop of Object.values(calendar.crops)) {
    const window = crop.windows.find((candidate) =>
      spans(candidate.sowingStartMonth, candidate.sowingEndMonth).some((month) => requested.includes(month)),
    );
    if (window) plantable.push({ ...crop, matchedWindow: window });
  }
  return plantable;
};

/** Le référentiel est-il validé ? Toute la réponse « indicative » en dépend. */
export const isCalendarValidated = (calendar) => calendar?.status === REFERENCE_STATUS.VALIDATED;
