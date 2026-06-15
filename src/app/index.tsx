import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Host, Text } from '@expo/ui';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, paddingAll, background, border, clip, Shapes, padding } from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@/theme';

import { 
  initializeJobJournalDatabase, 
  registerJobJournalBackgroundTask, 
  scheduleJobJournalBackgroundTask 
} from '@/core/jobjournal';

export default function IndexScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initializeJobJournalDatabase();
        await registerJobJournalBackgroundTask();
        await scheduleJobJournalBackgroundTask();
        router.replace('/(tabs)/home');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to initialize app');
      }
    })();
  }, [router]);

  return (
    <Host style={{ flex: 1, backgroundColor: theme.background }}>
      <Column 
        verticalArrangement="center"
        horizontalAlignment="center"
        modifiers={[fillMaxSize(), paddingAll(24)]}
      >
        <Column
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[
            fillMaxWidth(),
          ]}
        >
          {error ? (
            <>
              <Text modifiers={[]}>Initialization failed</Text>
              <Text textStyle={{ color: theme.onSurface }}>{error}</Text>
            </>
          ) : (
            <>
              <Text modifiers={[ padding(0,20,0,0)]} textStyle={{ color: theme.primary }}>Loading...</Text>
              <Text textStyle={{ color: theme.onSurface, fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
                Preparing your library
              </Text>
              <Text textStyle={{ color: theme.outline, fontSize: 14, textAlign: 'center' }}>
                Loading screens, search data, and background tasks.
              </Text>
            </>
          )}
        </Column>
      </Column>
    </Host>
  );
}
