/*
 * Navigation des espaces metier : source unique, alimentee par les
 * ROUTES REELLES declarees dans src/App.tsx. Chaque lien est verifie a
 * l execution du script fix-p3-layout.mjs (path="..." reel requis) ;
 * aucun chemin invente.
 *
 * Activation precise : /market et /investment melangent pages publiques
 * et espaces prives ; seuls les sous-chemins prives recoivent la
 * coquille espace. Le reste du site public reste sur Header/Footer.
 */
export interface LienEspace {
  to: string;
  label: string;
  icone?: string;
}

export interface GroupeEspace {
  titre: string;
  items: LienEspace[];
}

export interface EspaceDef {
  id: string;
  titre: string;
  groupes: GroupeEspace[];
}

export const ESPACES: EspaceDef[] = [
  {
    "id": "admin",
    "titre": "Administration",
    "groupes": [
      {
        "titre": "Pilotage",
        "items": [
          {
            "to": "/admin",
            "label": "Accueil",
            "icone": "maison"
          },
          {
            "to": "/admin/dashboard",
            "label": "Tableau de bord",
            "icone": "graphe"
          },
          {
            "to": "/admin/monitoring",
            "label": "Supervision",
            "icone": "cible"
          },
          {
            "to": "/admin/operations",
            "label": "Opérations",
            "icone": "dossier"
          },
          {
            "to": "/admin/jobs",
            "label": "Tâches planifiées",
            "icone": "sync"
          }
        ]
      },
      {
        "titre": "Réseau agricole",
        "items": [
          {
            "to": "/admin/producers",
            "label": "Producteurs",
            "icone": "personne"
          },
          {
            "to": "/admin/farmers",
            "label": "Agriculteurs",
            "icone": "feuille"
          },
          {
            "to": "/admin/farms",
            "label": "Exploitations",
            "icone": "maison"
          },
          {
            "to": "/admin/plots",
            "label": "Parcelles",
            "icone": "carte"
          },
          {
            "to": "/admin/productions",
            "label": "Productions",
            "icone": "feuille"
          },
          {
            "to": "/admin/lots",
            "label": "Lots",
            "icone": "boite"
          },
          {
            "to": "/admin/crops",
            "label": "Cultures",
            "icone": "feuille"
          },
          {
            "to": "/admin/prices",
            "label": "Prix",
            "icone": "graphe"
          },
          {
            "to": "/admin/countries",
            "label": "Pays",
            "icone": "globe"
          }
        ]
      },
      {
        "titre": "Utilisateurs",
        "items": [
          {
            "to": "/admin/users",
            "label": "Utilisateurs",
            "icone": "utilisateurs"
          },
          {
            "to": "/admin/roles",
            "label": "Rôles",
            "icone": "cible"
          },
          {
            "to": "/admin/verifications",
            "label": "Vérifications",
            "icone": "verification"
          },
          {
            "to": "/admin/moderation",
            "label": "Modération",
            "icone": "message"
          }
        ]
      },
      {
        "titre": "Marché",
        "items": [
          {
            "to": "/admin/orders",
            "label": "Commandes",
            "icone": "panier"
          },
          {
            "to": "/admin/marketplace",
            "label": "Marketplace",
            "icone": "boite"
          },
          {
            "to": "/admin/cooperatives",
            "label": "Coopératives",
            "icone": "utilisateurs"
          }
        ]
      },
      {
        "titre": "Projets & finance",
        "items": [
          {
            "to": "/admin/projects",
            "label": "Projets",
            "icone": "dossier"
          },
          {
            "to": "/admin/investors",
            "label": "Investisseurs",
            "icone": "personne"
          }
        ]
      },
      {
        "titre": "Communication",
        "items": [
          {
            "to": "/admin/messages",
            "label": "Messages",
            "icone": "message"
          },
          {
            "to": "/admin/notifications",
            "label": "Notifications",
            "icone": "cloche"
          }
        ]
      },
      {
        "titre": "Système",
        "items": [
          {
            "to": "/admin/sync",
            "label": "Synchronisation",
            "icone": "sync"
          },
          {
            "to": "/admin/devices",
            "label": "Appareils",
            "icone": "appareils"
          },
          {
            "to": "/admin/api-clients",
            "label": "Clients API",
            "icone": "clef"
          },
          {
            "to": "/admin/ai-usage",
            "label": "Usage IA",
            "icone": "graphe"
          },
          {
            "to": "/admin/data-products",
            "label": "Produits de données",
            "icone": "boite"
          },
          {
            "to": "/admin/partners",
            "label": "Partenaires",
            "icone": "utilisateurs"
          },
          {
            "to": "/admin/compliance",
            "label": "Conformité",
            "icone": "verification"
          },
          {
            "to": "/admin/agronomic-ranges",
            "label": "Zones agro",
            "icone": "carte"
          },
          {
            "to": "/admin/rules",
            "label": "Règles",
            "icone": "livre"
          },
          {
            "to": "/admin/security",
            "label": "Sécurité",
            "icone": "verification"
          },
          {
            "to": "/admin/audit",
            "label": "Audit",
            "icone": "livre"
          },
          {
            "to": "/admin/settings",
            "label": "Paramètres",
            "icone": "reglages"
          },
          {
            "to": "/admin/reports",
            "label": "Rapports",
            "icone": "facture"
          }
        ]
      }
    ]
  },
  {
    "id": "app",
    "titre": "Mon espace",
    "groupes": [
      {
        "titre": "Activité",
        "items": [
          {
            "to": "/app",
            "label": "Tableau de bord",
            "icone": "graphe"
          },
          {
            "to": "/app/farms",
            "label": "Exploitations",
            "icone": "maison"
          },
          {
            "to": "/app/plots",
            "label": "Parcelles",
            "icone": "carte"
          },
          {
            "to": "/app/productions",
            "label": "Productions",
            "icone": "feuille"
          },
          {
            "to": "/app/soil",
            "label": "Sol",
            "icone": "couches"
          },
          {
            "to": "/app/inventory",
            "label": "Inventaire",
            "icone": "boite"
          }
        ]
      },
      {
        "titre": "Marché",
        "items": [
          {
            "to": "/app/orders",
            "label": "Commandes",
            "icone": "panier"
          },
          {
            "to": "/app/invoices",
            "label": "Factures",
            "icone": "facture"
          },
          {
            "to": "/app/cooperative",
            "label": "Coopérative",
            "icone": "utilisateurs"
          },
          {
            "to": "/app/cooperative/offers",
            "label": "Offres coopérative",
            "icone": "boite"
          },
          {
            "to": "/app/cooperative/orders",
            "label": "Commandes coopérative",
            "icone": "panier"
          },
          {
            "to": "/app/transport",
            "label": "Transport",
            "icone": "camion"
          }
        ]
      },
      {
        "titre": "Communication",
        "items": [
          {
            "to": "/app/messages",
            "label": "Messages",
            "icone": "message"
          },
          {
            "to": "/app/notifications",
            "label": "Notifications",
            "icone": "cloche"
          },
          {
            "to": "/app/sms-consent",
            "label": "Consentement SMS",
            "icone": "message"
          }
        ]
      },
      {
        "titre": "Compte",
        "items": [
          {
            "to": "/app/profile",
            "label": "Profil",
            "icone": "personne"
          },
          {
            "to": "/app/verification",
            "label": "Vérification",
            "icone": "verification"
          },
          {
            "to": "/app/agent",
            "label": "Espace agent",
            "icone": "personne"
          },
          {
            "to": "/app/season-feedback",
            "label": "Bilan de saison",
            "icone": "livre"
          }
        ]
      }
    ]
  },
  {
    "id": "farmer",
    "titre": "Mon exploitation",
    "groupes": [
      {
        "titre": "Activité",
        "items": [
          {
            "to": "/farmer",
            "label": "Tableau de bord",
            "icone": "graphe"
          },
          {
            "to": "/farmer/farms",
            "label": "Exploitations",
            "icone": "maison"
          },
          {
            "to": "/farmer/plots",
            "label": "Parcelles",
            "icone": "carte"
          },
          {
            "to": "/farmer/productions",
            "label": "Productions",
            "icone": "feuille"
          },
          {
            "to": "/farmer/soil",
            "label": "Sol",
            "icone": "couches"
          },
          {
            "to": "/farmer/lots",
            "label": "Lots",
            "icone": "boite"
          }
        ]
      },
      {
        "titre": "Projets & export",
        "items": [
          {
            "to": "/farmer/export",
            "label": "Export",
            "icone": "globe"
          },
          {
            "to": "/farmer/projects",
            "label": "Projets",
            "icone": "dossier"
          },
          {
            "to": "/farmer/certifications",
            "label": "Certifications",
            "icone": "verification"
          }
        ]
      },
      {
        "titre": "Terrain & données",
        "items": [
          {
            "to": "/farmer/surveys",
            "label": "Enquêtes",
            "icone": "livre"
          },
          {
            "to": "/farmer/devices",
            "label": "Appareils",
            "icone": "appareils"
          },
          {
            "to": "/farmer/gallery",
            "label": "Galerie",
            "icone": "grille"
          },
          {
            "to": "/farmer/sync",
            "label": "Synchronisation",
            "icone": "sync"
          },
          {
            "to": "/farmer/conflicts",
            "label": "Conflits",
            "icone": "cible"
          }
        ]
      },
      {
        "titre": "Compte",
        "items": [
          {
            "to": "/farmer/alerts",
            "label": "Alertes",
            "icone": "cloche"
          },
          {
            "to": "/farmer/profile",
            "label": "Profil",
            "icone": "personne"
          },
          {
            "to": "/farmer/public-profile",
            "label": "Profil public",
            "icone": "globe"
          },
          {
            "to": "/farmer/verification",
            "label": "Vérification",
            "icone": "verification"
          },
          {
            "to": "/farmer/settings",
            "label": "Paramètres",
            "icone": "reglages"
          }
        ]
      }
    ]
  },
  {
    "id": "organization",
    "titre": "Mon organisation",
    "groupes": [
      {
        "titre": "Général",
        "items": [
          {
            "to": "/organization",
            "label": "Accueil",
            "icone": "maison"
          },
          {
            "to": "/organization/overview",
            "label": "Vue d'ensemble",
            "icone": "graphe"
          },
          {
            "to": "/organization/profile",
            "label": "Profil",
            "icone": "personne"
          }
        ]
      },
      {
        "titre": "Membres",
        "items": [
          {
            "to": "/organization/members",
            "label": "Membres",
            "icone": "utilisateurs"
          },
          {
            "to": "/organization/invitations",
            "label": "Invitations",
            "icone": "message"
          },
          {
            "to": "/organization/import",
            "label": "Import",
            "icone": "dossier"
          }
        ]
      },
      {
        "titre": "Exploitation",
        "items": [
          {
            "to": "/organization/farms",
            "label": "Exploitations",
            "icone": "maison"
          },
          {
            "to": "/organization/production",
            "label": "Production",
            "icone": "feuille"
          },
          {
            "to": "/organization/verification",
            "label": "Vérification",
            "icone": "verification"
          }
        ]
      }
    ]
  },
  {
    "id": "reviewer",
    "titre": "Revue & conformité",
    "groupes": [
      {
        "titre": "Missions",
        "items": [
          {
            "to": "/reviewer/missions",
            "label": "Missions",
            "icone": "dossier"
          }
        ]
      }
    ]
  },
  {
    "id": "developers",
    "titre": "Espace développeur",
    "groupes": [
      {
        "titre": "API",
        "items": [
          {
            "to": "/developers",
            "label": "Accueil",
            "icone": "code"
          },
          {
            "to": "/developers/keys",
            "label": "Clés",
            "icone": "clef"
          },
          {
            "to": "/developers/usage",
            "label": "Usage",
            "icone": "graphe"
          },
          {
            "to": "/developers/docs",
            "label": "Documentation",
            "icone": "livre"
          }
        ]
      }
    ]
  },
  {
    "id": "marche",
    "titre": "Marché",
    "groupes": [
      {
        "titre": "Marché",
        "items": [
          {
            "to": "/market/app",
            "label": "Espace marché",
            "icone": "panier"
          },
          {
            "to": "/market/listings/new",
            "label": "Nouvelle annonce",
            "icone": "boite"
          },
          {
            "to": "/market/requests",
            "label": "Demandes",
            "icone": "facture"
          },
          {
            "to": "/market/requests/new",
            "label": "Nouvelle demande",
            "icone": "dossier"
          },
          {
            "to": "/market/reviews",
            "label": "Avis",
            "icone": "message"
          },
          {
            "to": "/market/transporters",
            "label": "Transporteurs",
            "icone": "camion"
          }
        ]
      }
    ]
  },
  {
    "id": "investissement",
    "titre": "Investissement",
    "groupes": [
      {
        "titre": "Investissement",
        "items": [
          {
            "to": "/investment/profile",
            "label": "Profil investisseur",
            "icone": "personne"
          },
          {
            "to": "/investment/projects",
            "label": "Projets suivis",
            "icone": "dossier"
          },
          {
            "to": "/investment/requests",
            "label": "Demandes",
            "icone": "facture"
          }
        ]
      }
    ]
  }
];

const ACTIVATION: { id: string; test: (chemin: string) => boolean }[] = [
  { id: 'admin', test: (c) => c === '/admin' || c.startsWith('/admin/') },
  { id: 'app', test: (c) => c === '/app' || c.startsWith('/app/') },
  { id: 'farmer', test: (c) => c === '/farmer' || c.startsWith('/farmer/') },
  { id: 'organization', test: (c) => c === '/organization' || c.startsWith('/organization/') },
  { id: 'reviewer', test: (c) => c === '/reviewer' || c.startsWith('/reviewer/') },
  { id: 'developers', test: (c) => c === '/developers' || c.startsWith('/developers/') },
  { id: 'marche', test: (c) => /^\/market\/(app|listings\/new|requests|reviews|transporters)/.test(c) },
  { id: 'investissement', test: (c) => /^\/investment\/(profile|projects|requests)/.test(c) },
];

export function resolveEspace(chemin: string): EspaceDef | null {
  const activation = ACTIVATION.find((entree) => entree.test(chemin));
  if (!activation) return null;
  return ESPACES.find((espace) => espace.id === activation.id) ?? null;
}
