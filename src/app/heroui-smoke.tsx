import { useRouter } from 'expo-router';
import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Text } from 'heroui-native/text';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HeroUISmoke() {
  const router = useRouter();
  const [count, setCount] = useState(0);

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Card style={{ padding: 16, width: '100%' }}>
          <Text style={{ marginBottom: 12 }}>HeroUI Native Smoke Test</Text>
          <Button onPress={() => setCount((c) => c + 1)} style={{ marginBottom: 12 }}>
            Press me ({count})
          </Button>
          <Button onPress={() => router.replace('/(tabs)/home')}>Continue to app</Button>
        </Card>
      </View>
    </SafeAreaView>
  );
}
