import React, { useState, useEffect } from 'react';
import { 
  Keyboard,
  Dimensions,
  Pressable,
  FlatList,
  View,
  ActivityIndicator,
} from 'react-native';
import { Host, Text } from '@expo/ui'; 
import { Column, Row, Box, DockedSearchBar, RNHostView, Icon } from '@expo/ui/jetpack-compose';
import { 
  fillMaxSize, 
  fillMaxWidth, 
  paddingAll, 
  padding, 
  size, 
  background, 
  clip, 
  Shapes,
  border,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { Image } from 'expo-image';
import { useSearch, useJobJournalStats, useJobJournalOperations } from '@/hooks';
import { useTheme } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 2; 
const SPACING = 12;
const ITEM_SIZE = (SCREEN_WIDTH - (SPACING * (COLUMN_COUNT + 1))) / COLUMN_COUNT;

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const { results, search, loading } = useSearch();
  const theme = useTheme();
  const { pending, running } = useJobJournalStats();
  const { sync, isSyncing } = useJobJournalOperations();

  // Trigger search on query change with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (query) {
        search(query);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query, search]);

  useEffect(() => {
    sync();
  }, []);

  const isIndexing = pending > 0 || running > 0;

  return (
    <Host style={{ flex: 1, backgroundColor: theme.background }}>
      <Column modifiers={[fillMaxSize()]}>
        {/* Top Header */}
        <Column modifiers={[fillMaxWidth(), padding(16, 24, 8, 16)]}>
          <Text 
            textStyle={{ 
              color: theme.onSurface, 
              fontSize: 32, 
              fontWeight: 'bold',
              letterSpacing: -0.5
            }}
          >
            Stitch
          </Text>
          <Text 
            textStyle={{ 
              color: theme.onSurfaceVariant, 
              fontSize: 14 
            }}
          >
            Search everything you've seen
          </Text>
        </Column>
        
        {/* Search Bar Container */}
        <Box modifiers={[fillMaxWidth(), padding(0, 16, 16, 16)]}>
          <DockedSearchBar onQueryChange={setQuery}>
            <DockedSearchBar.LeadingIcon>
              <Icon 
                source={require('@/assets/search.xml')} 
                size={24} 
                tint={theme.onSurfaceVariant} 
              />
            </DockedSearchBar.LeadingIcon>
            <DockedSearchBar.Placeholder>
              <Text textStyle={{ color: theme.onSurfaceVariant }}>Search text, objects, dates...</Text>
            </DockedSearchBar.Placeholder>
          </DockedSearchBar>
        </Box>

        {/* Results / Content */}
        <Box modifiers={[fillMaxSize()]}>
          {results.length > 0 ? (
            <RNHostView matchContents={false}>
              <FlatList
                data={results}
                keyExtractor={(item) => item.jobId}
                numColumns={COLUMN_COUNT}
                contentContainerStyle={{ padding: SPACING, paddingBottom: 100 }}
                renderItem={({ item }) => (
                  <Pressable>
                    <Host matchContents={true}>
                      <Box 
                        modifiers={[
                          size(ITEM_SIZE, ITEM_SIZE),
                          paddingAll(4),
                          clip(Shapes.RoundedCorner(16)),
                          background(theme.surfaceVariant),
                        ]}
                      >
                        <RNHostView matchContents={false}>
                          <Image
                            source={{ uri: item.uri }}
                            style={{ flex: 1, borderRadius: 20 }}
                            contentFit="cover"
                            transition={200}
                          />
                        </RNHostView>
                      </Box>
                    </Host>
                  </Pressable>
                )}
              />
            </RNHostView>
          ) : (
            <Column modifiers={[fillMaxSize()]} horizontalAlignment="center" verticalArrangement="center">
              {query && !loading ? (
                 <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 8 }}>
                    <Icon 
                      source={require('../../../assets/search.xml')} 
                      size={48} 
                      tint={theme.outline} 
                    />
                    <Text textStyle={{ color: theme.onSurface, fontSize: 18, fontWeight: '600' }}>No results</Text>
                    <Text textStyle={{ color: theme.onSurfaceVariant, textAlign: 'center' }}>
                        Try searching for something else
                    </Text>
                 </Column>
              ) : (
                <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 24 }} modifiers={[padding(0, 32, 0, 32)]}>
                  <Box modifiers={[size(120, 120), background(theme.secondaryContainer), clip(Shapes.RoundedCorner(28))]}>
                     <Column modifiers={[fillMaxSize()]} horizontalAlignment="center" verticalArrangement="center">
                        <Icon 
                          source={require('@expo/material-symbols/stars.xml')} 
                          size={40} 
                          tint={theme.onSecondaryContainer} 
                        />
                     </Column>
                  </Box>
                  <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 8 }}>
                    <Text textStyle={{ color: theme.onSurface, fontSize: 20, fontWeight: '600', textAlign: 'center' }}>
                        Your visual memory, searchable
                    </Text>
                    <Text textStyle={{ color: theme.onSurfaceVariant, textAlign: 'center', fontSize: 14 }}>
                        Search for "receipts", "travel", or text inside any screenshot.
                    </Text>
                  </Column>
                </Column>
              )}
            </Column>
          )}
        </Box>

        {/* FAB */}
        <Pressable 
            onPress={() => sync()}
            style={({ pressed }) => [
                { 
                    position: 'absolute', 
                    bottom: 24, 
                    right: 24,
                    backgroundColor: theme.primaryContainer,
                    padding: 16,
                    borderRadius: 16,
                    elevation: 4,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    opacity: pressed ? 0.8 : 1
                }
            ]}
        >
          <Host matchContents={true}>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
              <Icon 
                source={require('../../../assets/sync.xml')} 
                size={24} 
                tint={theme.onPrimaryContainer} 
              />
              {isSyncing && <Text textStyle={{ color: theme.onPrimaryContainer, fontWeight: '600' }}>Syncing...</Text>}
            </Row>
          </Host>
        </Pressable>

        {/* Status Indicator (Snackbar-like) */}
        {isIndexing && !isSyncing && (
          <Box 
            modifiers={[
              fillMaxSize(),
              padding(24, 16, 24, 16)
            ]}
            contentAlignment="bottomStart"
          >
            <Box 
              modifiers={[
                width(240),
                paddingAll(12), 
                background(theme.inverseSurface),
                clip(Shapes.RoundedCorner(12))
              ]}
            >
              <Row 
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 12 }}
              >
                  <RNHostView matchContents={true}>
                    <ActivityIndicator size="small" color={theme.inverseOnSurface} />
                  </RNHostView>
                  <Text textStyle={{ color: theme.inverseOnSurface, fontSize: 13, fontWeight: '500' }}>
                      {`Indexing ${pending + running} items`}
                  </Text>
              </Row>
            </Box>
          </Box>
        )}
      </Column>
    </Host>
  );
}
