import React from 'react';
import { Text } from '@expo/ui';
import { Column, Box } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, size, background, clip, Shapes } from '@expo/ui/jetpack-compose/modifiers';
import { Theme } from '@/theme';

interface EmptyStateProps {
  theme: Theme;
}

export const EmptyState = React.memo(({ theme }: EmptyStateProps) => (
  <Column 
      modifiers={[fillMaxWidth(), padding(40, 0, 0, 0)]} 
      horizontalAlignment="center"
      verticalArrangement={{ spacedBy: 16 }}
  >
      <Box modifiers={[size(64, 64), background(theme.surfaceVariant), clip(Shapes.RoundedCorner(16))]} />
      <Text textStyle={{ color: theme.onSurfaceVariant }}>Your library is empty</Text>
  </Column>
));
