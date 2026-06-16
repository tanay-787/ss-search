import React, { useCallback } from 'react';
import { FlatList } from 'react-native';
import { RNHostView } from '@expo/ui/jetpack-compose';
import { ResultItem } from './ResultItem';
import { Theme } from '@/theme';

interface ResultsListProps {
  results: any[];
  theme: Theme;
  itemSize: number;
  spacing: number;
  columnCount: number;
}

export const ResultsList = React.memo(({ results, theme, itemSize, spacing, columnCount }: ResultsListProps) => {
  const renderItem = useCallback(({ item }: { item: any }) => (
    <ResultItem item={item} surfaceVariant={theme.surfaceVariant} itemSize={itemSize} />
  ), [theme.surfaceVariant, itemSize]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: itemSize + spacing,
    offset: (itemSize + spacing) * Math.floor(index / columnCount),
    index,
  }), [itemSize, spacing, columnCount]);

  return (
    <RNHostView matchContents={false}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.jobId}
        numColumns={columnCount}
        contentContainerStyle={{ padding: spacing, paddingBottom: 100 }}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
      />
    </RNHostView>
  );
});
