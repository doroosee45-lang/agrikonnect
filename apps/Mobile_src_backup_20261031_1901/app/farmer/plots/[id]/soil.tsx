import { useLocalSearchParams } from 'expo-router';

import { PlotScreenHeader } from '@/components/farmer/PlotScreenHeader';
import { SoilModule } from '@/components/farmer/SoilModule';
import { Screen, Section } from '@/components/ui';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { StyleSheet } from 'react-native';

/** Sol de la parcelle : profil fusionné, historique et saisie d'analyses. */
export default function PlotSoil() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen background={COLORS.naturalWhite}>
      <PlotScreenHeader title="Sol" plotId={id} />
      <Section bare contentStyle={styles.section}>
        <SoilModule plotId={id} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl },
});
