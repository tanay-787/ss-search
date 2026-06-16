import React, { memo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

interface LibraryItemProps {
  item: any;
  itemSize: number;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'indexed': return '#22c55e'; // green
    case 'working': return '#3b82f6'; // blue
    case 'error': return '#ef4444'; // red
    default: return '#6b7280'; // gray
  }
}

export const LibraryItem = memo(({ item, itemSize }: LibraryItemProps) => (
  <Pressable style={[styles.itemContainer, { width: itemSize, height: itemSize }]}>
    <View style={styles.imageWrapper}>
      <Image
        source={{ uri: item.uri }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
      <View style={[
        styles.statusIndicator, 
        { backgroundColor: getStatusColor(item.status) }
      ]} />
    </View>
  </Pressable>
));

const styles = StyleSheet.create({
  itemContainer: {
    padding: 2,
  },
  imageWrapper: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    flex: 1,
  },
  statusIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.8)',
  },
});
