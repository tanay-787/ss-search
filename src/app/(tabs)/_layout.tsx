import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTheme } from '@/theme';
import { Host } from '@expo/ui';
import { Icon } from '@expo/ui/jetpack-compose';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.surface}
      tintColor={theme.primary}
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon md={'search'}/>
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon md={'photo_library'}/>
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

