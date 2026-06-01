import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Appbar, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { initializeJobJournalDatabase, initModelMonitor, registerJobJournalBackgroundTask, scheduleJobJournalBackgroundTask } from '@/features/jobjournal';
import { unregisterBackgroundTasks } from '@/features/pipeline/backgroundTasks';

export default function IndexScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await initializeJobJournalDatabase();
        await unregisterBackgroundTasks();
        await registerJobJournalBackgroundTask();
        await scheduleJobJournalBackgroundTask();
        initModelMonitor();

        if (active) {
          router.replace('/(tabs)/home');
        }
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Failed to initialize app');
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header mode="small" elevated={false} style={styles.header}>
        <Appbar.Content title="SS-Search" />
      </Appbar.Header>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.body}>
          {error ? (
            <Text variant="bodyLarge" style={{ color: theme.colors.error, textAlign: 'center' }}>
              Sum Ting Wong: {error}
            </Text>
          ) : (
            <>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>
                Preparing your library...
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = {
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    backgroundColor: 'transparent',
  },
  body: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
  },
};
