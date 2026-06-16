import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Text } from '@expo/ui';
import { Column, Row, Box, RNHostView } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, paddingAll, background, clip, Shapes } from '@expo/ui/jetpack-compose/modifiers';
import { Theme } from '@/theme';

interface HeaderProps {
  theme: Theme;
  itemCount: number;
  isProcessing: boolean;
}

export const Header = React.memo(({ theme, itemCount, isProcessing }: HeaderProps) => (
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
        {`${itemCount} items collected`}
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
));
