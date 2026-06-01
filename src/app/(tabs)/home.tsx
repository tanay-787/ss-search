import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Chip, Text, useTheme } from 'react-native-paper';
import * as MediaLibrary from 'expo-media-library';
import { SafeAreaView } from 'react-native-safe-area-context';

import { syncJobJournalScreenshots } from '@/features/jobjournal';
import PermissionPrimer from '@/features/onboarding/PermissionPrimer';
import { useLibrarySummary } from '@/features/home/hooks/useLibrarySummary';

const suggestedSearches = [
  { query: 'bug', emoji: '🐛' },
  { query: 'api error', emoji: '⚠️' },
  { query: 'login', emoji: '🔑' },
  { query: 'deployment', emoji: '🚀' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [primerVisible, setPrimerVisible] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const summary = useLibrarySummary();

  useEffect(() => {
    (async () => {
      const permission = await MediaLibrary.getPermissionsAsync();
      if (permission.granted) {
        setPermissionGranted(true);
        return;
      }
      setPrimerVisible(true);
    })();
  }, []);

  useEffect(() => {
    if (!permissionGranted) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await syncJobJournalScreenshots();
      } catch (err) {
        if (!cancelled) {
          console.warn('JobJournal initial sync failed', err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [permissionGranted]);

  const searchableCount = summary.screenshots;
  const isBuilding = summary.loading || (summary.pendingStages > 0 || summary.runningStages > 0);

  // Empty state copy
  const heroTitle = useMemo(() => {
    if (searchableCount === 0) return 'Search anything\nyou\'ve seen.';
    return 'Find that screenshot\nin seconds.';
  }, [searchableCount]);

  const heroSubtitle = useMemo(() => {
    if (searchableCount === 0) return 'Never lose important information again.';
    if (isBuilding) return `${searchableCount} ready to search • ${summary.pendingStages + summary.runningStages} being added`;
    return `${searchableCount} searchable screenshots • Offline & private`;
  }, [searchableCount, isBuilding, summary]);

  return (
    <>
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header mode="small" elevated={false} style={styles.header}>
          <Appbar.Content title="SS-Search" />
        </Appbar.Header>

        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            {/* Hero Section */}
            <View style={styles.hero}>
              <Text variant="displaySmall" style={[styles.title, { color: theme.colors.onBackground }]}>
                {heroTitle}
              </Text>
              <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                {heroSubtitle}
              </Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={[styles.searchInputWrapper, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text style={styles.searchIcon}>🔍</Text>
                <Text
                  style={[
                    styles.searchPlaceholder,
                    query && { color: theme.colors.onBackground },
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                  onPress={() => {
                    // Would trigger actual search
                  }}
                >
                  {query || 'Search anything you\'ve seen before'}
                </Text>
              </View>
              <Text style={[styles.searchHint, { color: theme.colors.onSurfaceVariant }]}>
                Type to search across text, visuals, and concepts
              </Text>
            </View>

            {/* Empty State or Suggested Searches */}
            {searchableCount === 0 ? (
              <View style={styles.emptyStateSection}>
                <View style={[styles.emptyStateCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.emptyStateEmoji]}>📸</Text>
                  <Text variant="headlineSmall" style={[styles.emptyStateTitle, { color: theme.colors.onBackground }]}>
                    Start by importing screenshots
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[styles.emptyStateText, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Grant access to your photo library and we'll index them in the background.
                  </Text>
                  {!permissionGranted && (
                    <Button
                      mode="contained"
                      style={styles.emptyStateCta}
                      onPress={() => setPrimerVisible(true)}
                    >
                      Grant Access
                    </Button>
                  )}
                </View>

                <View style={styles.featuresGrid}>
                  <Feature
                    icon="⚡"
                    title="Lightning Fast"
                    description="Search runs on device, no internet needed"
                  />
                  <Feature
                    icon="🔒"
                    title="Completely Private"
                    description="Your data never leaves your phone"
                  />
                  <Feature
                    icon="🎯"
                    title="Smart Search"
                    description="Find by text, visuals, concepts, and more"
                  />
                </View>
              </View>
            ) : (
              <>
                {/* Quick Examples */}
                <View style={styles.section}>
                  <Text variant="labelLarge" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                    Try searching for:
                  </Text>
                  <View style={styles.examplesGrid}>
                    {suggestedSearches.map((item) => (
                      <Chip
                        key={item.query}
                        icon={item.emoji}
                        compact
                        style={styles.exampleChip}
                        onPress={() => setQuery(item.query)}
                      >
                        {item.query}
                      </Chip>
                    ))}
                  </View>
                </View>

                {/* Indexing Status (if still building) */}
                {isBuilding && (
                  <View style={[styles.section, styles.buildingStatus]}>
                    <View style={[styles.statusBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
                      <Text style={styles.statusEmoji}>⧖</Text>
                      <View style={styles.statusText}>
                        <Text
                          variant="labelMedium"
                          style={{ color: theme.colors.onBackground, fontWeight: '600' }}
                        >
                          Building your library
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {summary.pendingStages + summary.runningStages} screenshots being added • ~5 min
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Bottom hint */}
                <View style={styles.hintSection}>
                  <Text
                    variant="bodySmall"
                    style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
                  >
                    💡 Tap Library tab to see detailed indexing progress
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>

      <PermissionPrimer
        visible={primerVisible}
        onDismiss={() => setPrimerVisible(false)}
        onGranted={() => {
          setPermissionGranted(true);
          setPrimerVisible(false);
        }}
      />
    </>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text
        variant="labelMedium"
        style={[styles.featureTitle, { color: theme.colors.onBackground }]}
      >
        {title}
      </Text>
      <Text
        variant="bodySmall"
        style={[styles.featureDescription, { color: theme.colors.onSurfaceVariant }]}
      >
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: 'transparent',
  },
  // Hero Section
  hero: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  title: {
    fontWeight: '700',
    lineHeight: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Search
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
    marginBottom: 8,
  },
  searchIcon: {
    fontSize: 20,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
  },
  searchHint: {
    fontSize: 11,
    marginTop: 4,
  },
  // Empty State
  emptyStateSection: {
    paddingHorizontal: 20,
  },
  emptyStateCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  emptyStateCta: {
    marginTop: 12,
    alignSelf: 'center',
  },
  // Features Grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureTitle: {
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  // Examples Grid
  examplesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exampleChip: {
    marginBottom: 8,
  },
  // Building Status
  buildingStatus: {
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  statusEmoji: {
    fontSize: 24,
  },
  statusText: {
    flex: 1,
  },
  // Hint
  hintSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
