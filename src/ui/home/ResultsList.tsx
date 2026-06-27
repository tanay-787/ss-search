import React, { useCallback } from 'react';
import { FlatList } from 'react-native';
import { RNHostView } from '@expo/ui/jetpack-compose';
import { ResultItem } from './ResultItem';

interface ResultsListProps {
  results: any[];
  itemSize: number;
  spacing: number;
  columnCount: number;
}

export const ResultsList = React.memo(({ results, itemSize, spacing, columnCount }: ResultsListProps) => {
  const renderItem = useCallback(({ item }: { item: any }) => (
    <ResultItem item={item} itemSize={itemSize} />
  ), [itemSize]);

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
