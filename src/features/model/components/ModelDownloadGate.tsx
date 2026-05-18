import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { Button, Card, ProgressBar, Snackbar, Text, useTheme } from 'react-native-paper';

import { useGemmaModelDownload } from '../hooks/useGemmaModelDownload';

export function ModelDownloadGate() {
  const theme = useTheme();
  const [toastVisible, setToastVisible] = useState(false);
  const {
    downloaded,
    dismissed,
    error,
    fileUri,
    pauseDownload,
    progress,
    resumeDownload,
    startDownload,
    status,
    dismissPrompt,
  } = useGemmaModelDownload();
  const previouslyDownloaded = useRef(downloaded);

  useEffect(() => {
    if (!previouslyDownloaded.current && downloaded) {
      setToastVisible(true);
    }
    previouslyDownloaded.current = downloaded;
  }, [downloaded]);

  if (Platform.OS === 'web') {
    return null;
  }

  const showGate = !downloaded && !dismissed;
  const busy = status === 'downloading' || status === 'paused';
  const initializing = status === 'checking';

  return (
    <>
      {showGate && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.overlay}>
            <Card mode="outlined" style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.stack}>
                <Text variant="headlineSmall">Install Gemma 4 E2B</Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                  The model is downloaded from a public HTTPS URL and can keep running in the
                  background. You can pause and resume it later.
                </Text>

                <Text variant="bodyMedium">Status: {status}</Text>
                {fileUri && (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {fileUri}
                  </Text>
                )}

                {initializing ? (
                  <Text variant="bodyMedium">Checking local model state...</Text>
                ) : (status === 'downloading' || status === 'paused') && (
                  <View style={styles.stack}>
                    <ProgressBar progress={progress} />
                    <Text variant="labelMedium">{Math.round(progress * 100)}%</Text>
                  </View>
                )}

                {error && <Text style={{ color: theme.colors.error }}>{error}</Text>}

                <View style={styles.row}>
                  {initializing ? (
                    <Button mode="contained" disabled>
                      Preparing...
                    </Button>
                  ) : !busy ? (
                    <Button mode="contained" onPress={startDownload}>
                      Download model
                    </Button>
                  ) : status === 'downloading' ? (
                    <Button mode="contained" onPress={pauseDownload}>
                      Pause
                    </Button>
                  ) : (
                    <Button mode="contained" onPress={resumeDownload}>
                      Resume
                    </Button>
                  )}
                  <Button mode="outlined" onPress={dismissPrompt}>
                    Later
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </View>
        </Modal>
      )}

      <Snackbar
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
        duration={2500}
        style={styles.snackbar}
      >
        Gemma 4 E2B is ready
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    borderRadius: 20,
  },
  stack: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  snackbar: {
    margin: 16,
  },
});
