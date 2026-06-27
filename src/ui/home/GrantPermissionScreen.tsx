import React from 'react';
import { Text } from '@expo/ui';
import { Column, Box, RNHostView, FilledTonalButton, Spacer, Row, Surface, useMaterialColors } from '@expo/ui/jetpack-compose';
import {
  fillMaxSize,
  fillMaxWidth,
  size,
  background,
  clip,
  Shapes,
  padding as paddingModifier,
  weight,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoLibraryIllustration } from '@/ui/illustrations';

interface GrantPermissionScreenProps {
  onGrantPermission: () => void;
}

export const GrantPermissionScreen = React.memo(({ onGrantPermission }: GrantPermissionScreenProps) => {
  const insets = useSafeAreaInsets();
  const colors = useMaterialColors();
  
  return (
    <Surface modifiers={[fillMaxSize()]}>
      <Column modifiers={[fillMaxSize(), paddingModifier(24, 0, 24, Math.max(insets.bottom, 24))]} horizontalAlignment="center">

      {/* Top spacer — pushes content to vertical centre */}
      <Spacer modifiers={[weight(1)]} />

    {/* Icon */}
    <Box modifiers={[size(120, 120), background('transparent'), clip(Shapes.RoundedCorner(36))]}>
      <Column modifiers={[fillMaxSize()]} horizontalAlignment="center" verticalArrangement="center">
        <RNHostView matchContents={true}>
          <PhotoLibraryIllustration size={140} />
        </RNHostView>
      </Column>
    </Box>

    <Spacer modifiers={[size(0, 40)]} />

    {/* Title + body */}
    <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 12 }}>
      <Text textStyle={{ fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 }}>
        Accessing Your Library
      </Text>
      <Text textStyle={{ fontSize: 16, lineHeight: 24, textAlign: 'center' }}>
        To automatically find and index your screenshots, Refind needs access to your entire photo library.
      </Text>
    </Column>

    {/* Bottom spacer — mirrors top, keeps content centred */}
    <Spacer modifiers={[weight(1)]} />

    {/* Footer CTA and Disclaimer */}
    <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 12)]} horizontalAlignment="center" verticalArrangement={{ spacedBy: 8 }}>
      <FilledTonalButton
        onClick={onGrantPermission}
        modifiers={[fillMaxWidth()]}
        contentPadding={{ top: 18, bottom: 18 }}
        >
        <Text textStyle={{ fontSize: 18, fontWeight: '700', letterSpacing: 0.3 }}>
          Grant Permissions
        </Text>
      </FilledTonalButton>

      {/* Disclaimer / Hint below CTA */}
      <Text textStyle={{ color: colors.onSurfaceVariant, fontSize: 14, textAlign: 'center' }}>
        Select "Allow All" to enable search
      </Text>
    </Column>

    </Column>
    </Surface>
  );
});
