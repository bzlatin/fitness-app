import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import ScreenContainer from '../components/layout/ScreenContainer';
import ExerciseRow from '../components/workouts/ExerciseRow';
import MuscleGroupBreakdown from '../components/MuscleGroupBreakdown';
import { copySharedTemplate, fetchSharedTemplatePreview } from '../api/templates';
import { templatesKey } from '../hooks/useWorkoutTemplates';
import { useAuth } from '../context/AuthContext';
import { RootRoute, RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fontFamilies } from '../theme/typography';
import { formatHandle } from '../utils/formatHandle';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TemplateHeader = ({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
}) => {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: `${colors.primary}18`,
            borderWidth: 1,
            borderColor: `${colors.primary}35`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="barbell" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.bold, fontSize: 20 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.regular }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onClose ? (
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              padding: 8,
              borderRadius: 999,
              backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
            })}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const TemplatePreviewBody = ({
  code,
  onDismiss,
  onCopiedToLibrary,
}: {
  code: string;
  onDismiss?: () => void;
  onCopiedToLibrary?: (templateId: string) => void;
}) => {
  const { isAuthenticated, login } = useAuth();
  const queryClient = useQueryClient();

  const previewQuery = useQuery({
    queryKey: ['template-share-preview', code],
    queryFn: () => fetchSharedTemplatePreview(code),
    retry: 1,
  });

  const creatorLabel = useMemo(() => {
    const creator = previewQuery.data?.creator;
    const handle = formatHandle(creator?.handle);
    if (handle) return `Created by ${handle}`;
    if (creator?.name) return `Created by ${creator.name}`;
    return 'Created by a Push / Pull lifter';
  }, [previewQuery.data?.creator]);

  const copyMutation = useMutation({
    mutationFn: () => copySharedTemplate(code),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: templatesKey });
      onCopiedToLibrary?.(data.template.id);
      Alert.alert(
        data.wasAlreadyCopied ? 'Already added' : 'Added to your workouts',
        data.wasAlreadyCopied
          ? 'You already have a copy of this template.'
          : 'You now have your own copy in My Workouts.'
      );
    },
  });

  if (previewQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.medium }}>
          Loading shared workout…
        </Text>
      </View>
    );
  }

  if (previewQuery.isError || !previewQuery.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center', gap: 14 }}>
        <TemplateHeader
          title="Link unavailable"
          subtitle="This share link may have expired or been revoked."
          onClose={onDismiss}
        />
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => ({
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: 'center',
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const { template, stats } = previewQuery.data;

  return (
    <ScreenContainer scroll includeTopInset paddingTop={16}>
      <View style={{ gap: 14 }}>
        <TemplateHeader title={template.name} subtitle={creatorLabel} onClose={onDismiss} />

        <View
          style={{
            padding: 14,
            borderRadius: 16,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
              Workout overview
            </Text>
            <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.medium, fontSize: 12 }}>
              {stats.viewsCount} views · {stats.copiesCount} adds
            </Text>
          </View>

          {template.description ? (
            <Text style={{ marginTop: 10, color: colors.textSecondary, fontFamily: fontFamilies.regular, lineHeight: 18 }}>
              {template.description}
            </Text>
          ) : null}

          <View style={{ marginTop: 12 }}>
            <MuscleGroupBreakdown template={template} variant="detailed" />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.bold, fontSize: 16 }}>
            Exercises
          </Text>
          {template.exercises.map((exercise) => (
            <ExerciseRow key={exercise.id} item={exercise} />
          ))}
        </View>

        <View style={{ marginTop: 6, gap: 10 }}>
          {isAuthenticated ? (
            <Pressable
              onPress={() => copyMutation.mutate()}
              disabled={copyMutation.isPending}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: '#0B1220', fontFamily: fontFamilies.bold }}>
                {copyMutation.isPending ? 'Adding…' : 'Add to My Workouts'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={login}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: '#0B1220', fontFamily: fontFamilies.bold }}>
                Sign in to add to My Workouts
              </Text>
            </Pressable>
          )}

          <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 16 }}>
            Adding creates your own copy so you can edit it without affecting the original.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
};

const WorkoutTemplatePreviewScreen = () => {
  const route = useRoute<RootRoute<'WorkoutTemplatePreview'>>();
  const navigation = useNavigation<Nav>();
  const { isAuthenticated } = useAuth();

  const code = String(route.params.code ?? '').toLowerCase().trim();

  return (
    <TemplatePreviewBody
      code={code}
      onCopiedToLibrary={(templateId) => {
        if (!isAuthenticated) return;
        navigation.navigate('WorkoutTemplateDetail', { templateId });
      }}
    />
  );
};

export const WorkoutTemplatePreviewContent = ({
  code,
  onDismiss,
}: {
  code: string;
  onDismiss: () => void;
}) => {
  const normalized = code.toLowerCase().trim();
  return <TemplatePreviewBody code={normalized} onDismiss={onDismiss} />;
};

export default WorkoutTemplatePreviewScreen;
