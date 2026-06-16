import React from 'react';
import { Text } from '@expo/ui';
import { Column, RNHostView } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { Theme } from '@/theme';

interface NoResultsStateProps {
  theme: Theme;
}

export const NoResultsState = React.memo(({ theme }: NoResultsStateProps) => (
  <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 8 }}>
    <RNHostView matchContents={true}>
      <SymbolView 
        name={{ android: 'search' }} 
        size={48} 
        tintColor={theme.outline} 
      />
    </RNHostView>
    <Text textStyle={{ color: theme.onSurface, fontSize: 18, fontWeight: '600' }}>No results</Text>
    <Text textStyle={{ color: theme.onSurfaceVariant, textAlign: 'center' }}>
        Try searching for something else
    </Text>
  </Column>
));
