import React from 'react';
import { Text } from '@expo/ui';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding as paddingModifier } from '@expo/ui/jetpack-compose/modifiers';
import { Theme } from '@/theme';

interface HeaderProps {
  theme: Theme;
}

export const Header = React.memo(({ theme }: HeaderProps) => (
  <Column modifiers={[fillMaxWidth(), paddingModifier(16, 32, 8, 16)]}>
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
));
