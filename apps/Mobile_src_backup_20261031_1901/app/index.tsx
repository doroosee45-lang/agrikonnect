import { Redirect } from 'expo-router';

/** Point d'entrée : le site public est la porte d'entrée par défaut. */
export default function Index() {
  return <Redirect href="/accueil" />;
}
