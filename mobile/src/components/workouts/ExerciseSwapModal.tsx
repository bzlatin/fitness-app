import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { swapExercise } from '../../api/ai';
import { API_BASE_URL } from '../../api/client';
import { getCustomExercises, searchAllExercises } from '../../api/exercises';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSubscriptionAccess } from '../../hooks/useSubscriptionAccess';
import { colors } from '../../theme/colors';
import { fontFamilies, typography } from '../../theme/typography';
import { Exercise } from '../../types/workouts';
import UpgradePrompt from '../premium/UpgradePrompt';
import CreateCustomExerciseModal from './CreateCustomExerciseModal';

const muscleGroups = [
  'all',
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'glutes',
  'core',
  'custom',
];

const getValidMuscleGroup = (primaryMuscleGroup?: string): string => {
  if (!primaryMuscleGroup) return 'all';
  const normalized = primaryMuscleGroup.toLowerCase();
  return muscleGroups.includes(normalized) ? normalized : 'all';
};

interface ExerciseSwapModalProps {
  visible: boolean;
  onClose: () => void;
  exercise: {
    exerciseId: string;
    exerciseName: string;
    primaryMuscleGroup?: string;
    sets?: number;
    reps?: number;
    restSeconds?: number;
  };
  onSwap: (newExercise: {
    exerciseId: string;
    exerciseName: string;
    sets?: number;
    reps?: number;
    restSeconds?: number;
    gifUrl?: string;
    primaryMuscleGroup?: string;
  }) => void;
}

const ExerciseSwapModal = ({ visible, onClose, exercise, onSwap }: ExerciseSwapModalProps) => {
  const insets = useSafeAreaInsets();
  const subscriptionAccess = useSubscriptionAccess();
  const isPro = subscriptionAccess.hasProAccess;

  const [swapMode, setSwapMode] = useState<'choose' | 'ai' | 'manual' | 'create_custom'>(
    'choose'
  );
  const [isSwapping, setIsSwapping] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [query, setQuery] = useState('');
  const [muscleGroup, setMuscleGroup] = useState(getValidMuscleGroup(exercise.primaryMuscleGroup));
  const [returnToManualAfterCreateClose, setReturnToManualAfterCreateClose] = useState(true);

  const debouncedQuery = useDebouncedValue(query, 350);
  const apiHost = API_BASE_URL.replace(/\/api$/, '');

  useEffect(() => {
    if (!visible) {
      setSwapMode('choose');
      setIsSwapping(false);
      setShowUpgradePrompt(false);
      setQuery('');
      setReturnToManualAfterCreateClose(true);
      return;
    }

    setSwapMode('choose');
    setIsSwapping(false);
    setShowUpgradePrompt(false);
    setQuery('');
    setReturnToManualAfterCreateClose(true);
    setMuscleGroup(getValidMuscleGroup(exercise.primaryMuscleGroup));
  }, [visible, exercise.primaryMuscleGroup]);

  const manualExercisesQuery = useQuery({
    queryKey: ['exercises-all', debouncedQuery, muscleGroup],
    queryFn: () =>
      searchAllExercises({
        query: debouncedQuery || undefined,
        muscleGroup:
          muscleGroup === 'all' || muscleGroup === 'custom'
            ? undefined
            : muscleGroup,
      }),
    enabled: visible && swapMode === 'manual',
    staleTime: 1000 * 60 * 5,
  });

  const customExercisesQuery = useQuery({
    queryKey: ['custom-exercises', muscleGroup, debouncedQuery],
    queryFn: getCustomExercises,
    enabled: visible && swapMode === 'manual',
    staleTime: 1000 * 60 * 5,
  });

  const filteredCustomExercises = (customExercisesQuery.data ?? []).filter((exercise) => {
    const nameMatches = debouncedQuery
      ? exercise.name.toLowerCase().includes(debouncedQuery.toLowerCase())
      : true;
    if (!nameMatches) return false;
    if (muscleGroup === 'custom') return true;
    const exerciseGroup = exercise.primaryMuscleGroup?.toLowerCase() ?? '';
    const muscleMatches =
      muscleGroup === 'all'
        ? true
        : exerciseGroup
        ? exerciseGroup.includes(muscleGroup)
        : false;
    return muscleMatches;
  });

  const customFromSearch = manualExercisesQuery.data?.custom ?? [];
  const customById = new Map<string, Exercise>();
  customFromSearch.forEach((exercise) => customById.set(exercise.id, exercise));
  filteredCustomExercises.forEach((exercise) => {
    if (!customById.has(exercise.id)) {
      customById.set(exercise.id, {
        id: exercise.id,
        name: exercise.name,
        primaryMuscleGroup: exercise.primaryMuscleGroup,
        equipment: exercise.equipment ?? 'bodyweight',
        category: 'custom',
        gifUrl: exercise.imageUrl,
        isCustom: true,
        createdBy: exercise.userId,
      });
    }
  });

  const allExercises = [
    ...(muscleGroup === 'custom' ? [] : manualExercisesQuery.data?.library ?? []),
    ...Array.from(customById.values()),
  ];

  const resetAndClose = () => {
    setSwapMode('choose');
    setIsSwapping(false);
    onClose();
  };

  const applySwap = (selectedExercise: Exercise, options?: { showAlert?: boolean }) => {
    onSwap({
      exerciseId: selectedExercise.id,
      exerciseName: selectedExercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      restSeconds: exercise.restSeconds,
      gifUrl: selectedExercise.gifUrl,
      primaryMuscleGroup: selectedExercise.primaryMuscleGroup,
    });

    if (options?.showAlert !== false) {
      Alert.alert('Exercise Swapped!', `Swapped to ${selectedExercise.name}`);
    }
    resetAndClose();
  };

  const handleAISwap = async () => {
    if (!isPro) {
      setShowUpgradePrompt(true);
      return;
    }

    setIsSwapping(true);
    try {
      const result = await swapExercise({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        primaryMuscleGroup: exercise.primaryMuscleGroup || 'chest',
        reason: 'User requested alternative exercise',
      });

      if (!result.exerciseId) {
        Alert.alert('No Alternative Found', "Couldn't find a suitable alternative for this exercise.");
        setIsSwapping(false);
        return;
      }

      onSwap({
        exerciseId: result.exerciseId,
        exerciseName: result.exerciseName || 'Unknown Exercise',
        sets: exercise.sets,
        reps: exercise.reps,
        restSeconds: exercise.restSeconds,
        gifUrl: result.gifUrl,
        primaryMuscleGroup: result.primaryMuscleGroup,
      });

      Alert.alert(
        'Exercise Swapped!',
        `Swapped to ${result.exerciseName}${result.reasoning ? `\n\n${result.reasoning}` : ''}`
      );

      resetAndClose();
    } catch (error: any) {
      Alert.alert(
        'Swap Failed',
        error?.response?.data?.message || 'Failed to swap exercise. Please try again.'
      );
      setIsSwapping(false);
    }
  };

  const handleCreateCustom = () => {
    setReturnToManualAfterCreateClose(true);
    setSwapMode('create_custom');
  };

  const handleCustomCreated = (created: Exercise) => {
    setReturnToManualAfterCreateClose(false);
    applySwap(created, { showAlert: false });
  };

  const renderManualExercise = ({ item }: { item: Exercise }) => {
    const imageUri =
      item.gifUrl && item.gifUrl.startsWith('http')
        ? item.gifUrl
        : item.gifUrl
          ? `${apiHost}${item.gifUrl}`
          : undefined;

    return (
      <Pressable
        onPress={() => applySwap(item)}
        onLongPress={() => Alert.alert('Exercise name', item.name)}
        delayLongPress={300}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 12,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 10,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{
                width: 68,
                height: 68,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
              }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="fitness-outline" color={colors.textSecondary} size={28} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                ...typography.title,
                color: colors.textPrimary,
              }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.name}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 4,
              }}
            >
              {item.isCustom ? (
                <View
                  style={{
                    backgroundColor: 'rgba(34,197,94,0.15)',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: colors.primary,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: fontFamilies.semibold,
                      color: colors.primary,
                    }}
                  >
                    CUSTOM
                  </Text>
                </View>
              ) : null}
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                {item.primaryMuscleGroup} • {item.equipment || 'Bodyweight'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <UpgradePrompt
        visible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="Smart Exercise Swap"
      />

      <Modal
        visible={visible && swapMode !== 'create_custom'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetAndClose}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 6,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                {swapMode !== 'choose' ? (
                  <Pressable
                    onPress={() => setSwapMode('choose')}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      padding: 8,
                      borderRadius: 10,
                      backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                    })}
                  >
                    <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
                  Swap exercise
                </Text>
                <Text
                  style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {exercise.exerciseName}
                </Text>
              </View>
            </View>

              <Pressable onPress={resetAndClose} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            {swapMode === 'manual' ? (
              <>
                <View
                  style={{
                    marginTop: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <Ionicons name="search" color={colors.textSecondary} size={18} />
                  <TextInput
                    placeholder="Search by name"
                    placeholderTextColor={colors.textSecondary}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      paddingHorizontal: 10,
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.regular,
                    }}
                    value={query}
                    onChangeText={setQuery}
                  />
                </View>

                <FlatList
                  data={muscleGroups}
                  keyExtractor={(item) => item}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
                  renderItem={({ item }) => {
                    const isActive = item === muscleGroup;
                    return (
                      <Pressable
                        onPress={() => setMuscleGroup(item)}
                        style={({ pressed }) => ({
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 999,
                          backgroundColor: isActive ? colors.primary : colors.surfaceMuted,
                          borderWidth: 1,
                          borderColor: isActive ? colors.primary : colors.border,
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        <Text
                          style={{
                            fontFamily: fontFamilies.semibold,
                            color: isActive ? colors.surface : colors.textPrimary,
                            textTransform: 'capitalize',
                          }}
                        >
                          {item}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </>
            ) : null}
          </View>

          {swapMode === 'choose' ? (
            <View style={{ padding: 16, gap: 12, paddingBottom: 16 + Math.max(0, insets.bottom) }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 4 }}>
                Choose how you&apos;d like to swap this exercise:
              </Text>

              <Pressable
                onPress={() => setSwapMode('ai')}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  padding: 16,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  backgroundColor: pressed ? `${colors.primary}10` : colors.surfaceMuted,
                })}
              >
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 12,
                    backgroundColor: `${colors.primary}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 28 }}>🎯</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 16,
                      }}
                    >
                      Smart Swap
                    </Text>
                    {!isPro ? (
                      <View
                        style={{
                          backgroundColor: colors.primary,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ color: '#0B1220', fontSize: 9, fontWeight: '700' }}>
                          PRO
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                    Find the best alternative based on your goals
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>

              <Pressable
                onPress={() => setSwapMode('manual')}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  padding: 16,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? `${colors.secondary}10` : colors.surfaceMuted,
                })}
              >
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 12,
                    backgroundColor: `${colors.secondary}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 28 }}>📋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    Manual Swap
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                    Browse and choose from available exercises
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          {swapMode === 'ai' ? (
            <View style={{ padding: 16, gap: 16, paddingBottom: 16 + Math.max(0, insets.bottom) }}>
              <View
                style={{
                  backgroundColor: colors.surfaceMuted,
                  padding: 16,
                  borderRadius: 14,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 32 }}>🎯</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 16,
                      }}
                    >
                      Smart Exercise Swap
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                      We&apos;ll use your profile to find the best alternative
                    </Text>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={handleAISwap}
                disabled={isSwapping}
                style={({ pressed }) => ({
                  paddingVertical: 16,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  opacity: pressed || isSwapping ? 0.7 : 1,
                })}
              >
                {isSwapping ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text
                    style={{
                      color: colors.surface,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    Find Alternative
                  </Text>
                )}
              </Pressable>

              {isSwapping ? (
                <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center' }}>
                  This may take a few seconds...
                </Text>
              ) : null}
            </View>
          ) : null}

          {swapMode === 'manual' ? (
            <FlatList
              data={allExercises.filter((ex) => ex.id !== exercise.exerciseId)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 120 + Math.max(0, insets.bottom),
              }}
              renderItem={renderManualExercise}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                manualExercisesQuery.isFetching ? (
                  <View style={{ paddingVertical: 8 }}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : null
              }
              ListFooterComponent={
                <Pressable
                  onPress={handleCreateCustom}
                  style={({ pressed }) => ({
                    marginTop: 8,
                    backgroundColor: colors.surface,
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.9 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: `${colors.primary}18`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.body, color: colors.textPrimary }}>
                      Create custom exercise
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                      {debouncedQuery ? `Add "${debouncedQuery}" to your library` : 'Use your own movement'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              }
              ListEmptyComponent={
                !manualExercisesQuery.isFetching ? (
                  <View style={{ padding: 20, alignItems: 'center', gap: 6 }}>
                    <Text style={{ ...typography.title, color: colors.textPrimary }}>
                      No exercises found
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                      Try another muscle group or a simpler search.
                    </Text>
                    <Pressable
                      onPress={handleCreateCustom}
                      style={({ pressed }) => ({
                        marginTop: 10,
                        backgroundColor: colors.primary,
                        paddingVertical: 12,
                        paddingHorizontal: 20,
                        borderRadius: 12,
                        opacity: pressed ? 0.92 : 1,
                      })}
                    >
                      <Text style={{ fontFamily: fontFamilies.semibold, color: colors.surface }}>
                        Create custom exercise
                      </Text>
                    </Pressable>
                  </View>
                ) : null
              }
            />
          ) : null}
        </View>
      </Modal>

      <CreateCustomExerciseModal
        visible={visible && swapMode === 'create_custom'}
        onClose={() => setSwapMode(returnToManualAfterCreateClose ? 'manual' : 'choose')}
        onCreated={handleCustomCreated}
        initialName={debouncedQuery || exercise.exerciseName}
      />
    </>
  );
};

export default ExerciseSwapModal;
