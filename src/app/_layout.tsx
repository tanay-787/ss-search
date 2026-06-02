import { md3DarkTheme, md3LightTheme } from '@/theme/paper';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native/provider';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JobJournalProvider } from '@/lib/hooks';
import './global.css';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? md3DarkTheme : md3LightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <HeroUINativeProvider>
          <JobJournalProvider>
            <PaperProvider theme={theme}>
              <StatusBar style={theme.dark ? 'light' : 'dark'} backgroundColor={theme.colors.background} />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            </PaperProvider>
          </JobJournalProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
