import React, { memo, forwardRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import type { SearchResult } from '@/core/jobjournal/search/hybrid';

interface ResultItemProps {
  item: SearchResult;
  onPress?: () => void;
}

export const ResultItem = memo(forwardRef<View, ResultItemProps>(({ item, onPress }, ref) => {
  const colors = useMaterialColors();
  
  return (
    <Pressable
      ref={ref as any}
      style={[styles.itemContainer, { aspectRatio: item.aspectRatio || 1 }]}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: false }}
    >
      <View style={[styles.imageWrapper, { backgroundColor: colors.surfaceVariant }]}>
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      </View>
    </Pressable>
  );
}));

const styles = StyleSheet.create({
  itemContainer: {
    width: '100%',
  },
  imageWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    flex: 1,
    borderRadius: 20,
  },
});
