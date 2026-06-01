import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, ProgressBar, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getJobJournalDatabase } from '@/features/jobjournal';
import { useLibrarySummary } from '@/features/home/hooks/useLibrarySummary';

type SearchReadyStats = {
  powerSearchReady: number;
  simpleSearchReady: number;
  inProcess: number;
  failed: number;
  total: number;
  loading: boolean;
};

const EMPTY_STATS: SearchReadyStats = {
  powerSearchReady: 0,
  simpleSearchReady: 0,
  inProcess: 0,
  failed: 0,
  total: 0,
  loading: true,
};

export default function LibraryScreen() {
  const theme = useTheme();
  const summary = useLibrarySummary();
  const [stats, setStats] = useState<SearchReadyStats>(EMPTY_STATS);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function refresh() {
      const db = await getJobJournalDatabase();

      // Power Search Ready: jobs where all stages are completed
      const powerSearch = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(DISTINCT j.id) as count 
         FROM job_journal_jobs j
         WHERE (
           SELECT COUNT(DISTINCT stage) FROM stage_executions se 
           WHERE se.job_id = j.id AND se.status = 'completed'
         ) = 6`,
      );

      // Simple Search Ready: jobs where ocr_postprocess is completed but embedding is not
      const simpleSearch = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(DISTINCT j.id) as count 
         FROM job_journal_jobs j
         WHERE EXISTS (
           SELECT 1 FROM stage_executions se 
           WHERE se.job_id = j.id AND se.stage = 'ocr_postprocess' AND se.status = 'completed'
         )
         AND NOT EXISTS (
           SELECT 1 FROM stage_executions se 
           WHERE se.job_id = j.id AND se.stage = 'index' AND se.status = 'completed'
         )`,
      );

      // In Process: jobs with pending or running stages
      const inProcess = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(DISTINCT job_id) as count 
         FROM stage_executions 
         WHERE status IN ('pending', 'running', 'waiting_for_model')`,
      );

      // Failed: jobs with failed stages
      const failed = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(DISTINCT job_id) as count 
         FROM stage_executions 
         WHERE status = 'failed'`,
      );

      // Total jobs
      const total = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM job_journal_jobs`,
      );

      if (!active) return;

      setStats({
        powerSearchReady: powerSearch?.count ?? 0,
        simpleSearchReady: simpleSearch?.count ?? 0,
        inProcess: inProcess?.count ?? 0,
        failed: failed?.count ?? 0,
        total: total?.count ?? 0,
        loading: summary.loading,
      });
    }

    refresh();
    timer = setInterval(refresh, 5000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [summary.loading]);

  const searchReadyTotal = stats.powerSearchReady + stats.simpleSearchReady;
  const powerSearchPct = stats.total > 0 ? (stats.powerSearchReady / stats.total) * 100 : 0;
  const simpleSearchPct = stats.total > 0 ? (stats.simpleSearchReady / stats.total) * 100 : 0;
  const inProcessPct = stats.total > 0 ? (stats.inProcess / stats.total) * 100 : 0;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header mode="small" elevated={false} style={styles.header}>
        <Appbar.Content title="Library" />
      </Appbar.Header>

      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* Title & Total */}
          <View style={styles.titleSection}>
            <Text variant="labelLarge" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
              Screenshots available to search
            </Text>
            <Text variant="headlineMedium" style={[styles.total, { color: theme.colors.onSurface }]}>
              {stats.total.toLocaleString()} total
            </Text>
          </View>

          {/* Multi-Progress Bar */}
          <View style={[styles.progressBar, { backgroundColor: theme.colors.surfaceVariant }]}>
            {stats.total > 0 && (
              <>
                {/* Power Search */}
                <View
                  style={[
                    styles.progressSegment,
                    {
                      width: `${powerSearchPct}%`,
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                >
                  {powerSearchPct > 5 && (
                    <Text style={[styles.progressLabel, { color: theme.colors.onPrimary }]}>
                      {stats.powerSearchReady} Power
                    </Text>
                  )}
                </View>

                {/* Simple Search */}
                <View
                  style={[
                    styles.progressSegment,
                    {
                      width: `${simpleSearchPct}%`,
                      backgroundColor: theme.colors.tertiary,
                    },
                  ]}
                >
                  {simpleSearchPct > 5 && (
                    <Text style={[styles.progressLabel, { color: theme.colors.onTertiary }]}>
                      {stats.simpleSearchReady} Simple
                    </Text>
                  )}
                </View>

                {/* In Process */}
                <View
                  style={[
                    styles.progressSegment,
                    {
                      width: `${inProcessPct}%`,
                      backgroundColor: theme.colors.surfaceVariant,
                      borderRightWidth: 1,
                      borderRightColor: theme.colors.outline,
                    },
                  ]}
                >
                  {inProcessPct > 5 && (
                    <Text style={[styles.progressLabel, { color: theme.colors.onSurfaceVariant }]}>
                      {stats.inProcess}
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>

          {/* Stats Legend */}
          <View style={styles.statsGrid}>
            <StatCard
              label="Power Search Ready"
              value={stats.powerSearchReady}
              theme={theme}
              description="All stages complete"
            />
            <StatCard
              label="Simple Search Ready"
              value={stats.simpleSearchReady}
              theme={theme}
              description="Text only"
            />
            <StatCard
              label="In Process"
              value={stats.inProcess}
              theme={theme}
              description="Being indexed"
              isDimmed
            />
            {stats.failed > 0 && (
              <StatCard
                label="Failed"
                value={stats.failed}
                theme={theme}
                description="Needs retry"
                isDimmed
              />
            )}
          </View>

          {/* Power Search Section */}
          {stats.powerSearchReady > 0 && (
            <View style={styles.searchSection}>
              <Text variant="labelLarge" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Power Search Ready
              </Text>
              <Text
                variant="bodySmall"
                style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}
              >
                Multimodal search: text, visuals, concepts
              </Text>

              <View style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.primary,
                },
              ]}>
                <View style={styles.cardContent}>
                  <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                    ✓ {stats.powerSearchReady.toLocaleString()} screenshots fully indexed
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Try: "bug in login", "design system", "error handling"
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[styles.cardCaption, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Includes: Keywords, embeddings, visual similarity
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Simple Search Section */}
          {stats.simpleSearchReady > 0 && (
            <View style={styles.searchSection}>
              <Text variant="labelLarge" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Simple Search Ready
              </Text>
              <Text
                variant="bodySmall"
                style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}
              >
                Text-only search: find by words & keywords
              </Text>

              <View style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.tertiary,
                },
              ]}>
                <View style={styles.cardContent}>
                  <Text variant="labelLarge" style={{ color: theme.colors.tertiary, fontWeight: '600' }}>
                    ⧖ {stats.simpleSearchReady.toLocaleString()} screenshots awaiting embeddings
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[styles.cardHint, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Try: "login", "api", "deployment"
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[styles.cardCaption, { color: theme.colors.onSurfaceVariant }]}
                  >
                    Includes: Exact text matches only
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* In Process Section */}
          {stats.inProcess > 0 && (
            <View style={styles.searchSection}>
              <Text variant="labelLarge" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                In Process
              </Text>
              <Text
                variant="bodySmall"
                style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}
              >
                {stats.inProcess.toLocaleString()} screenshots being indexed...
              </Text>

              <View style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outline,
                },
              ]}>
                <View style={styles.cardContent}>
                  <Text variant="labelLarge" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                    Understanding text
                  </Text>
                  <View style={styles.progressBarSmall}>
                    <ProgressBar progress={0.52} color={theme.colors.primary} />
                  </View>
                  <Text
                    variant="bodySmall"
                    style={[styles.cardCaption, { color: theme.colors.onSurfaceVariant }]}
                  >
                    52% • 6 min remaining
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* CTA */}
          {searchReadyTotal > 0 && (
            <View style={styles.ctaSection}>
              <Text variant="bodySmall" style={[styles.ctaLabel, { color: theme.colors.onSurfaceVariant }]}>
                Search now with {searchReadyTotal.toLocaleString()} ready screenshots
              </Text>
              <Button mode="contained" style={styles.cta}>
                Go to Search
              </Button>
            </View>
          )}

          {/* Empty State */}
          {stats.total === 0 && !stats.loading && (
            <View style={styles.emptyState}>
              <Text variant="bodyLarge" style={[{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }]}>
                No screenshots yet. Start importing to build your searchable library.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatCard({
  label,
  value,
  theme,
  description,
  isDimmed,
}: {
  label: string;
  value: number;
  theme: any;
  description: string;
  isDimmed?: boolean;
}) {
  const textColor = isDimmed ? theme.colors.onSurfaceVariant : theme.colors.onSurface;
  const labelColor = theme.colors.onSurfaceVariant;

  return (
    <View style={[
      styles.statCard,
      {
        backgroundColor: isDimmed ? theme.colors.surfaceVariant : theme.colors.surface,
        borderColor: theme.colors.outlineVariant,
      },
    ]}>
      <Text variant="labelSmall" style={[styles.statCardLabel, { color: labelColor }]}>
        {label}
      </Text>
      <Text variant="headlineSmall" style={[{ color: textColor, fontWeight: '600' }]}>
        {value.toLocaleString()}
      </Text>
      <Text variant="bodySmall" style={[{ color: labelColor, fontSize: 11 }]}>
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
    paddingBottom: 32,
  },
  header: {
    backgroundColor: 'transparent',
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  total: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  progressBar: {
    marginHorizontal: 20,
    marginBottom: 20,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressSegment: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  progressLabel: {
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsGrid: {
    marginHorizontal: 20,
    marginBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 10,
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  cardHint: {
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 8,
  },
  cardCaption: {
    fontSize: 9,
  },
  progressBarSmall: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 10,
  },
  ctaSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  ctaLabel: {
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 10,
    fontWeight: '600',
  },
  cta: {
    paddingVertical: 8,
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
