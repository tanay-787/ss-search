import React, { useState, useCallback, useMemo } from 'react';
import { 
  Dimensions,
  Pressable,
  FlatList,
  ActivityIndicator,
  View,
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

  const renderItem = ({ item }: { item: any }) => (
    <Pressable>
      <Host matchContents={true}>
        <Box 
          modifiers={[
            size(ITEM_SIZE, ITEM_SIZE),
            paddingAll(2),
            clip(Shapes.RoundedCorner(8)),
          ]}
        >
          <RNHostView matchContents={false}>
            <Image
              source={{ uri: item.uri }}
              style={{ flex: 1, borderRadius: 8 }}
              contentFit="cover"
              transition={200}
            />
          </RNHostView>
          {item.status !== 'indexed' && (
              <Box 
                  modifiers={[
                      fillMaxSize(),
                      paddingAll(6)
                  ]}
                  contentAlignment="bottomEnd"
              >
                  <Box 
                      modifiers={[
                          paddingAll(4),
                          background('rgba(0,0,0,0.5)'),
                          clip(Shapes.RoundedCorner(4))
                          ]}
                          >
                          <Icon 
                          source={item.status === 'working' ? require('../../../assets/autorenew.xml') : require('../../../assets/warning.xml')} 
                          size={12} 
                          tint="#FFFFFF" 
                          />
                          </Box>
                          </Box>
                          )}

        </Box>
      </Host>
    </Pressable>
  );

  return (
    <Host style={{ flex: 1, backgroundColor: theme.background }} matchContents={false}>
      <Column modifiers={[fillMaxSize()]}>
        {/* Header */}
        <Row 
          modifiers={[fillMaxWidth(), padding(16, 24, 16, 16)]} 
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
