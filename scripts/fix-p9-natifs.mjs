/**
 * P9 - equivalents natifs et harmonisation par familles (BLOC 110).
 *
 * 1. Cree apps/Mobile/src/components/ui/StatCard.tsx, miroir natif du
 *    composant web du design system (meme API).
 * 2. Exporte le composant depuis components/ui/index.ts.
 * 3. Adopte StatCard dans admin/dashboard.tsx (grille KPI, navigation
 *    inchangee, styles.kpi conserve pour la serie).
 * 4. Remplace le hex de mfa.tsx par COLORS.pureWhite (I3).
 * 5. Retire la couleur semantique des 2 titres de la famille auth web.
 * 6. Realigne 2 commentaires qui citaient encore Space Grotesk.
 *
 * Toutes les ancres sont extraites des fichiers reels et verifiees
 * uniques. Fins de ligne preservees fichier par fichier (arbre mixte).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const md5 = (b) => createHash('md5').update(b).digest('hex');
const STATCARD_B64 = "aW1wb3J0IHR5cGUgeyBSZWFjdE5vZGUgfSBmcm9tICdyZWFjdCc7CmltcG9ydCB7IFN0eWxlU2hlZXQsIFZpZXcsIHR5cGUgU3R5bGVQcm9wLCB0eXBlIFZpZXdTdHlsZSB9IGZyb20gJ3JlYWN0LW5hdGl2ZSc7CmltcG9ydCB7IElvbmljb25zIH0gZnJvbSAnQGV4cG8vdmVjdG9yLWljb25zJzsKCmltcG9ydCB7IENPTE9SUywgVElOVFMgfSBmcm9tICdAL3RoZW1lL2NvbG9ycyc7CmltcG9ydCB7IElDT05fU0laRSwgUkFESVVTLCBTUEFDSU5HIH0gZnJvbSAnQC90aGVtZS9zcGFjZSc7CgppbXBvcnQgeyBDYXJkLCBQcmVzc2FibGVDYXJkLCB0eXBlIENhcmRQcm9wcyB9IGZyb20gJy4vQ2FyZCc7CmltcG9ydCB7IFRleHQgfSBmcm9tICcuL1RleHQnOwoKLyoqCiAqIE1JUk9JUiBOQVRJRiBkdSBTdGF0Q2FyZCBkdSBkZXNpZ24gc3lzdGVtIHdlYi4KICoKICogTWVtZSBBUEkgcXVlIGxhIHZlcnNpb24gd2ViIChsYWJlbCwgdmFsZXVyLCB1bml0ZSwgcGVyaW9kZSwgaWNvbmUsIHNvdXJjZSwKICogdGVuZGFuY2UsIHBpZWQpIGFmaW4gcXUgdW4gbWVtZSBpbmRpY2F0ZXVyIHNlIGRlY3JpdmUgZGUgbGEgbWVtZSBmYWNvbiBzdXIKICogbGVzIGRldXggcGxhdGVmb3JtZXMuIEF1Y3VuZSB2YWxldXIgcGFyIGRlZmF1dCBwb3VyIGxhIHRlbmRhbmNlIDogdW4KICogaW5kaWNhdGV1ciBuIGFmZmljaGUgamFtYWlzIHVuZSBldm9sdXRpb24gaW52ZW50ZWUuCiAqLwpleHBvcnQgaW50ZXJmYWNlIFN0YXRUZW5kYW5jZSB7CiAgdmFsZXVyOiBzdHJpbmc7CiAgc2VuczogJ3VwJyB8ICdkb3duJyB8ICdmbGF0JzsKICBsaWJlbGxlPzogc3RyaW5nOwp9CgpleHBvcnQgaW50ZXJmYWNlIFN0YXRDYXJkUHJvcHMgewogIGxhYmVsOiBzdHJpbmc7CiAgdmFsZXVyOiBzdHJpbmc7CiAgdW5pdGU/OiBzdHJpbmc7CiAgcGVyaW9kZT86IHN0cmluZzsKICBpY29uZT86IGtleW9mIHR5cGVvZiBJb25pY29ucy5nbHlwaE1hcDsKICBzb3VyY2U/OiBzdHJpbmc7CiAgdGVuZGFuY2U/OiBTdGF0VGVuZGFuY2U7CiAgcGllZD86IFJlYWN0Tm9kZTsKICAvKiogVG9uIGRlIGxhIHN1cmZhY2UgOyBgd2hpdGVgIHBhciBkZWZhdXQsIGNvbW1lIHN1ciBsZSB3ZWIuICovCiAgdG9uZT86IENhcmRQcm9wc1sndG9uZSddOwogIC8qKiBSZW5kIGxhIGNhcnRlIGNsaXF1YWJsZSAocmVzc29ydCBkIGFwcHVpIG5hdGlmKS4gKi8KICBvblByZXNzPzogKCkgPT4gdm9pZDsKICBzdHlsZT86IFN0eWxlUHJvcDxWaWV3U3R5bGU+Owp9Cgpjb25zdCBTRU5TX0lDT05FOiBSZWNvcmQ8U3RhdFRlbmRhbmNlWydzZW5zJ10sIGtleW9mIHR5cGVvZiBJb25pY29ucy5nbHlwaE1hcD4gPSB7CiAgdXA6ICd0cmVuZGluZy11cCcsCiAgZG93bjogJ3RyZW5kaW5nLWRvd24nLAogIGZsYXQ6ICdyZW1vdmUnLAp9OwoKY29uc3QgU0VOU19GT05EOiBSZWNvcmQ8U3RhdFRlbmRhbmNlWydzZW5zJ10sIHN0cmluZz4gPSB7CiAgdXA6IFRJTlRTLnN1Y2Nlc3NCZywKICBkb3duOiBUSU5UUy5lcnJvckJnLAogIGZsYXQ6IENPTE9SUy5uYXR1cmFsV2hpdGUsCn07Cgpjb25zdCBTRU5TX1RFWFRFOiBSZWNvcmQ8U3RhdFRlbmRhbmNlWydzZW5zJ10sIHN0cmluZz4gPSB7CiAgdXA6IENPTE9SUy5mb3Jlc3RHcmVlbiwKICBkb3duOiBDT0xPUlMuZXJyb3IsCiAgZmxhdDogQ09MT1JTLnNsYXRlR3JheSwKfTsKCmNvbnN0IFNFTlNfTElCRUxMRTogUmVjb3JkPFN0YXRUZW5kYW5jZVsnc2VucyddLCBzdHJpbmc+ID0gewogIHVwOiAnZW4gaGF1c3NlJywKICBkb3duOiAnZW4gYmFpc3NlJywKICBmbGF0OiAnc3RhYmxlJywKfTsKCmV4cG9ydCBmdW5jdGlvbiBTdGF0Q2FyZCh7CiAgbGFiZWwsCiAgdmFsZXVyLAogIHVuaXRlLAogIHBlcmlvZGUsCiAgaWNvbmUsCiAgc291cmNlLAogIHRlbmRhbmNlLAogIHBpZWQsCiAgdG9uZSA9ICd3aGl0ZScsCiAgb25QcmVzcywKICBzdHlsZSwKfTogU3RhdENhcmRQcm9wcykgewogIGNvbnN0IGNvbnRlbnUgPSAoCiAgICA8PgogICAgICA8VmlldyBzdHlsZT17c3R5bGVzLmVudGV0ZX0+CiAgICAgICAgPFRleHQgcHJlc2V0PSJjYXB0aW9uIiBjb2xvcj17Q09MT1JTLnNsYXRlR3JheX0gc3R5bGU9e3N0eWxlcy5sYWJlbH0+CiAgICAgICAgICB7bGFiZWx9CiAgICAgICAgPC9UZXh0PgogICAgICAgIHtpY29uZSA/IDxJb25pY29ucyBuYW1lPXtpY29uZX0gc2l6ZT17SUNPTl9TSVpFLnNtfSBjb2xvcj17Q09MT1JTLmZvcmVzdEdyZWVufSAvPiA6IG51bGx9CiAgICAgIDwvVmlldz4KCiAgICAgIDxWaWV3IHN0eWxlPXtzdHlsZXMudmFsZXVyTGlnbmV9PgogICAgICAgIDxUZXh0IHByZXNldD0ibnVtZXJpYyIgY29sb3I9e0NPTE9SUy50ZXh0UHJpbWFyeX0+CiAgICAgICAgICB7dmFsZXVyfQogICAgICAgIDwvVGV4dD4KICAgICAgICB7dW5pdGUgPyAoCiAgICAgICAgICA8VGV4dCBwcmVzZXQ9ImNhcHRpb24iIGNvbG9yPXtDT0xPUlMuc2xhdGVHcmF5fT4KICAgICAgICAgICAge3VuaXRlfQogICAgICAgICAgPC9UZXh0PgogICAgICAgICkgOiBudWxsfQogICAgICA8L1ZpZXc+CgogICAgICB7dGVuZGFuY2UgfHwgcGVyaW9kZSB8fCBzb3VyY2UgfHwgcGllZCA/ICgKICAgICAgICA8VmlldyBzdHlsZT17c3R5bGVzLnBpZWR9PgogICAgICAgICAge3RlbmRhbmNlID8gKAogICAgICAgICAgICA8VmlldwogICAgICAgICAgICAgIHN0eWxlPXtbc3R5bGVzLmJhZGdlLCB7IGJhY2tncm91bmRDb2xvcjogU0VOU19GT05EW3RlbmRhbmNlLnNlbnNdIH1dfQogICAgICAgICAgICAgIGFjY2Vzc2libGUKICAgICAgICAgICAgICBhY2Nlc3NpYmlsaXR5TGFiZWw9e2BUZW5kYW5jZSAke1NFTlNfTElCRUxMRVt0ZW5kYW5jZS5zZW5zXX0gOiAke3RlbmRhbmNlLnZhbGV1cn1gfQogICAgICAgICAgICA+CiAgICAgICAgICAgICAgPElvbmljb25zIG5hbWU9e1NFTlNfSUNPTkVbdGVuZGFuY2Uuc2Vuc119IHNpemU9e0lDT05fU0laRS54c30gY29sb3I9e1NFTlNfVEVYVEVbdGVuZGFuY2Uuc2Vuc119IC8+CiAgICAgICAgICAgICAgPFRleHQgcHJlc2V0PSJjYXB0aW9uIiBjb2xvcj17U0VOU19URVhURVt0ZW5kYW5jZS5zZW5zXX0+CiAgICAgICAgICAgICAgICB7dGVuZGFuY2UudmFsZXVyfQogICAgICAgICAgICAgIDwvVGV4dD4KICAgICAgICAgICAgICB7dGVuZGFuY2UubGliZWxsZSA/ICgKICAgICAgICAgICAgICAgIDxUZXh0IHByZXNldD0iY2FwdGlvbiIgY29sb3I9e0NPTE9SUy5zbGF0ZUdyYXl9PgogICAgICAgICAgICAgICAgICB7YCAtLSAke3RlbmRhbmNlLmxpYmVsbGV9YH0KICAgICAgICAgICAgICAgIDwvVGV4dD4KICAgICAgICAgICAgICApIDogbnVsbH0KICAgICAgICAgICAgPC9WaWV3PgogICAgICAgICAgKSA6IG51bGx9CgogICAgICAgICAge3BlcmlvZGUgPyAoCiAgICAgICAgICAgIDxUZXh0IHByZXNldD0iY2FwdGlvbiIgY29sb3I9e0NPTE9SUy5zbGF0ZUdyYXl9PgogICAgICAgICAgICAgIHtwZXJpb2RlfQogICAgICAgICAgICA8L1RleHQ+CiAgICAgICAgICApIDogbnVsbH0KCiAgICAgICAgICB7c291cmNlID8gKAogICAgICAgICAgICA8VGV4dCBwcmVzZXQ9ImNhcHRpb24iIGNvbG9yPXtDT0xPUlMuc2xhdGVHcmF5fT4KICAgICAgICAgICAgICB7YFNvdXJjZSA6ICR7c291cmNlfWB9CiAgICAgICAgICAgIDwvVGV4dD4KICAgICAgICAgICkgOiBudWxsfQoKICAgICAgICAgIHtwaWVkID8gPFZpZXcgc3R5bGU9e3N0eWxlcy5waWVkUGxlaW5lTGFyZ2V1cn0+e3BpZWR9PC9WaWV3PiA6IG51bGx9CiAgICAgICAgPC9WaWV3PgogICAgICApIDogbnVsbH0KICAgIDwvPgogICk7CgogIGlmIChvblByZXNzKSB7CiAgICByZXR1cm4gKAogICAgICA8UHJlc3NhYmxlQ2FyZCBvblByZXNzPXtvblByZXNzfSB0b25lPXt0b25lfSBzdHlsZT17c3R5bGV9PgogICAgICAgIHtjb250ZW51fQogICAgICA8L1ByZXNzYWJsZUNhcmQ+CiAgICApOwogIH0KCiAgcmV0dXJuICgKICAgIDxDYXJkIHRvbmU9e3RvbmV9IHN0eWxlPXtzdHlsZX0+CiAgICAgIHtjb250ZW51fQogICAgPC9DYXJkPgogICk7Cn0KCmNvbnN0IHN0eWxlcyA9IFN0eWxlU2hlZXQuY3JlYXRlKHsKICBlbnRldGU6IHsKICAgIGZsZXhEaXJlY3Rpb246ICdyb3cnLAogICAgYWxpZ25JdGVtczogJ2ZsZXgtc3RhcnQnLAogICAganVzdGlmeUNvbnRlbnQ6ICdzcGFjZS1iZXR3ZWVuJywKICAgIGdhcDogU1BBQ0lORy5zbSwKICB9LAogIGxhYmVsOiB7IGZsZXhTaHJpbms6IDEgfSwKICB2YWxldXJMaWduZTogewogICAgZmxleERpcmVjdGlvbjogJ3JvdycsCiAgICBhbGlnbkl0ZW1zOiAnYmFzZWxpbmUnLAogICAgZ2FwOiBTUEFDSU5HLnhzLAogICAgbWFyZ2luVG9wOiBTUEFDSU5HLnhzLAogIH0sCiAgcGllZDogeyBnYXA6IFNQQUNJTkcueHMsIG1hcmdpblRvcDogU1BBQ0lORy5zbSB9LAogIGJhZGdlOiB7CiAgICBmbGV4RGlyZWN0aW9uOiAncm93JywKICAgIGFsaWduSXRlbXM6ICdjZW50ZXInLAogICAgZ2FwOiBTUEFDSU5HLnhzLAogICAgYWxpZ25TZWxmOiAnZmxleC1zdGFydCcsCiAgICBib3JkZXJSYWRpdXM6IFJBRElVUy5waWxsLAogICAgcGFkZGluZ0hvcml6b250YWw6IFNQQUNJTkcuc20sCiAgICBwYWRkaW5nVmVydGljYWw6IDIsCiAgfSwKICBwaWVkUGxlaW5lTGFyZ2V1cjogeyB3aWR0aDogJzEwMCUnIH0sCn0pOwo=";
const ETAPES = [
  {
    "chemin": "apps/Mobile/src/components/ui/index.ts",
    "md5Avant": "ea458c0f1daf598d02dfc658bdf80be2",
    "coutures": [
      {
        "avant": "export * from './StatCounter';",
        "apres": "export * from './StatCard';\nexport * from './StatCounter';",
        "attendu": 1
      }
    ],
    "md5Apres": "f9d036ddf3351fc1a6363f4910dc8394"
  },
  {
    "chemin": "apps/Mobile/src/app/admin/dashboard.tsx",
    "source": "p9/admin-dashboard-crlf.tsx",
    "md5Avant": "2172857b6e73e9b4e56471f234332bd5",
    "coutures": [
      {
        "avant": "import { Pressable, StyleSheet, View } from 'react-native';",
        "apres": "import { StyleSheet, View } from 'react-native';",
        "attendu": 1
      },
      {
        "avant": "  Screen, Section, Text,",
        "apres": "  Screen, Section, StatCard, Text,",
        "attendu": 1
      },
      {
        "avant": "                      {bloc.kpis.map((kpi) => (\n                        <Pressable key={kpi.cle} onPress={() => router.push(kpi.vers)} style={styles.kpiWrap}>\n                          <Card tone=\"white\" style={styles.kpi}>\n                            <Text preset=\"caption\" color={COLORS.slateGray}>{kpi.label}</Text>\n                            <Text preset=\"numeric\" color={COLORS.forestGreen}>\n                              {String(data[kpi.cle] ?? 0)}\n                            </Text>\n                          </Card>\n                        </Pressable>\n                      ))}",
        "apres": "                      {bloc.kpis.map((kpi) => (\n                        <View key={kpi.cle} style={styles.kpiWrap}>\n                          <StatCard\n                            label={kpi.label}\n                            valeur={String(data[kpi.cle] ?? 0)}\n                            onPress={() => router.push(kpi.vers)}\n                          />\n                        </View>\n                      ))}",
        "attendu": 1
      }
    ],
    "md5Apres": "7c475eee528fc9e76f4b956677404a73"
  },
  {
    "chemin": "apps/Mobile/src/app/auth/mfa.tsx",
    "md5Avant": "88bad7738fba646903c5e43b1530501c",
    "coutures": [
      {
        "avant": "  qrImage: { width: 220, height: 220, backgroundColor: '#FFFFFF' },",
        "apres": "  qrImage: { width: 220, height: 220, backgroundColor: COLORS.pureWhite },",
        "attendu": 1
      }
    ],
    "md5Apres": "3c61fca9e8cce143b89cba713a64b733"
  },
  {
    "chemin": "apps/web/src/pages/auth/VerifyPhone.tsx",
    "md5Avant": "ad56ba54b0a4f95bff1fed43557017c9",
    "coutures": [
      {
        "avant": "              <Text preset=\"h3\" color={COLORS.success} style={{ marginBottom: 12 }}>",
        "apres": "              <Text preset=\"h3\" style={{ marginBottom: 12 }}>",
        "attendu": 1
      }
    ],
    "md5Apres": "43a8e30bd01c81942e128c78597f56a0"
  },
  {
    "chemin": "apps/web/src/pages/auth/VerifyEmail.tsx",
    "md5Avant": "89180d05e560ea794ac1f53e4f8b4915",
    "coutures": [
      {
        "avant": "              <Text preset=\"h3\" color={COLORS.success} style={{ marginBottom: 12 }}>",
        "apres": "              <Text preset=\"h3\" style={{ marginBottom: 12 }}>",
        "attendu": 1
      }
    ],
    "md5Apres": "24d187140be9327c19cdf0104fd39558"
  },
  {
    "chemin": "apps/Mobile/src/components/ui/Text.tsx",
    "md5Avant": "d4f06dfa6ebcc47ea00ca98ff8ad2d6e",
    "coutures": [
      {
        "avant": " * ceux des polices Space Grotesk (titres) et Inter (texte).",
        "apres": " * ceux des polices du kit : Inter (texte et titres) et JetBrains Mono (chiffres).",
        "attendu": 1
      }
    ],
    "md5Apres": "c11c48c1cb024fa1163afc3f1c0d69c9"
  },
  {
    "chemin": "apps/Mobile/src/components/ui/Section.tsx",
    "md5Avant": "1f671e2b5cc13596a923dea210afc466",
    "coutures": [
      {
        "avant": " * sur-titre en petites capitales, puis le titre en Space Grotesk. L'ensemble",
        "apres": " * sur-titre en petites capitales, puis le titre en Inter. L'ensemble",
        "attendu": 1
      }
    ],
    "md5Apres": "5808d2d7635d95a344e417e73a3b3ae0"
  }
];
const MARQUEURS = [
  {
    "chemin": "apps/Mobile/src/components/ui/index.ts",
    "texte": "export * from './StatCard';",
    "attendu": 1
  },
  {
    "chemin": "apps/Mobile/src/app/admin/dashboard.tsx",
    "texte": "StatCard",
    "attendu": 2
  },
  {
    "chemin": "apps/Mobile/src/app/admin/dashboard.tsx",
    "texte": "Pressable",
    "attendu": 0
  },
  {
    "chemin": "apps/Mobile/src/app/admin/dashboard.tsx",
    "texte": "<View key={kpi.cle} style={styles.kpiWrap}>",
    "attendu": 1
  },
  {
    "chemin": "apps/Mobile/src/app/admin/dashboard.tsx",
    "texte": "style={styles.kpi}",
    "attendu": 1
  },
  {
    "chemin": "apps/Mobile/src/app/auth/mfa.tsx",
    "texte": "#FFFFFF",
    "attendu": 0
  },
  {
    "chemin": "apps/Mobile/src/app/auth/mfa.tsx",
    "texte": "COLORS.pureWhite",
    "attendu": 1
  },
  {
    "chemin": "apps/web/src/pages/auth/VerifyPhone.tsx",
    "texte": "COLORS.success",
    "attendu": 0
  },
  {
    "chemin": "apps/web/src/pages/auth/VerifyEmail.tsx",
    "texte": "COLORS.success",
    "attendu": 0
  },
  {
    "chemin": "apps/Mobile/src/components/ui/Text.tsx",
    "texte": "Space Grotesk",
    "attendu": 0
  },
  {
    "chemin": "apps/Mobile/src/components/ui/Section.tsx",
    "texte": "Space Grotesk",
    "attendu": 0
  },
  {
    "chemin": "apps/Mobile/src/components/ui/StatCard.tsx",
    "texte": "StatCardProps",
    "attendu": 2
  }
];
const CONTROLES = {
  "apps/Mobile/src/theme/typography.ts": "0552f02b5d4fd7d323e55199e3c22dda",
  "apps/Mobile/src/theme/space.ts": "85915ab3482f0d3380e11c6db2bfff7f",
  "apps/Mobile/src/components/ui/Card.tsx": "b1a9f45a25a40c1424a348fb4d55350e",
  "apps/Mobile/src/components/ui/StatCounter.tsx": "69612995e53b396a9a0abc13be4c839c",
  "apps/Mobile/src/app/organization/overview.tsx": "a3dc68ed64576f61eb8893af9fd8efdd",
  "apps/web/src/design-system/index.css": "7d097df3c690ab93ae8e57df99635fc4",
  "apps/web/src/design-system/components/StatCard.tsx": "d05288f4748260ed43c593f7fb3e77aa",
  "apps/web/src/design-system/components/ChartCard.tsx": "a98bb0a9a87735c536b4412fe0d46af0"
};
const MD5_STATCARD = "2f5d723b520601864b3f1d7035f7c46a";

/* ------------------------------------------------------------------ */
/* Runtime : applique les coutures, verifie marqueurs et controles      */
/* ------------------------------------------------------------------ */

const RACINE = process.cwd();
if (!existsSync('apps/Mobile/src/components/ui/index.ts') || !existsSync('apps/web/src/pages/auth/VerifyEmail.tsx')) {
  console.error('ARRET_RACINE  lancez le script depuis la racine du depot');
  process.exit(1);
}

const resultats = [];
let arrets = 0;

const note = (etat, chemin, empreinte) => {
  resultats.push(etat.padEnd(7) + ' ' + empreinte + '  ' + chemin);
};

/* 1. nouveau composant natif (idempotent) */
{
  const chemin = 'apps/Mobile/src/components/ui/StatCard.tsx';
  const contenu = Buffer.from(STATCARD_B64, 'base64');
  if (existsSync(chemin)) {
    const actuel = md5(readFileSync(chemin));
    if (actuel === MD5_STATCARD) {
      note('DEJA_OK', chemin, actuel);
    } else {
      console.error('ARRET_EXISTANT  ' + chemin + '  ' + actuel);
      arrets += 1;
    }
  } else {
    writeFileSync(chemin, contenu);
    note('CREE', chemin, md5(readFileSync(chemin)));
  }
}

/* 2. coutures (idempotentes fichier par fichier) */
for (const etape of ETAPES) {
  const brut = readFileSync(etape.chemin);
  const actuel = md5(brut);

  if (etape.md5Apres && actuel === etape.md5Apres) {
    note('DEJA_OK', etape.chemin, actuel);
    continue;
  }
  if (actuel !== etape.md5Avant) {
    console.error('ARRET_MD5  ' + etape.chemin + '  attendu ' + etape.md5Avant + '  trouve ' + actuel);
    arrets += 1;
    continue;
  }

  let texte = brut.toString('utf8');
  const crlf = texte.includes('\r\n');
  texte = texte.replace(/\r\n/g, '\n');

  let bloque = false;
  for (const c of etape.coutures) {
    const n = texte.split(c.avant).length - 1;
    if (n !== c.attendu) {
      console.error('ARRET_ANCRE  ' + etape.chemin + '  attendu ' + c.attendu + '  trouve ' + n + '  :: ' + c.avant.split('\n')[0].trim().slice(0, 70));
      arrets += 1;
      bloque = true;
      break;
    }
    texte = texte.split(c.avant).join(c.apres);
  }
  if (bloque) continue;

  const buf = Buffer.from(crlf ? texte.replace(/\n/g, '\r\n') : texte, 'utf8');
  const apres = md5(buf);
  if (etape.md5Apres && apres !== etape.md5Apres) {
    console.error('ARRET_POST  ' + etape.chemin + '  attendu ' + etape.md5Apres + '  calcule ' + apres);
    arrets += 1;
    continue;
  }

  writeFileSync(etape.chemin, buf);
  note('COUSU', etape.chemin, apres);
}

/* 3. marqueurs semantiques */
console.log('--- marqueurs ---');
for (const m of MARQUEURS) {
  const texte = existsSync(m.chemin) ? readFileSync(m.chemin, 'utf8') : '';
  const n = m.texte === '' ? 0 : texte.split(m.texte).length - 1;
  const ok = n === m.attendu;
  console.log((ok ? '[ok] ' : '[KO] ') + m.chemin.split('/').pop() + '  ' + JSON.stringify(m.texte) + '  attendu ' + m.attendu + '  trouve ' + n);
  if (!ok) arrets += 1;
}

/* 4. controles intacts */
console.log('--- controles ---');
for (const [chemin, attendu] of Object.entries(CONTROLES)) {
  const actuel = existsSync(chemin) ? md5(readFileSync(chemin)) : 'ABSENT';
  const ok = actuel === attendu;
  console.log((ok ? '[ok] ' : '[KO] ') + chemin + '  ' + actuel);
  if (!ok) arrets += 1;
}

/* 5. bilan */
console.log('--- resultats ---');
for (const r of resultats) console.log(r);

if (arrets > 0) {
  console.error('P9_ARRETS ' + arrets);
  process.exit(1);
}
console.log('P9_APPLIQUE');
