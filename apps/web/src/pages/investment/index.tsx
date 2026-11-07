// import { motion } from 'framer-motion';
// import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
// import { investApi } from '@/services/endpoints';
// import { queryKeys } from '@/services/query';
// import { useAuthStore } from '@/store/auth';
// import { formatDate, formatNumber } from '@/lib/format';
// import { useI18n } from '@/i18n';
// import { COLORS, DURATION, EASE } from '@/theme';

// export default function Investment() {
//   const { locale } = useI18n();
//   const queryClient = useQueryClient();
//   const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

//   const projects = useQuery({
//     queryKey: queryKeys.invest.projects({}),
//     queryFn: () => investApi.projects({ limit: 30 }).then((result) => result.data),
//     enabled: isAuthenticated,
//   });
//   const followed = useQuery({
//     queryKey: queryKeys.invest.followed,
//     queryFn: () => investApi.followed().then((result) => result.data),
//     enabled: isAuthenticated,
//   });
//   const matches = useQuery({
//     queryKey: queryKeys.invest.matches,
//     queryFn: () => investApi.matches().then((result) => result.data),
//     enabled: isAuthenticated,
//   });

//   const follow = useMutation({
//     mutationFn: (id: string) => investApi.follow(id),
//     onSuccess: () => {
//       void queryClient.invalidateQueries({ queryKey: queryKeys.invest.projects({}) });
//       void queryClient.invalidateQueries({ queryKey: queryKeys.invest.followed });
//     },
//   });

// const followedIds = new Set((Array.isArray(followed.data) ? followed.data : []).map((item) => item.id));

//   return (
//     <Section>
//       <AuthGate
//         isAuthenticated={isAuthenticated}
//         title="Espace investisseur"
//         description="Connectez-vous pour consulter les projets agricoles et suivre vos investissements."
//         icon="📈"
//       >
//         <div style={{ marginBottom: 32 }}>
//           <Text preset="h1" style={{ marginBottom: 8 }}>
//             Projets d'investissement
//           </Text>
//           <Text preset="bodyMd" color={COLORS.slateGray}>
//             Portefeuille de projets agricoles, avec data room, rapports d'impact et financement.
//           </Text>
//         </div>

//         {matches.data && matches.data.length > 0 ? (
//           <Card tone="pale" style={{ marginBottom: 32 }}>
//             <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>
//               Correspondances avec votre profil
//             </Text>
//             <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
//               {matches.data.slice(0, 4).map((project) => (
//                 <Chip key={project.id} label={project.title} tone="forest" size="sm" />
//               ))}
//             </div>
//           </Card>
//         ) : null}

//         <Text preset="h3" style={{ marginBottom: 16 }}>
//           Projets disponibles
//         </Text>
//         {projects.isLoading ? (
//           <LoadingState count={3} height={120} />
//         ) : projects.isError ? (
//           <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
//         ) : (projects.data ?? []).length === 0 ? (
//           <EmptyState title="Aucun projet" description="Les projets agricoles publiés apparaîtront ici." icon="📈" />
//         ) : (
//           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
//             {(projects.data ?? []).map((project, index) => (
//               <motion.div
//                 key={project.id}
//                 initial={{ opacity: 0, y: 16 }}
//                 whileInView={{ opacity: 1, y: 0 }}
//                 viewport={{ once: true }}
//                 transition={{ duration: DURATION.base / 1000, delay: index * 0.04, ease: EASE.out }}
//               >
//                 <Card tone="white" hover style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
//                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
//                     <Text preset="h4" color={COLORS.textPrimary} style={{ flex: 1 }}>
//                       {project.title}
//                     </Text>
//                     <Chip label={project.status} tone={project.status === 'FUNDED' ? 'success' : 'info'} size="sm" />
//                   </div>

//                   {project.description ? (
//                     <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.6 }}>
//                       {project.description}
//                     </Text>
//                   ) : null}

//                   <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
//                     {project.countryCode ? <Chip label={project.countryCode} tone="neutral" size="sm" /> : null}
//                     {project.sector ? <Chip label={project.sector} tone="neutral" size="sm" /> : null}
//                   </div>

//                   <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
//                     <div>
//                       {project.fundingNeed !== null ? (
//                         <Text preset="bodyMd" color={COLORS.forestGreen} style={{ fontWeight: 600 }}>
//                           Besoin : {formatNumber(project.fundingNeed, locale)}
//                         </Text>
//                       ) : null}
//                       <Text preset="caption" color={COLORS.slateGray}>
//                         créé le {formatDate(project.createdAt, locale)}
//                       </Text>
//                     </div>
//                     <Button
//                       label={followedIds.has(project.id) ? 'Suivi ✓' : 'Suivre'}
//                       onClick={() => follow.mutate(project.id)}
//                       variant={followedIds.has(project.id) ? 'ghost' : 'outline'}
//                       size="sm"
//                       loading={follow.isPending && follow.variables === project.id}
//                     />
//                   </div>
//                 </Card>
//               </motion.div>
//             ))}
//           </div>
//         )}

//         <Card tone="pale" style={{ marginTop: 32, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
//           <span style={{ fontSize: 20 }}>ℹ️</span>
//           <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
//             Les documents de la data room sont accessibles sur demande tracée. Les rapports d'impact portent leur
//             source et leur date : aucun rendement n'est garanti par la plateforme.
//           </Text>
//         </Card>
//       </AuthGate>
//     </Section>
//   );
// }





import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { investApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

export default function Investment() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const projects = useQuery({
    queryKey: queryKeys.invest.projects({}),
    queryFn: () => investApi.projects({ limit: 30 }).then((result) => result.data),
    enabled: isAuthenticated,
  });
  const followed = useQuery({
    queryKey: queryKeys.invest.followed,
    queryFn: () => investApi.followed().then((result) => result.data),
    enabled: isAuthenticated,
  });
  const matches = useQuery({
    queryKey: queryKeys.invest.matches,
    queryFn: () => investApi.matches().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const follow = useMutation({
    mutationFn: (id: string) => investApi.follow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invest.projects({}) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invest.followed });
    },
  });

  const projectList = Array.isArray(projects.data) ? projects.data : [];
  const matchList = Array.isArray(matches.data) ? matches.data : [];
  const followedList = Array.isArray(followed.data) ? followed.data : [];
  const followedIds = new Set(followedList.map((item) => item.id));

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Espace investisseur"
        description="Connectez-vous pour consulter les projets agricoles et suivre vos investissements."
        icon="📈"
      >
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Projets d'investissement
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>
            Portefeuille de projets agricoles, avec data room, rapports d'impact et financement.
          </Text>
        </div>

        {matchList.length > 0 ? (
          <Card tone="pale" style={{ marginBottom: 32 }}>
            <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>
              Correspondances avec votre profil
            </Text>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {matchList.slice(0, 4).map((project) => (
                <Chip key={project.id} label={project.title} tone="forest" size="sm" />
              ))}
            </div>
          </Card>
        ) : null}

        <Text preset="h3" style={{ marginBottom: 16 }}>
          Projets disponibles
        </Text>
        {projects.isLoading ? (
          <LoadingState count={3} height={120} />
        ) : projects.isError ? (
          <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
        ) : projectList.length === 0 ? (
          <EmptyState title="Aucun projet" description="Les projets agricoles publiés apparaîtront ici." icon="📈" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {projectList.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.04, ease: EASE.out }}
              >
                <Card tone="white" hover style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <Text preset="h4" color={COLORS.textPrimary} style={{ flex: 1 }}>
                      {project.title}
                    </Text>
                    <Chip label={project.status} tone={project.status === 'FUNDED' ? 'success' : 'info'} size="sm" />
                  </div>

                  {project.description ? (
                    <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.6 }}>
                      {project.description}
                    </Text>
                  ) : null}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {project.countryCode ? <Chip label={project.countryCode} tone="neutral" size="sm" /> : null}
                    {project.sector ? <Chip label={project.sector} tone="neutral" size="sm" /> : null}
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      {project.fundingNeed !== null ? (
                        <Text preset="bodyMd" color={COLORS.forestGreen} style={{ fontWeight: 600 }}>
                          Besoin : {formatNumber(project.fundingNeed, locale)}
                        </Text>
                      ) : null}
                      <Text preset="caption" color={COLORS.slateGray}>
                        créé le {formatDate(project.createdAt, locale)}
                      </Text>
                    </div>
                    <Button
                      label={followedIds.has(project.id) ? 'Suivi ✓' : 'Suivre'}
                      onClick={() => follow.mutate(project.id)}
                      variant={followedIds.has(project.id) ? 'ghost' : 'outline'}
                      size="sm"
                      loading={follow.isPending && follow.variables === project.id}
                    />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <Card tone="pale" style={{ marginTop: 32, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>ℹ️</span>
          <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
            Les documents de la data room sont accessibles sur demande tracée. Les rapports d'impact portent leur
            source et leur date : aucun rendement n'est garanti par la plateforme.
          </Text>
        </Card>
      </AuthGate>
    </Section>
  );
}