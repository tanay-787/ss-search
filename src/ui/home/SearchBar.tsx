import React from 'react';
import { Text } from '@expo/ui';
import { Box, DockedSearchBar, RNHostView, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding as paddingModifier } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';

interface SearchBarProps {
  onQueryChange: (query: string) => void;
}

export const SearchBar = React.memo(({ onQueryChange }: SearchBarProps) => {
  const colors = useMaterialColors();
  
  return (
    <Box modifiers={[fillMaxWidth(), paddingModifier(16, 16, 16, 16)]}>
      <DockedSearchBar onQueryChange={onQueryChange}>
        <DockedSearchBar.LeadingIcon>
          <RNHostView matchContents={true}>
            <SymbolView 
              name={{ android: 'search' }} 
              size={24} 
              tintColor={colors.onSurfaceVariant} 
            />
          </RNHostView>
        </DockedSearchBar.LeadingIcon>
        <DockedSearchBar.Placeholder>
          <Text textStyle={{ color: colors.onSurfaceVariant }}>Search screenshots...</Text>
        </DockedSearchBar.Placeholder>
      </DockedSearchBar>
    </Box>
  );
});
