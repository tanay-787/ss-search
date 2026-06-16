import React, { memo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

interface ResultItemProps {
  item: any;
  surfaceVariant: string;
  itemSize: number;
}

export const ResultItem = memo(({ item, surfaceVariant, itemSize }: ResultItemProps) => {
  return (
    <Pressable style={[styles.itemContainer, { width: itemSize, height: itemSize }]}>
      <View style={[styles.imageWrapper, { backgroundColor: surfaceVariant }]}>
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
