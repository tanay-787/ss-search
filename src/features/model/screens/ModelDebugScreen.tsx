import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar, Button, Card, Text, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGemmaModelDownload } from '../hooks/useGemmaModelDownload';
import { useGemmaModel } from '../hooks/useGemmaModel';

export default function ModelDebugScreen() {
  const router = useRouter();
  const theme = useTheme();
  const download = useGemmaModelDownload();
  const [isLoadingLocalModel, setIsLoadingLocalModel] = useState(false);
  const { state, generate, load, deleteModel, memorySummary } = useGemmaModel({
    modelSourceUri: download.downloaded ? download.fileUri : null,
    autoLoad: false,
  });
  const [prompt, setPrompt] = useState('Summarize this screenshot app in one sentence.');
  const [output, setOutput] = useState('');

  const runPrompt = async () => {
    const result = await generate(prompt);
    setOutput(result);
  };

  const loadLocalModel = async () => {
    setIsLoadingLocalModel(true);
    try {
      await load();
    } finally {
      setIsLoadingLocalModel(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header mode="small" elevated={false} style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Gemma 4 E2B" subtitle={state.status} />
      </Appbar.Header>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card mode="outlined">
            <Card.Content style={styles.stack}>
              <Text variant="titleMedium">Model status</Text>
              <Text>Download status: {download.status}</Text>
              <Text>Backend: {state.backend}</Text>
              <Text>Ready: {state.isReady ? 'yes' : 'no'}</Text>
              <Text>Loading: {isLoadingLocalModel ? 'yes' : 'no'}</Text>
              <Text>Generating: {state.isGenerating ? 'yes' : 'no'}</Text>
              <Text>Load progress: {Math.round((state.downloadProgress || 0) * 100)}%</Text>
              <Text>Download progress: {Math.round((download.progress || 0) * 100)}%</Text>
              <Text>Downloaded file: {download.fileUri ?? 'not downloaded'}</Text>
              {state.error && <Text style={{ color: theme.colors.error }}>{state.error}</Text>}
              {download.error && <Text style={{ color: theme.colors.error }}>{download.error}</Text>}
            </Card.Content>
          </Card>

          <Card mode="outlined">
            <Card.Content style={styles.stack}>
              <Text variant="titleMedium">Actions</Text>
              <Button mode="contained" onPress={download.startDownload}>
                Download model
              </Button>
              <Button mode="outlined" onPress={download.pauseDownload}>
                Pause download
              </Button>
              <Button mode="outlined" onPress={download.resumeDownload}>
                Resume download
              </Button>
              <Button
                mode="outlined"
                onPress={() => void loadLocalModel()}
                disabled={!download.downloaded || isLoadingLocalModel}
              >
                {isLoadingLocalModel ? 'Loading local model...' : 'Load local model'}
              </Button>
              <Button mode="outlined" onPress={() => void deleteModel()}>
                Delete model
              </Button>
              <Button mode="text" onPress={download.clearDownloadedModel}>
                Clear downloaded model
              </Button>
            </Card.Content>
          </Card>

          <Card mode="outlined">
            <Card.Content style={styles.stack}>
              <Text variant="titleMedium">Quick prompt</Text>
              <TextInput mode="outlined" value={prompt} onChangeText={setPrompt} multiline />
              <Button mode="contained" onPress={runPrompt} disabled={!state.isReady}>
                Run prompt
              </Button>
              {!!output && <Text>{output}</Text>}
            </Card.Content>
          </Card>

          {memorySummary && (
            <Card mode="outlined">
              <Card.Content style={styles.stack}>
                <Text variant="titleMedium">Memory summary</Text>
                <Text>{JSON.stringify(memorySummary, null, 2)}</Text>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 32,
  },
  stack: {
    gap: 12,
  },
});
