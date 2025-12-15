import { useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../theme/colors';

type TimerAdjustmentModalProps = {
  visible: boolean;
  onClose: () => void;
  currentSeconds: number;
  onSave: (seconds: number) => void;
  exerciseName: string;
};

const TimerAdjustmentModal = ({
  visible,
  onClose,
  currentSeconds,
  onSave,
  exerciseName,
}: TimerAdjustmentModalProps) => {
  const initialMinutes = Math.floor(currentSeconds / 60);
  const initialSecs = currentSeconds % 60;

  const [minutes, setMinutes] = useState(initialMinutes);
  const [seconds, setSeconds] = useState(initialSecs);

  const handleSave = () => {
    const totalSeconds = minutes * 60 + seconds;
    onSave(totalSeconds);
    onClose();
  };

  // Quick preset handlers
  const applyPreset = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    setMinutes(mins);
    setSeconds(secs);
  };

  // Generate options for minutes (0-10) and seconds (0-59 in 15s increments)
  const minuteOptions = Array.from({ length: 11 }, (_, i) => i);
  const secondOptions = [0, 15, 30, 45];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: 40,
            gap: 16,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 20,
                fontWeight: '700',
              }}
            >
              Adjust Rest Timer
            </Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" color={colors.textSecondary} size={24} />
            </Pressable>
          </View>

          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            {exerciseName}
          </Text>

          {/* Quick Presets */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
              QUICK PRESETS
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => applyPreset(45)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="flame-outline" size={20} color={colors.secondary} />
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
                  Warm-up
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  0:45
                </Text>
              </Pressable>

              <Pressable
                onPress={() => applyPreset(90)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="barbell-outline" size={20} color={colors.primary} />
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
                  Working
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  1:30
                </Text>
              </Pressable>

              <Pressable
                onPress={() => applyPreset(180)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="fitness-outline" size={20} color="#F97316" />
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
                  Heavy
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  3:00
                </Text>
              </Pressable>

              <Pressable
                onPress={() => applyPreset(300)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 8,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="body-outline" size={20} color="#A78BFA" />
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
                  Stretch
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  5:00
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Picker Container */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              paddingVertical: 20,
            }}
          >
            {/* Minutes Picker */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                Minutes
              </Text>
              <Picker
                selectedValue={minutes}
                onValueChange={(value) => setMinutes(value)}
                style={{
                  width: 120,
                  height: 150,
                }}
                itemStyle={{
                  color: colors.textPrimary,
                  fontSize: 24,
                  height: 150,
                }}
              >
                {minuteOptions.map((min) => (
                  <Picker.Item
                    key={min}
                    label={`${min}`}
                    value={min}
                  />
                ))}
              </Picker>
            </View>

            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 32,
                fontWeight: '700',
                marginTop: 24,
              }}
            >
              :
            </Text>

            {/* Seconds Picker */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                Seconds
              </Text>
              <Picker
                selectedValue={seconds}
                onValueChange={(value) => setSeconds(value)}
                style={{
                  width: 120,
                  height: 150,
                }}
                itemStyle={{
                  color: colors.textPrimary,
                  fontSize: 24,
                  height: 150,
                }}
              >
                {secondOptions.map((sec) => (
                  <Picker.Item
                    key={sec}
                    label={sec.toString().padStart(2, '0')}
                    value={sec}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text
                style={{
                  color: '#0B1220',
                  fontWeight: '700',
                  fontSize: 16,
                }}
              >
                Save
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default TimerAdjustmentModal;
