import { useEffect, useState } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';

type PermissionPrimerProps = {
  visible: boolean;
  onDismiss: () => void;
  onGranted: () => void;
};

export default function PermissionPrimer({ visible, onDismiss, onGranted }: PermissionPrimerProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    (async () => {
      const current = await MediaLibrary.getPermissionsAsync();
      if (!cancelled && current.granted) {
        onGranted();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onGranted, visible]);

  async function handleContinue() {
    setLoading(true);
    const result = await MediaLibrary.requestPermissionsAsync();
    setLoading(false);

    if (result.granted) {
      onGranted();
      return;
    }

    onDismiss();
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} dismissable={!loading}>
        <Dialog.Title>Find anything you&apos;ve seen before</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
            SS-Search builds a private library from your screenshots so you can search them later, even offline.
          </Text>
          <Text variant="bodyMedium" style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
            We need photo access to read screenshots on device. Your files stay local.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={loading}>
            Not now
          </Button>
          <Button mode="contained" onPress={handleContinue} loading={loading}>
            Continue
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
