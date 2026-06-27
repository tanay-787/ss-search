import { useEffect, useState } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Icon } from '@expo/ui/jetpack-compose';
import { Host } from '@expo/ui';
import { useTheme } from '@/theme';

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
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: theme.surface }]}>
          <View style={styles.iconContainer}>
             <Host matchContents={true} seedColor="#0057FF" colorScheme={theme.isDark ? 'dark' : 'light'}>
                <Icon 
                  source={require('@/assets/photo_library.xml')} 
                  size={32} 
                  tint={theme.primary} 
                />
             </Host>
          </View>
          
          <Text style={[styles.title, { color: theme.onSurface }]}>
            Build your private library
          </Text>
          
          <Text style={[styles.content, { color: theme.onSurfaceVariant }]}>
            Refind creates a private index of your screenshots so you can search them later, even offline.
          </Text>
          
          <Text style={[styles.secondaryContent, { color: theme.outline }]}>
            Your files stay local and never leave your device.
          </Text>

          <View style={styles.actions}>
            <Pressable 
                onPress={onDismiss} 
                disabled={loading}
                style={({ pressed }) => [
                    styles.textButton,
                    pressed && { backgroundColor: theme.surfaceVariant }
                ]}
            >
              <Text style={[styles.buttonText, { color: theme.primary }]}>Not now</Text>
            </Pressable>
            
            <Pressable 
              onPress={handleContinue} 
              disabled={loading} 
              style={({ pressed }) => [
                styles.filledButton, 
                { backgroundColor: theme.primary },
                pressed && { opacity: 0.8 }
              ]}
            >
              {loading ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Continue</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 320,
    padding: 24,
    borderRadius: 28, // Material 3 Extra Large
    elevation: 3,
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '400',
    marginBottom: 16,
    textAlign: 'center',
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  secondaryContent: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  textButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  filledButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
