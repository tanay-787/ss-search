import React, { useState, useEffect } from 'react';
import { 
  Keyboard,
  Dimensions,
} from 'react-native';

import { Column, Box, Surface } from '@expo/ui/jetpack-compose';
import { fillMaxSize } from '@expo/ui/jetpack-compose/modifiers';
import { useSearch, useJobJournalOperations, usePermissionContext } from '@/hooks';
import { Host } from '@expo/ui/jetpack-compose';

import { 
  registerJobJournalBackgroundTask, 
  scheduleJobJournalBackgroundTask 
} from '@/core/jobjournal';
import { 
  Header, 
  SearchBar, 
  ResultsList, 
  EmptyState, 
  NoResultsState,
  GrantPermissionScreen,
} from '@/ui/home';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 2; 
const SPACING = 12;
const ITEM_SIZE = (SCREEN_WIDTH - (SPACING * (COLUMN_COUNT + 1))) / COLUMN_COUNT;

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const { results, search, loading } = useSearch();

  const { sync } = useJobJournalOperations();
  const { hasPermission, requestPermission } = usePermissionContext();

  // Trigger search on query change with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (query) {
        search(query);
        Keyboard.dismiss();
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query, search]);

  // Sync screenshots on mount (only when permission is granted)
  useEffect(() => {
    if (hasPermission) {
      sync();
    }
  }, [sync, hasPermission]);

  const handleGrantPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      await registerJobJournalBackgroundTask();
      await scheduleJobJournalBackgroundTask();
      sync();
    }
  };

  // Permission gate: render nothing else until the user grants full access.
  // Must wrap in its own <Host> — Expo's Stack navigator inserts native Views between
  // the layout-level Host and screen content, breaking the Compose boundary.
  if (!hasPermission) {
    return (
      <Host style={{ flex: 1 }} seedColor="#0057FF">
        <GrantPermissionScreen

          onGrantPermission={handleGrantPermission}
        />
      </Host>
    );
  }

  return (
    <Host style={{ flex: 1 }} seedColor="#0057FF">
      <Surface modifiers={[fillMaxSize()]}>
        <Column modifiers={[fillMaxSize()]}>
        <Header />
        
        <SearchBar 
          onQueryChange={setQuery} 
        />

        <Box modifiers={[fillMaxSize()]}>
          {results.length > 0 ? (
            <ResultsList 
              results={results}

              itemSize={ITEM_SIZE}
              spacing={SPACING}
              columnCount={COLUMN_COUNT}
            />
          ) : (
            <Column modifiers={[fillMaxSize()]} horizontalAlignment="center" verticalArrangement="center">
              {query && !loading ? (
                <NoResultsState />
              ) : (
                <EmptyState />
              )}
            </Column>
          )}
        </Box>
        </Column>
      </Surface>
    </Host>
  );
}
