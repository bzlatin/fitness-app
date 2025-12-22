import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ScreenContainer from '../components/layout/ScreenContainer';
import EquipmentSelector from '../components/gym/EquipmentSelector';
import {
  ALL_EQUIPMENT,
  HOME_PRESET_EQUIPMENT,
} from '../constants/gymEquipment';
import CardioSettings from '../components/gym/CardioSettings';
import { colors } from '../theme/colors';
import { fontFamilies, typography } from '../theme/typography';
import { DEFAULT_GYM_PREFERENCES, GymPreferences, GymProfile, GymType } from '../types/gym';
import { fetchGymPreferences, updateGymPreferences } from '../api/gymPreferences';
import { ensureGymPreferences, getActiveGym } from '../utils/gymPreferences';
import { calculateWarmupSets } from '../utils/warmupCalculator';
import { useCurrentUser } from '../hooks/useCurrentUser';

const SESSION_DURATIONS = [30, 45, 60, 90];

const createGymId = () =>
  `gym-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const formatGymType = (type: GymType) => {
  if (type === 'home') return 'Home Gym';
  if (type === 'commercial') return 'Commercial Gym';
  return 'Custom Gym';
};

const GymPreferencesScreen = () => {
  const queryClient = useQueryClient();
  const { user, refresh } = useCurrentUser();

  const preferencesQuery = useQuery({
    queryKey: ['gym-preferences'],
    queryFn: fetchGymPreferences,
    initialData: user?.gymPreferences
      ? ensureGymPreferences(user.gymPreferences)
      : undefined,
  });

  const basePreferences = useMemo(
    () =>
      ensureGymPreferences(
        preferencesQuery.data ?? user?.gymPreferences ?? DEFAULT_GYM_PREFERENCES
      ),
    [preferencesQuery.data, user?.gymPreferences]
  );

  const [draft, setDraft] = useState<GymPreferences>(basePreferences);
  const [gymModalVisible, setGymModalVisible] = useState(false);
  const [gymNameDraft, setGymNameDraft] = useState('');
  const [gymTypeDraft, setGymTypeDraft] = useState<GymType>('custom');
  const [editingGymId, setEditingGymId] = useState<string | null>(null);

  useEffect(() => {
    setDraft(basePreferences);
  }, [basePreferences]);

  const updateDraft = (updater: (prev: GymPreferences) => GymPreferences) => {
    setDraft((prev) => ensureGymPreferences(updater(prev)));
  };

  const activeGym = getActiveGym(draft);
  const warmupPreview = useMemo(() => {
    if (!draft.warmupSets.enabled) return [];
    return calculateWarmupSets(200, 8, draft.warmupSets);
  }, [draft.warmupSets]);

  const saveMutation = useMutation({
    mutationFn: updateGymPreferences,
    onSuccess: (next) => {
      const normalized = ensureGymPreferences(next);
      setDraft(normalized);
      queryClient.setQueryData(['gym-preferences'], normalized);
      queryClient.invalidateQueries({ queryKey: ['analytics', 'up-next'] });
      void refresh();
    },
    onError: () => {
      Alert.alert(
        'Could not save preferences',
        'Please try again in a moment.'
      );
    },
  });

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(basePreferences),
    [draft, basePreferences]
  );

  const handleSave = () => {
    saveMutation.mutate(draft);
  };

  const updateActiveGym = (updates: Partial<GymProfile>) => {
    if (!activeGym) return;
    updateDraft((prev) => ({
      ...prev,
      gyms: prev.gyms.map((gym) =>
        gym.id === activeGym.id ? { ...gym, ...updates } : gym
      ),
    }));
  };

  const handlePreset = (preset: 'home' | 'commercial') => {
    const equipment =
      preset === 'home' ? HOME_PRESET_EQUIPMENT : ALL_EQUIPMENT;
    updateActiveGym({
      equipment,
      bodyweightOnly: false,
      type: preset,
    });
  };

  const openGymModal = (gym?: GymProfile) => {
    if (gym) {
      setEditingGymId(gym.id);
      setGymNameDraft(gym.name);
      setGymTypeDraft(gym.type);
    } else {
      setEditingGymId(null);
      setGymNameDraft('');
      setGymTypeDraft('custom');
    }
    setGymModalVisible(true);
  };

  const closeGymModal = () => {
    setGymModalVisible(false);
  };

  const handleSaveGym = () => {
    const name = gymNameDraft.trim() || 'My Gym';
    updateDraft((prev) => {
      if (editingGymId) {
        return {
          ...prev,
          gyms: prev.gyms.map((gym) =>
            gym.id === editingGymId
              ? { ...gym, name, type: gymTypeDraft }
              : gym
          ),
        };
      }
      const presetEquipment =
        gymTypeDraft === 'home'
          ? HOME_PRESET_EQUIPMENT
          : gymTypeDraft === 'commercial'
          ? ALL_EQUIPMENT
          : prev.equipment;
      const newGym: GymProfile = {
        id: createGymId(),
        name,
        type: gymTypeDraft,
        equipment: presetEquipment,
        bodyweightOnly: false,
      };
      return {
        ...prev,
        gyms: [...prev.gyms, newGym],
        activeGymId: newGym.id,
      };
    });
    setGymModalVisible(false);
  };

  const handleDeleteGym = () => {
    if (!editingGymId || draft.gyms.length <= 1) {
      setGymModalVisible(false);
      return;
    }

    updateDraft((prev) => {
      const gyms = prev.gyms.filter((gym) => gym.id !== editingGymId);
      const nextActive =
        prev.activeGymId === editingGymId ? gyms[0]?.id ?? null : prev.activeGymId;
      return {
        ...prev,
        gyms,
        activeGymId: nextActive,
      };
    });
    setGymModalVisible(false);
  };

  const renderStepper = ({
    label,
    value,
    min,
    max,
    step,
    suffix,
    onChange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    suffix?: string;
    onChange: (next: number) => void;
  }) => (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - step))}
          style={({ pressed }) => ({
            width: 30,
            height: 30,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? colors.surface : colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
          })}
        >
          <Ionicons name='remove' size={14} color={colors.textSecondary} />
        </Pressable>
        <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.bold }}>
          {value}
          {suffix ?? ''}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + step))}
          style={({ pressed }) => ({
            width: 30,
            height: 30,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? colors.surface : colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
          })}
        >
          <Ionicons name='add' size={14} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  const saveButton = (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 24,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Pressable
        onPress={handleSave}
        disabled={!isDirty || saveMutation.isPending}
        style={({ pressed }) => ({
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: !isDirty || saveMutation.isPending ? colors.border : colors.primary,
          alignItems: 'center',
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text
          style={{
            color: !isDirty || saveMutation.isPending ? colors.textSecondary : '#0B1220',
            fontFamily: fontFamilies.bold,
            fontSize: 15,
          }}
        >
          {saveMutation.isPending ? 'Saving...' : isDirty ? 'Save preferences' : 'All set'}
        </Text>
      </Pressable>
    </View>
  );

  if (preferencesQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
            Loading preferences...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll bottomOverlay={saveButton} paddingTop={16} includeTopInset={false}>
      <View style={{ gap: 24 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
            Gym equipment & preferences
          </Text>
          <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
            Fine-tune your available equipment, cardio add-ons, and session length.
            These settings help the AI build workouts that match your real gym.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
            Gym profiles
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {draft.gyms.map((gym) => {
                const isActive = gym.id === draft.activeGymId;
                return (
                  <Pressable
                    key={gym.id}
                    onPress={() =>
                      updateDraft((prev) => ({ ...prev, activeGymId: gym.id }))
                    }
                    onLongPress={() => openGymModal(gym)}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? `${colors.primary}20` : colors.surface,
                      minWidth: 150,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                      }}
                      numberOfLines={1}
                    >
                      {gym.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                      {formatGymType(gym.type)}
                    </Text>
                    {isActive ? (
                      <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name='checkmark-circle' size={14} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontSize: 12 }}>Active</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => openGymModal()}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.surface : colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 130,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Ionicons name='add' size={18} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 12 }}>
                  Add gym
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          {activeGym ? (
            <View
              style={{
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: `${colors.primary}20`,
                    borderWidth: 1,
                    borderColor: `${colors.primary}30`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name='barbell-outline' size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                    {activeGym.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {formatGymType(activeGym.type)} | {activeGym.equipment.length} selections
                  </Text>
                </View>
                <Pressable
                  onPress={() => openGymModal(activeGym)}
                  style={({ pressed }) => ({
                    padding: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.surface : colors.surfaceMuted,
                  })}
                >
                  <Ionicons name='pencil' size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {activeGym ? (
          <View style={{ gap: 12 }}>
            <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
              Equipment selection
            </Text>
            <EquipmentSelector
              selectedEquipment={activeGym.bodyweightOnly ? [] : activeGym.equipment}
              bodyweightOnly={activeGym.bodyweightOnly}
              onSelectionChange={(next) =>
                updateActiveGym({ equipment: next, bodyweightOnly: false })
              }
              onBodyweightOnlyChange={(value) =>
                updateActiveGym({
                  bodyweightOnly: value,
                  equipment: value ? [] : activeGym.equipment,
                })
              }
              onApplyPreset={handlePreset}
            />
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
            Warm-up sets
          </Text>
          <View
            style={{
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: `${colors.secondary}20`,
                  borderWidth: 1,
                  borderColor: `${colors.secondary}30`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name='flame-outline' size={18} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                  Auto-generate warm-up sets
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Based on your first working set weight.
                </Text>
              </View>
              <Switch
                value={draft.warmupSets.enabled}
                onValueChange={(value) =>
                  updateDraft((prev) => ({
                    ...prev,
                    warmupSets: {
                      ...prev.warmupSets,
                      enabled: value,
                      numSets: value ? Math.max(1, prev.warmupSets.numSets) : prev.warmupSets.numSets,
                    },
                  }))
                }
                trackColor={{ false: colors.border, true: 'rgba(56,189,248,0.35)' }}
                thumbColor={draft.warmupSets.enabled ? colors.secondary : '#6B7280'}
              />
            </View>

            {draft.warmupSets.enabled ? (
              <View style={{ gap: 10 }}>
                {renderStepper({
                  label: 'Warm-up sets',
                  value: draft.warmupSets.numSets,
                  min: 1,
                  max: 4,
                  step: 1,
                  onChange: (next) =>
                    updateDraft((prev) => ({
                      ...prev,
                      warmupSets: { ...prev.warmupSets, numSets: next },
                    })),
                })}
                {renderStepper({
                  label: 'Start percentage',
                  value: draft.warmupSets.startPercentage,
                  min: 30,
                  max: 70,
                  step: 5,
                  suffix: '%',
                  onChange: (next) =>
                    updateDraft((prev) => ({
                      ...prev,
                      warmupSets: { ...prev.warmupSets, startPercentage: next },
                    })),
                })}
                {renderStepper({
                  label: 'Increment per set',
                  value: draft.warmupSets.incrementPercentage,
                  min: 5,
                  max: 25,
                  step: 5,
                  suffix: '%',
                  onChange: (next) =>
                    updateDraft((prev) => ({
                      ...prev,
                      warmupSets: { ...prev.warmupSets, incrementPercentage: next },
                    })),
                })}
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Example: {warmupPreview.length > 0 ? warmupPreview.map((set) => `${Math.round(set.targetWeight)}x${set.targetReps}`).join(' | ') : 'Set a working weight to preview.'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
            Cardio recommendations
          </Text>
          <CardioSettings
            cardio={draft.cardio}
            onChange={(next) =>
              updateDraft((prev) => ({
                ...prev,
                cardio: next,
              }))
            }
          />
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
            Target session length
          </Text>
          <View
            style={{
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              gap: 12,
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              AI will scale volume and rest to fit this window.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {SESSION_DURATIONS.map((duration) => {
                const isActive = draft.sessionDuration === duration;
                return (
                  <Pressable
                    key={duration}
                    onPress={() =>
                      updateDraft((prev) => ({ ...prev, sessionDuration: duration }))
                    }
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? `${colors.primary}20` : colors.surfaceMuted,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: isActive ? colors.primary : colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                      }}
                    >
                      {duration} min
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      <Modal visible={gymModalVisible} transparent animationType='fade'>
        <Pressable
          onPress={closeGymModal}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: 24,
            justifyContent: 'center',
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 14,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.bold, fontSize: 18 }}>
              {editingGymId ? 'Edit gym' : 'Add a gym'}
            </Text>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Gym name</Text>
              <TextInput
                value={gymNameDraft}
                onChangeText={setGymNameDraft}
                placeholder='e.g. Downtown Fitness'
                placeholderTextColor={colors.textSecondary}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.medium,
                  backgroundColor: colors.surfaceMuted,
                }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Gym type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(['home', 'commercial', 'custom'] as const).map((type) => {
                  const isActive = gymTypeDraft === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setGymTypeDraft(type)}
                      style={({ pressed }) => ({
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: isActive ? colors.primary : colors.border,
                        backgroundColor: isActive ? `${colors.primary}20` : colors.surfaceMuted,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: isActive ? colors.primary : colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        {formatGymType(type)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={closeGymModal}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                })}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveGym}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: '#0B1220', fontFamily: fontFamilies.semibold }}>
                  Save gym
                </Text>
              </Pressable>
            </View>

            {editingGymId && draft.gyms.length > 1 ? (
              <Pressable
                onPress={handleDeleteGym}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                })}
              >
                <Text style={{ color: colors.error, fontFamily: fontFamilies.semibold }}>
                  Remove gym
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
};

export default GymPreferencesScreen;
