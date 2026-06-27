import React, { memo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useMaterialColors } from '@expo/ui/jetpack-compose';

interface ResultItemProps {
  item: any;
  itemSize: number;
}

export const ResultItem = memo(({ item, itemSize }: ResultItemProps) => {
  const colors = useMaterialColors();
  
  return (
    <Pressable style={[styles.itemContainer, { width: itemSize, height: itemSize }]}>
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
});

const styles = StyleSheet.create({
  itemContainer: {
    padding: 4,
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
