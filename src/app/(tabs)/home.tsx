import { useRouter } from 'expo-router';
import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Spinner } from 'heroui-native/spinner';
import { Text } from 'heroui-native/text';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  FlatList, 
  Pressable, 
  Keyboard,
  Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSearch, useJobJournalStats, useJobJournalOperations } from '@/hooks';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const { results, search, loading, error} = useSearch();
  const { totalJobs, pending, running } = useJobJournalStats();
  const { sync, isSyncing } = useJobJournalOperations();

  const handleSearch = useCallback(() => {
    Keyboard.dismiss();
    search(query);
  }, [query, search]);

  useEffect(() => {
    // Auto-sync on mount
    sync();
  }, []);

  const isIndexing = pending > 0 || running > 0;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header & Search Bar */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>SS-Search</Text>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.input}
              placeholder="Search your screenshots..."
              placeholderTextColor="#666"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <Pressable onPress={handleSearch} disabled={!query.trim()}>
                <Text style={[styles.searchButton, !query.trim() && styles.disabledText]}>
                  Search
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Results or Welcome */}
        <View style={styles.content}>
          {results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.jobId}
              numColumns={COLUMN_COUNT}
              renderItem={({ item }) => (
                <Pressable style={styles.resultItem}>
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.resultImage}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreText}>
                      {(item.score * 100).toFixed(0)}%
                    </Text>
                  </View>
                </Pressable>
              )}
              contentContainerStyle={styles.resultGrid}
            />
          ) : query && !loading ? (
            <View style={styles.center}>
              <Text style={styles.mutedText}>No results found for "{query}"</Text>
            </View>
          ) : (
            <View style={styles.welcome}>
              <Text style={styles.welcomeTitle}>
                Find anything you've seen.
              </Text>
              <Text style={styles.welcomeSubtitle}>
                Search through {totalJobs} screenshots by text, visuals, or concepts.
              </Text>
              
              
              <View style={styles.suggestions}>
                <Text style={styles.suggestionHeader}>Try searching for:</Text>
                <View style={styles.suggestionChips}>
                  {['login screen', 'error message', 'recipe', 'design'].map(s => (
                    <Button 
                      key={s} 
                      size="sm" 
                      variant="secondary"
                      onPress={() => {
                        setQuery(s);
                        search(s);
                      }}
                    >
                      {s}
                    </Button>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Status Bar */}
        {(isIndexing || isSyncing) && (
          <View style={styles.statusBar}>
            <Spinner size="sm" />
            <Text style={styles.statusText}>
              {isSyncing ? 'Syncing library...' : `Indexing ${pending + running} screens...`}
            </Text>
          </View>
        )}
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
  header: {
    padding: 20,
    gap: 16,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginRight: 12,
  },
  searchButton: {
    color: '#007AFF',
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  welcome: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 40,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    lineHeight: 24,
  },
  suggestions: {
    marginTop: 40,
    gap: 12,
  },
  suggestionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mutedText: {
    color: '#666',
    textAlign: 'center',
  },
  warningText: {
    color: '#fbbf24',
    fontWeight: 'bold',
    fontSize: 14,
  },
  warningSub: {
    color: '#d97706',
    fontSize: 12,
    marginTop: 4,
  },
  resultGrid: {
    padding: 1,
  },
  resultItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    padding: 1,
  },
  resultImage: {
    flex: 1,
    backgroundColor: '#111',
  },
  scoreBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scoreText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#222',
    gap: 12,
  },
  statusText: {
    color: '#999',
    fontSize: 13,
  },
});
