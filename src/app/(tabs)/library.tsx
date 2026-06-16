import React, { useState, useCallback, useMemo } from 'react';
import { 
  Dimensions,
  Pressable,
  FlatList,
  ActivityIndicator,
  View,
  StyleSheet
} from 'react-native';
import { Host, Text } from '@expo/ui'; 
import { Column, Row, Box, RNHostView, Icon } from '@expo/ui/jetpack-compose';
import { 
  fillMaxSize, 
  fillMaxWidth, 
  paddingAll, 
  padding, 
  size, 
  background, 
  clip, 
  Shapes,
} from '@expo/ui/jetpack-compose/modifiers';
import { Image } from 'expo-image';
import { useJobJournalLibrary, useJobJournalOperations } from '@/hooks';
import { useTheme } from '@/theme';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const SPACING = 4;
const ITEM_SIZE = (width - (SPACING * (COLUMN_COUNT + 1))) / COLUMN_COUNT;

function getStatusColor(status: string) {
  switch (status) {
    case 'indexed': return '#22c55e'; // green
    case 'working': return '#3b82f6'; // blue
    case 'error': return '#ef4444'; // red
    default: return '#6b7280'; // gray
  }
}

export default function LibraryScreen() {
  const { items, loading, refresh } = useJobJournalLibrary();
  const { process, isProcessing } = useJobJournalOperations();
  const theme = useTheme();

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Group items by date
  const sections = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    items.forEach(item => {
      const date = new Date(item.creationTime * 1000).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return Object.entries(groups).map(([date, data]) => ({ date, data }));
  }, [items]);

  const RenderItem = React.memo(({ item }: { item: any }) => (
    <Pressable style={styles.itemContainer}>
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
        <View style={[
          styles.statusIndicator, 
          { backgroundColor: getStatusColor(item.status) }
        ]} />
      </View>
    </Pressable>
  ));

  const styles = StyleSheet.create({
    itemContainer: {
      width: ITEM_SIZE,
      height: ITEM_SIZE,
      padding: 2,
    },
    imageWrapper: {
      flex: 1,
      borderRadius: 8,
      overflow: 'hidden',
    },
    image: {
      flex: 1,
    },
    statusIndicator: {
      position: 'absolute',
      top: 6,
      left: 6,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.8)',
    },
    statusBadge: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      padding: 4,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 4,
    },
  });

  const renderItem = useCallback(({ item }: { item: any }) => <RenderItem item={item} />, []);

  const ITEM_TOTAL_SIZE = ITEM_SIZE + SPACING;
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_TOTAL_SIZE,
    offset: ITEM_TOTAL_SIZE * Math.floor(index / COLUMN_COUNT),
    index,
  }), []);

  return (
    <Host style={{ flex: 1, backgroundColor: theme.background }} matchContents={false}>
      <Column modifiers={[fillMaxSize()]}>
        {/* Header */}
        <Row 
          modifiers={[fillMaxWidth(), padding(16, 32, 16, 16)]} 
          verticalAlignment="center" 
          horizontalArrangement="spaceBetween"
        >
          <Column>
            <Text 
              textStyle={{ 
                color: theme.onSurface, 
                fontSize: 24, 
                fontWeight: 'bold' 
              }}
            >
              Library
            </Text>
            <Text 
              textStyle={{ 
                color: theme.onSurfaceVariant, 
                fontSize: 14 
              }}
            >
              {`${items.length} items collected`}
            </Text>
          </Column>
          {isProcessing && (
            <Box modifiers={[paddingAll(8), background(theme.primaryContainer), clip(Shapes.Circle)]}>
                <RNHostView matchContents={true}>
                  <ActivityIndicator size="small" color={theme.onPrimaryContainer} />
                </RNHostView>
            </Box>
          )}
        </Row>

        <RNHostView matchContents={false}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            numColumns={COLUMN_COUNT}
            contentContainerStyle={{ padding: SPACING }}
            renderItem={renderItem}
            getItemLayout={getItemLayout}
            refreshing={loading}
            onRefresh={onRefresh}
            ListEmptyComponent={
              !loading ? (
                <Column 
                    modifiers={[fillMaxWidth(), padding(40, 0, 0, 0)]} 
                    horizontalAlignment="center"
                    verticalArrangement={{ spacedBy: 16 }}
                >
                    <Box modifiers={[size(64, 64), background(theme.surfaceVariant), clip(Shapes.RoundedCorner(16))]} />
                    <Text textStyle={{ color: theme.onSurfaceVariant }}>Your library is empty</Text>
                </Column>
              ) : null
            }
          />
        </RNHostView>
      </Column>
    </Host>
  );
}
