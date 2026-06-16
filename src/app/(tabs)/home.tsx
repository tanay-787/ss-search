import React, { useState, useEffect } from 'react';
import { 
  Keyboard,
  Dimensions,
} from 'react-native';
import { Host } from '@expo/ui'; 
import { Column, Box } from '@expo/ui/jetpack-compose';
import { 
  fillMaxSize, 
} from '@expo/ui/jetpack-compose/modifiers';
import { useSearch, useJobJournalStats, useJobJournalOperations } from '@/hooks';
import { useTheme } from '@/theme';
import { 
  Header, 
  SearchBar, 
  ResultsList, 
  EmptyState, 
  NoResultsState 
} from '@/ui-components/home';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 2; 
const SPACING = 12;
const ITEM_SIZE = (SCREEN_WIDTH - (SPACING * (COLUMN_COUNT + 1))) / COLUMN_COUNT;

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const { results, search, loading } = useSearch();
  const theme = useTheme();
  const { sync } = useJobJournalOperations();

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

  useEffect(() => {
    sync();
  }, []);

  return (
    <Host style={{ flex: 1, backgroundColor: theme.background }}>
      <Column modifiers={[fillMaxSize()]}>
        <Header theme={theme} />
        
        <SearchBar 
          theme={theme} 
          onQueryChange={setQuery} 
        />

        <Box modifiers={[fillMaxSize()]}>
          {results.length > 0 ? (
            <ResultsList 
              results={results}
              theme={theme}
              itemSize={ITEM_SIZE}
              spacing={SPACING}
              columnCount={COLUMN_COUNT}
            />
          ) : (
            <Column modifiers={[fillMaxSize()]} horizontalAlignment="center" verticalArrangement="center">
              {query && !loading ? (
                 <NoResultsState theme={theme} />
              ) : (
                <EmptyState theme={theme} />
              )}
            </Column>
          )}
        </Box>
      </Column>
    </Host>
  );
}

