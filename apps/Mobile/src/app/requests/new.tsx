import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, ErrorState, Input, Screen, Section, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { requestApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

export default function RequestNew() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [cropId, setCropId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('ton');
  const [quality, setQuality] = useState('');
  const [budgetPrice, setBudgetPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [deliveryCountry, setDeliveryCountry] = useState('');
  const [deliveryProvince, setDeliveryProvince] = useState('');
  const [error, setError] = useState<unknown>(null);

  const create = useMutation({
    mutationFn: () => requestApi.create({
      title,
      cropId,
      quantity: Number(quantity),
      unit,
      quality: quality || undefined,
      budgetPrice: budgetPrice ? Number(budgetPrice) : null,
      currency,
      deliveryCountry,
      deliveryProvince: deliveryProvince || undefined,
    }),
    onSuccess: () => { setError(null); router.push('/requests'); },
    onError: (caught) => setError(caught),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.nouvelleDemande')} subtitle={t('ui.publiezUneDemandeDAchat')} />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.nouvelleDemande')} icon="add-circle-outline">
          <Card tone="white">
            <View style={styles.form}>
              <Input label={t('ui.titre')} value={title} onChangeText={setTitle} />
              <Input label={t('ui.cultureId')} value={cropId} onChangeText={setCropId} />
              <View style={styles.row2}>
                <Input label={t('ui.quantite')} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
                <Input label={t('ui.unite')} value={unit} onChangeText={setUnit} />
              </View>
              <Input label={t('ui.qualite')} value={quality} onChangeText={setQuality} />
              <View style={styles.row2}>
                <Input label={t('ui.budget')} value={budgetPrice} onChangeText={setBudgetPrice} keyboardType="numeric" />
                <Input label={t('ui.devise')} value={currency} onChangeText={setCurrency} />
              </View>
              <View style={styles.row2}>
                <Input label={t('ui.paysDeLivraison')} value={deliveryCountry} onChangeText={setDeliveryCountry} />
                <Input label={t('ui.province')} value={deliveryProvince} onChangeText={setDeliveryProvince} />
              </View>
              {error ? <ErrorState error={error} /> : null}
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.lesChampsMarquesDUnAsterisque')}</Text>
              <Button label={t('ui.publierLaDemande')} onPress={() => create.mutate()} loading={create.isPending} disabled={title.trim().length === 0 || cropId.trim().length === 0} />
            </View>
          </Card>
        </AuthGate>
      </Section>
    </Screen>
  );
}
const styles = StyleSheet.create({ section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl }, form: { gap: SPACING.md }, row2: { flexDirection: 'row', gap: SPACING.sm } });
