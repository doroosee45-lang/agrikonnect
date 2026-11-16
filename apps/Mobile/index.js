/**
 * Point d'entrée de l'application.
 *
 * L'ordre des imports compte : le gestionnaire des push d'appel en
 * arrière-plan (Android, application fermée) est enregistré par effet de bord
 * du premier import, AVANT le démarrage de React par expo-router. Sans build
 * natif d'appels (EXPO_PUBLIC_NATIVE_CALLS absent, Expo Go, web), il ne fait
 * rien.
 */
import './src/features/calls/background';
import 'expo-router/entry';
