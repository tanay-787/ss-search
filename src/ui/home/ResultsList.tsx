import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { RNHostView } from '@expo/ui/jetpack-compose';
import { ResultItem } from './ResultItem';
import { Link } from 'expo-router';
import type { SearchResult } from '@/core/jobjournal/search/hybrid';

type GridRow = 
  | { type: 'landscape', items: [SearchResult] }
  | { type: 'portrait_pair', items: [SearchResult, SearchResult] }
  | { type: 'portrait_single', items: [SearchResult] };

interface ResultsListProps {
  results: SearchResult[];
  itemSize: number;
  spacing: number;
  columnCount: number;
}

function chunkResults(results: SearchResult[]): GridRow[] {
  const rows: GridRow[] = [];
  let pendingPortrait: SearchResult | null = null;

  for (const item of results) {
    if (item.isLandscape) {
      // Hold any pending portrait in memory and just render the landscape row
      rows.push({ type: 'landscape', items: [item] });
    } else {
      if (pendingPortrait) {
        rows.push({ type: 'portrait_pair', items: [pendingPortrait, item] });
        pendingPortrait = null;
      } else {
        pendingPortrait = item;
      }
    }
  }

  if (pendingPortrait) {
    rows.push({ type: 'portrait_single', items: [pendingPortrait] });
  }

  return rows;
}

export const ResultsList = React.memo(({ results, spacing }: ResultsListProps) => {
  const chunkedData = useMemo(() => chunkResults(results), [results]);

  const renderItem = useCallback(({ item: row }: { item: GridRow }) => {
    if (row.type === 'landscape') {
      return (
        <View style={{ width: '100%', paddingBottom: spacing }}>
          <Link href={{ pathname: '/viewer', params: { uri: row.items[0].uri, jobId: row.items[0].jobId } }} asChild>
            <ResultItem item={row.items[0]} />
          </Link>
        </View>
      );
    } else if (row.type === 'portrait_single') {
      return (
        <View style={{ flexDirection: 'row', width: '100%', paddingBottom: spacing }}>
          <View style={{ flex: 0.5, paddingRight: spacing / 2 }}>
            <Link href={{ pathname: '/viewer', params: { uri: row.items[0].uri, jobId: row.items[0].jobId } }} asChild>
              <ResultItem item={row.items[0]} />
            </Link>
          </View>
          {/* Empty spacer to keep it 50% width and aligned left */}
          <View style={{ flex: 0.5, paddingLeft: spacing / 2 }} />
        </View>
      );
    } else {
      return (
        <View style={{ flexDirection: 'row', width: '100%', paddingBottom: spacing }}>
          <View style={{ flex: 1, paddingRight: spacing / 2 }}>
            <Link href={{ pathname: '/viewer', params: { uri: row.items[0].uri, jobId: row.items[0].jobId } }} asChild>
              <ResultItem item={row.items[0]} />
            </Link>
          </View>
          <View style={{ flex: 1, paddingLeft: spacing / 2 }}>
            <Link href={{ pathname: '/viewer', params: { uri: row.items[1].uri, jobId: row.items[1].jobId } }} asChild>
              <ResultItem item={row.items[1]} />
            </Link>
          </View>
        </View>
      );
    }
  }, [spacing]);

  return (
    <>
      <RNHostView matchContents={false}>
        <FlashList
          data={chunkedData}
          keyExtractor={(row) => row.items.map(i => i.jobId).join('-')}
          numColumns={1}
          contentContainerStyle={{ padding: spacing, paddingBottom: 100 }}
          estimatedItemSize={250}
          keyboardShouldPersistTaps="handled"
          renderItem={renderItem}
        />
      </RNHostView>
    </>
  );
});
