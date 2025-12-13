import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCustomExercises } from "../api/exercises";
import CreateCustomExerciseModal from "../components/workouts/CreateCustomExerciseModal";
import EditCustomExerciseModal from "../components/workouts/EditCustomExerciseModal";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { CustomExercise, Exercise } from "../types/workouts";

const MyCustomExercisesScreen = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<CustomExercise | null>(null);

  const {
    data: customExercises = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["custom-exercises"],
    queryFn: getCustomExercises,
  });

  // Filter exercises by search query
  const filteredExercises = customExercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExerciseCreated = (exercise: Exercise) => {
    refetch();
  };

  const handleExerciseUpdated = () => {
    refetch();
  };

  const handleExerciseDeleted = () => {
    refetch();
    setEditingExercise(null);
  };

  const renderExercise = ({ item }: { item: CustomExercise }) => (
    <Pressable
      onPress={() => setEditingExercise(item)}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        {/* Exercise Image */}
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={{
              width: 80,
              height: 80,
              borderRadius: 8,
              backgroundColor: colors.surfaceMuted,
            }}
          />
        ) : (
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 8,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="barbell-outline" size={32} color={colors.textSecondary} />
          </View>
        )}

        {/* Exercise Details */}
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                ...typography.body,
                fontFamily: fontFamilies.semibold,
                color: colors.textPrimary,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                backgroundColor: "rgba(34,197,94,0.12)",
                borderRadius: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: colors.primary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                CUSTOM
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Primary Muscle Group */}
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: colors.surfaceMuted,
                borderRadius: 6,
              }}
            >
              <Text
                style={{
                  ...typography.caption,
                  color: colors.textPrimary,
                  textTransform: "capitalize",
                }}
              >
                {item.primaryMuscleGroup}
              </Text>
            </View>

            {/* Equipment */}
            {item.equipment && (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                    textTransform: "capitalize",
                  }}
                >
                  {item.equipment}
                </Text>
              </View>
            )}
          </View>

          {/* Notes Preview */}
          {item.notes && (
            <Text
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                marginTop: 2,
              }}
              numberOfLines={2}
            >
              {item.notes}
            </Text>
          )}
        </View>

        {/* Edit Icon */}
        <View style={{ justifyContent: "center" }}>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </View>
      </View>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 48 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Ionicons name="barbell-outline" size={40} color={colors.textSecondary} />
      </View>
      <Text
        style={{
          ...typography.heading3,
          color: colors.textPrimary,
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        {searchQuery ? "No exercises found" : "No custom exercises yet"}
      </Text>
      <Text
        style={{
          ...typography.body,
          color: colors.textSecondary,
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        {searchQuery
          ? "Try a different search term"
          : "Create custom exercises for movements not in our library"}
      </Text>
      {!searchQuery && (
        <Pressable
          onPress={() => setShowCreateModal(true)}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: fontFamilies.semibold,
              color: colors.surface,
              fontSize: 16,
            }}
          >
            Create First Exercise
          </Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
            My Custom Exercises
          </Text>
          <Pressable
            onPress={() => setShowCreateModal(true)}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Ionicons name="add" size={20} color={colors.surface} />
            <Text
              style={{
                fontFamily: fontFamilies.semibold,
                color: colors.surface,
                fontSize: 14,
              }}
            >
              New
            </Text>
          </Pressable>
        </View>

        {/* Search Bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surfaceMuted,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 8,
          }}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            placeholder="Search custom exercises..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              color: colors.textPrimary,
              fontFamily: fontFamilies.regular,
              fontSize: 16,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Exercise List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExercise}
          contentContainerStyle={{
            padding: 16,
            flexGrow: 1,
          }}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create Exercise Modal */}
      <CreateCustomExerciseModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleExerciseCreated}
      />

      {/* Edit Exercise Modal */}
      {editingExercise && (
        <EditCustomExerciseModal
          visible={!!editingExercise}
          onClose={() => setEditingExercise(null)}
          onUpdated={handleExerciseUpdated}
          onDeleted={handleExerciseDeleted}
          exercise={editingExercise}
        />
      )}
    </SafeAreaView>
  );
};

export default MyCustomExercisesScreen;
