import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Host } from '@expo/ui/jetpack-compose';
import { ThemeProvider } from '@/theme';
import { 
  PermissionProvider, 
  JobJournalProvider 
} from '@/hooks';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Host style={{ flex: 1 }} seedColor="#0057FF">
            <PermissionProvider>
              <JobJournalProvider>
                <StatusBar style={isDark ? 'light' : 'dark'} />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="home" />
                </Stack>
              </JobJournalProvider>
            </PermissionProvider>
          </Host>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

