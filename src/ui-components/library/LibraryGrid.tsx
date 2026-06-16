import React, { useCallback } from 'react';
import { FlatList } from 'react-native';
import { RNHostView } from '@expo/ui/jetpack-compose';
import { LibraryItem } from './LibraryItem';
import { EmptyState } from './EmptyState';
import { Theme } from '@/theme';

interface LibraryGridProps {
  items: any[];
  theme: Theme;
  itemSize: number;
  spacing: number;
  columnCount: number;
  loading: boolean;
  onRefresh: () => void;
}

export const LibraryGrid = React.memo(({ 
  items, 
  theme, 
  itemSize, 
  spacing, 
  columnCount, 
  loading, 
  onRefresh 
}: LibraryGridProps) => {
  const renderItem = useCallback(({ item }: { item: any }) => (
    <LibraryItem item={item} itemSize={itemSize} />
  ), [itemSize]);

  const ITEM_TOTAL_SIZE = itemSize + spacing;
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_TOTAL_SIZE,
    offset: ITEM_TOTAL_SIZE * Math.floor(index / columnCount),
    index,
  }), [ITEM_TOTAL_SIZE, columnCount]);

  return (
    <RNHostView matchContents={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={columnCount}
        contentContainerStyle={{ padding: spacing }}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        refreshing={loading}
        onRefresh={onRefresh}
        ListEmptyComponent={!loading ? <EmptyState theme={theme} /> : null}
      />
    </RNHostView>
  );
});
