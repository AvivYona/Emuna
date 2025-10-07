import React from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Background } from '../api/types';
import { colors, spacing } from '../theme';

type Props = {
  item: Background;
  selected: boolean;
  onSelect: () => void;
  loading?: boolean;
};

export const BackgroundCard: React.FC<Props> = ({
  item,
  selected,
  onSelect,
  loading = false,
}) => {
  return (
    <Pressable
      accessibilityRole='button'
      disabled={loading}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.pressed : null,
        selected ? styles.selected : null,
        loading ? styles.disabled : null,
      ]}
    >
      <ImageBackground
        source={{ uri: item.thumbnailUrl ?? item.imageUrl }}
        style={styles.image}
        imageStyle={styles.imageRadius}
      >
        <View style={styles.overlay}>
          <Text style={styles.title}>{item.title ?? 'רקע מותאם'}</Text>
          {selected ? <Text style={styles.selectedText}>נבחר</Text> : null}
        </View>
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size='large' color={colors.accent} />
          </View>
        ) : null}
      </ImageBackground>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 3 / 4,
    margin: spacing.sm,
    borderRadius: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  selected: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.65,
  },
  image: {
    flex: 1,
    justifyContent: 'space-between',
  },
  imageRadius: {
    borderRadius: spacing.lg,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 27, 42, 0.35)',
    padding: spacing.sm,
    justifyContent: 'space-between',
    direction: 'rtl',
    writingDirection: 'rtl',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  selectedText: {
    color: colors.accent,
    fontWeight: '700',
    textAlign: 'right',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 27, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
