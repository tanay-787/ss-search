import React from 'react';
import { Text } from '@expo/ui';
import { Column, RNHostView } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { useMaterialColors } from '@expo/ui/jetpack-compose';

export const NoResultsState = React.memo(() => {
  const colors = useMaterialColors();
  
  return (
    <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 8 }}>
      <RNHostView matchContents={true}>
        <SymbolView 
          name={{ android: 'search' }} 
          size={48} 
          tintColor={colors.outline} 
        />
      </RNHostView>
      <Text textStyle={{ fontSize: 18, fontWeight: '600' }}>No results</Text>
      <Text textStyle={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>
          Try searching for something else
      </Text>
    </Column>
  );
});
