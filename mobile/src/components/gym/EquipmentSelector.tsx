import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../theme/colors';
import { fontFamilies, typography } from '../../theme/typography';
import { EQUIPMENT_CATEGORIES, EquipmentCategory } from '../../constants/gymEquipment';

const DEFAULT_VISIBLE_ITEMS = 3;

const PRESET_HELPERS = {
  home: 'Dumbbells, a bench, bands, and a few key basics.',
  commercial: 'Full access to racks, machines, cables, and cardio zones.',
};

type EquipmentSelectorProps = {
  selectedEquipment: string[];
  bodyweightOnly: boolean;
  onSelectionChange: (next: string[]) => void;
  onBodyweightOnlyChange: (next: boolean) => void;
  onApplyPreset?: (preset: 'home' | 'commercial') => void;
  showPresets?: boolean;
  showBodyweightToggle?: boolean;
};

const EquipmentSelector = ({
  selectedEquipment,
  bodyweightOnly,
  onSelectionChange,
  onBodyweightOnlyChange,
  onApplyPreset,
  showPresets = true,
  showBodyweightToggle = true,
}: EquipmentSelectorProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleEquipment = (id: string) => {
    const isSelected = selectedEquipment.includes(id);
    const next = isSelected
      ? selectedEquipment.filter((item) => item !== id)
      : [...selectedEquipment, id];
    if (bodyweightOnly && next.length > 0) {
      onBodyweightOnlyChange(false);
    }
    onSelectionChange(next);
  };

  const handleBodyweightToggle = (value: boolean) => {
    onBodyweightOnlyChange(value);
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderCategory = (category: EquipmentCategory) => (
    <View
      key={category.id}
      style={{
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        gap: 10,
      }}
    >
      {(() => {
        const isExpanded = expandedCategories[category.id] ?? false;
        const canExpand = category.items.length > DEFAULT_VISIBLE_ITEMS;
        const visibleItems = isExpanded
          ? category.items
          : category.items.slice(0, DEFAULT_VISIBLE_ITEMS);
        const hiddenCount = Math.max(0, category.items.length - visibleItems.length);
        const optionLabel = canExpand && !isExpanded
          ? `Showing ${DEFAULT_VISIBLE_ITEMS} of ${category.items.length} options`
          : `${category.items.length} options`;

        return (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.title, color: colors.textPrimary }}>
                  {category.title}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  {optionLabel}
                </Text>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              {visibleItems.map((item) => {
                const isSelected = selectedEquipment.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleEquipment(item.id)}
                    disabled={bodyweightOnly}
                    style={({ pressed }) => ({
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected
                        ? `${colors.primary}18`
                        : colors.surfaceMuted,
                      opacity: bodyweightOnly ? 0.4 : pressed ? 0.85 : 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    })}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.primary : colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                      }}
                    >
                      {isSelected ? (
                        <Ionicons name='checkmark' size={14} color={colors.surface} />
                      ) : null}
                    </View>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {canExpand ? (
              <Pressable
                onPress={() => toggleCategory(category.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.surfaceMuted : `${colors.primary}12`,
                })}
                accessibilityRole='button'
              >
                <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                  {isExpanded
                    ? 'Show less'
                    : `Show ${hiddenCount} more`}
                </Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textPrimary}
                />
              </Pressable>
            ) : null}
          </>
        );
      })()}
    </View>
  );

  return (
    <View style={{ gap: 16 }}>
      {showBodyweightToggle || showPresets ? (
        <View
          style={{
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            gap: 12,
          }}
        >
          {showBodyweightToggle ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: `${colors.secondary}20`,
                  borderWidth: 1,
                  borderColor: `${colors.secondary}40`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name='walk-outline' size={18} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                  Bodyweight only
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Turn on to hide all equipment and focus on calisthenics.
                </Text>
              </View>
              <Switch
                value={bodyweightOnly}
                onValueChange={handleBodyweightToggle}
                trackColor={{ false: colors.border, true: 'rgba(34,197,94,0.35)' }}
                thumbColor={bodyweightOnly ? colors.primary : '#6B7280'}
              />
            </View>
          ) : null}

          {showPresets ? (
            <View style={{ gap: 8 }}>
              {(['home', 'commercial'] as const).map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => onApplyPreset?.(preset)}
                  style={({ pressed }) => ({
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.surface : colors.surfaceMuted,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  })}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: `${colors.primary}18`,
                      borderWidth: 1,
                      borderColor: `${colors.primary}30`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name={preset === 'home' ? 'home-outline' : 'business-outline'}
                      size={14}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                      }}
                    >
                      {preset === 'home' ? 'Home Gym' : 'Commercial Gym'}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      {PRESET_HELPERS[preset]}
                    </Text>
                  </View>
                  <Ionicons name='flash' size={16} color={colors.secondary} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {EQUIPMENT_CATEGORIES.map(renderCategory)}
    </View>
  );
};

export default EquipmentSelector;
