import { Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.surface,
          borderTopWidth: 0,
          height: 88,
          paddingTop: 10,
          paddingBottom: 14,
          paddingHorizontal: 16,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '500',
          marginBottom: 0,
        },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 6,
          overflow: 'hidden',
        },
        tabBarIcon: ({ color, size }) => {
          let emoji = '?';

          if (route.name === 'home') {
            emoji = '🔍';
          } else if (route.name === 'library') {
            emoji = '📚';
          }

          return (
            <Text style={{ fontSize: size, color }} allowFontScaling={false}>
              {emoji}
            </Text>
          );
        },
        tabBarLabel: route.name === 'home' ? 'Search' : 'Library',
        tabBarButton: (props) => {
          const focused = props.accessibilityState?.selected;

          return (
            <Pressable
              {...props}
              style={[
                props.style,
                {
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  backgroundColor: focused ? theme.colors.primaryContainer : 'transparent',
                },
              ]}
            />
          );
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Search' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
    </Tabs>
  );
}
