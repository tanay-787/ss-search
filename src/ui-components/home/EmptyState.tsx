import React from 'react';
import { Text } from '@expo/ui';
import { Column, Box, RNHostView } from '@expo/ui/jetpack-compose';
import { fillMaxSize, size, background, clip, Shapes, padding as paddingModifier } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { Theme } from '@/theme';

interface EmptyStateProps {
  theme: Theme;
}

export const EmptyState = React.memo(({ theme }: EmptyStateProps) => (
  <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 24 }} modifiers={[paddingModifier(0, 32, 0, 32)]}>
    <Box modifiers={[size(120, 120), background(theme.secondaryContainer), clip(Shapes.RoundedCorner(28))]}>
       <Column modifiers={[fillMaxSize()]} horizontalAlignment="center" verticalArrangement="center">
          <RNHostView matchContents={true}>
            <SymbolView
              name={{ android: 'stars' }}  
              size={40} 
              tintColor={theme.onSecondaryContainer} 
            />
          </RNHostView>
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
));
