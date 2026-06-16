import React, { useCallback } from 'react';
import { 
  Dimensions,
} from 'react-native';
import { Host } from '@expo/ui'; 
import { Column } from '@expo/ui/jetpack-compose';
import { 
  fillMaxSize, 
} from '@expo/ui/jetpack-compose/modifiers';
import { useJobJournalLibrary, useJobJournalOperations } from '@/hooks';
import { useTheme } from '@/theme';
import { Header, LibraryGrid } from '@/ui-components/library';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const SPACING = 4;
const ITEM_SIZE = (width - (SPACING * (COLUMN_COUNT + 1))) / COLUMN_COUNT;

export default function LibraryScreen() {
  const { items, loading, refresh } = useJobJournalLibrary();
  const { isProcessing } = useJobJournalOperations();
  const theme = useTheme();

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  return (
    <Host style={{ flex: 1, backgroundColor: theme.background }} matchContents={false}>
      <Column modifiers={[fillMaxSize()]}>
        <Header 
          theme={theme} 
          itemCount={items.length} 
          isProcessing={isProcessing} 
        />

        <LibraryGrid
          items={items}
          theme={theme}
          itemSize={ITEM_SIZE}
          spacing={SPACING}
          columnCount={COLUMN_COUNT}
          loading={loading}
          onRefresh={onRefresh}
        />
      </Column>
    </Host>
  );
}
