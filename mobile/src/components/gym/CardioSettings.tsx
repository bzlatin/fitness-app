import { Pressable, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import { CardioPreferences } from '../../types/gym';

type CardioSettingsProps = {
  cardio: CardioPreferences;
  onChange: (next: CardioPreferences) => void;
};

const TIMING_OPTIONS: Array<{ value: CardioPreferences['timing']; label: string }> = [
  { value: 'before', label: 'Before weights' },
  { value: 'after', label: 'After weights' },
  { value: 'separate', label: 'Separate session' },
];

const TYPE_OPTIONS: Array<{ value: CardioPreferences['type']; label: string }> = [
  { value: 'liss', label: 'LISS' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'mixed', label: 'Mixed' },
];

const DURATION_OPTIONS = [10, 15, 20, 30];

const CardioSettings = ({ cardio, onChange }: CardioSettingsProps) => {
  const update = (updates: Partial<CardioPreferences>) =>
    onChange({ ...cardio, ...updates });

  const renderOptionGroup = <T extends string | number>(
    title: string,
    options: Array<{ value: T; label: string }>,
    selected: T,
    onSelect: (value: T) => void
  ) => (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => {
          const isActive = option.value === selected;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onSelect(option.value)}
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
                  fontSize: 13,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
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
              backgroundColor: `${colors.primary}18`,
              borderWidth: 1,
              borderColor: `${colors.primary}30`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name='heart-outline' size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
              Include cardio recommendations
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              Add cardio guidance to your AI workouts and sessions.
            </Text>
          </View>
          <Switch
            value={cardio.enabled}
            onValueChange={(value) => update({ enabled: value })}
            trackColor={{ false: colors.border, true: 'rgba(34,197,94,0.35)' }}
            thumbColor={cardio.enabled ? colors.primary : '#6B7280'}
          />
        </View>

        {cardio.enabled ? (
          <View style={{ gap: 14 }}>
            {renderOptionGroup(
              'Timing',
              TIMING_OPTIONS,
              cardio.timing,
              (value) => update({ timing: value })
            )}
            {renderOptionGroup(
              'Cardio type',
              TYPE_OPTIONS,
              cardio.type,
              (value) => update({ type: value })
            )}
            {renderOptionGroup(
              'Target duration',
              DURATION_OPTIONS.map((value) => ({ value, label: `${value} min` })),
              cardio.duration,
              (value) => update({ duration: value })
            )}

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Weekly frequency
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Pressable
                  onPress={() =>
                    update({ frequency: Math.max(0, cardio.frequency - 1) })
                  }
                  style={({ pressed }) => ({
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pressed ? colors.surface : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                  })}
                >
                  <Ionicons name='remove' size={16} color={colors.textSecondary} />
                </Pressable>
                <View style={{ alignItems: 'center' }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.bold,
                      fontSize: 18,
                    }}
                  >
                    {cardio.frequency}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    days/week
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    update({ frequency: Math.min(7, cardio.frequency + 1) })
                  }
                  style={({ pressed }) => ({
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pressed ? colors.surface : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                  })}
                >
                  <Ionicons name='add' size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default CardioSettings;
