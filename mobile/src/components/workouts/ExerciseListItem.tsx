import { useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, Text, View } from 'react-native';

import { API_BASE_URL } from '../../api/client';
import { colors } from '../../theme/colors';
import { fontFamilies, typography } from '../../theme/typography';
import { Exercise } from '../../types/workouts';

type Props = {
  exercise: Exercise;
  onDrag?: () => void;
  onSwap?: () => void;
  onRemove?: () => void;
  onPreviewImage?: (uri: string) => void;
};

const resolveExerciseImageUri = (uri?: string) => {
  if (!uri) return undefined;
  if (uri.startsWith('http')) return uri;
  return `${API_BASE_URL.replace(/\/api$/, '')}${uri}`;
};

const ExerciseListItem = ({
  exercise,
  onDrag,
  onSwap,
  onRemove,
  onPreviewImage,
}: Props) => {
  const imageUri = useMemo(
    () => resolveExerciseImageUri(exercise.gifUrl),
    [exercise.gifUrl]
  );

  const subtitle = [exercise.primaryMuscleGroup, exercise.equipment]
    .filter(Boolean)
    .join(' • ');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable
        onLongPress={onDrag}
        disabled={!onDrag}
        accessibilityRole='button'
        accessibilityLabel='Reorder exercise'
        style={({ pressed }) => ({
          padding: 6,
          borderRadius: 999,
          backgroundColor: pressed ? colors.surface : 'transparent',
          opacity: onDrag ? 1 : 0.5,
        })}
      >
        <Ionicons
          name='reorder-three'
          size={24}
          color={colors.textSecondary}
        />
      </Pressable>

      {imageUri ? (
        <Pressable
          onPress={() => onPreviewImage?.(imageUri)}
          disabled={!onPreviewImage}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel={`Preview ${exercise.name} image`}
          style={({ pressed }) => ({
            borderRadius: 12,
            overflow: 'hidden',
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Image
            source={{ uri: imageUri }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
            }}
            resizeMode='cover'
          />
        </Pressable>
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel={`${exercise.name} thumbnail placeholder`}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: fontFamilies.semibold,
              fontSize: 14,
            }}
          >
            {exercise.name?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            ...typography.title,
            color: colors.textPrimary,
            flexShrink: 1,
          }}
        >
          {exercise.name}
        </Text>
        {subtitle ? (
          <Text
            style={{ ...typography.caption, color: colors.textSecondary }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 10, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable
          onPress={onSwap}
          disabled={!onSwap}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel='Swap exercise'
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons
            name='swap-horizontal-outline'
            color={colors.primary}
            size={20}
          />
        </Pressable>

        <Pressable
          onPress={onRemove}
          disabled={!onRemove}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel='Remove exercise'
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Ionicons
            name='trash-outline'
            color={colors.textSecondary}
            size={20}
          />
        </Pressable>
      </View>
    </View>
  );
};

export default ExerciseListItem;
