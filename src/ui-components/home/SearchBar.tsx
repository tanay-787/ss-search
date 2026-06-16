import React from 'react';
import { Text } from '@expo/ui';
import { Box, DockedSearchBar, RNHostView } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding as paddingModifier } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { Theme } from '@/theme';

interface SearchBarProps {
  onQueryChange: (query: string) => void;
  theme: Theme;
}

export const SearchBar = React.memo(({ onQueryChange, theme }: SearchBarProps) => (
  <Box modifiers={[fillMaxWidth(), paddingModifier(16, 16, 16, 16)]}>
    <DockedSearchBar onQueryChange={onQueryChange}>
      <DockedSearchBar.LeadingIcon>
        <RNHostView matchContents={true}>
          <SymbolView 
            name={{ android: 'search' }} 
            size={24} 
            tintColor={theme.onSurfaceVariant} 
          />
        </RNHostView>
      </DockedSearchBar.LeadingIcon>
      <DockedSearchBar.Placeholder>
        <Text textStyle={{ color: theme.onSurfaceVariant }}>Search screenshots...</Text>
      </DockedSearchBar.Placeholder>
    </DockedSearchBar>
  </Box>
));
