import { useRouter } from 'expo-router';
import { Card } from 'heroui-native/card';
import { Spinner } from 'heroui-native/spinner';
import { Text } from 'heroui-native/text';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { 
  initializeJobJournalDatabase, 
  registerJobJournalBackgroundTask, 
  scheduleJobJournalBackgroundTask 
} from '@/features/jobjournal';
import { unregisterBackgroundTasks } from '@/features/pipeline/backgroundTasks';

export default function IndexScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Initialize the durable workflow system
        await initializeJobJournalDatabase();
        
        // Clean up legacy pipeline background tasks
        await unregisterBackgroundTasks();
        
        // Setup new job journal background execution
        await registerJobJournalBackgroundTask();
        await scheduleJobJournalBackgroundTask();
        
        // Navigate to the main application
        router.replace('/(tabs)/home');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to initialize app');
      }
    })();
  }, [router]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.body}>
          <Card className='w-full'>
            <View style={styles.content}>
              {error ? (
                <>
                  <Text style={styles.errorTitle}>Initialization failed</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </>
              ) : (
                <>
                  <Spinner size="lg" />
                  <Text style={styles.title}>Preparing your library</Text>
                  <Text style={styles.subtitle}>Loading screens, search data, and background tasks.</Text>
                </>
              )}
            </View>
          </Card>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  body: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff4444',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
});
