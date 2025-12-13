import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  Share,
  Switch,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import {
  createTemplateShare,
  fetchTemplateShareStats,
  revokeTemplateShare,
  updateTemplate,
} from '../../api/templates';
import { templatesKey } from '../../hooks/useWorkoutTemplates';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

type ShareTemplateLinkSheetProps = {
  visible: boolean;
  onClose: () => void;
  templateId: string;
  templateName: string;
  sharingDisabled?: boolean;
};

const ShareTemplateLinkSheet = ({
  visible,
  onClose,
  templateId,
  templateName,
  sharingDisabled,
}: ShareTemplateLinkSheetProps) => {
  const queryClient = useQueryClient();
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareWebUrl, setShareWebUrl] = useState<string | null>(null);
  const [localSharingDisabled, setLocalSharingDisabled] = useState(Boolean(sharingDisabled));

  useEffect(() => {
    setLocalSharingDisabled(Boolean(sharingDisabled));
  }, [sharingDisabled]);

  useEffect(() => {
    setShareCode(null);
    setShareWebUrl(null);
  }, [templateId]);

  const shareLinkMutation = useMutation({
    mutationFn: () => createTemplateShare(templateId),
    onSuccess: (data) => {
      setShareCode(data.shareCode);
      setShareWebUrl(data.webUrl);
    },
  });

  const statsQuery = useQuery({
    queryKey: [...templatesKey, templateId, 'share-stats'],
    queryFn: () => fetchTemplateShareStats(templateId),
    enabled: visible && (Boolean(shareCode) || Boolean(shareWebUrl)),
    retry: 1,
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeTemplateShare(templateId),
    onSuccess: () => {
      setShareCode(null);
      setShareWebUrl(null);
      queryClient.invalidateQueries({ queryKey: templatesKey });
      queryClient.invalidateQueries({ queryKey: [...templatesKey, templateId] });
    },
  });

  const updateSharingMutation = useMutation({
    mutationFn: (nextDisabled: boolean) => updateTemplate(templateId, { sharingDisabled: nextDisabled }),
  });

  useEffect(() => {
    if (!visible) return;
    if (localSharingDisabled) return;
    if (shareLinkMutation.isPending) return;
    if (shareCode || shareWebUrl) return;
    shareLinkMutation.mutate();
  }, [localSharingDisabled, shareCode, shareLinkMutation, shareWebUrl, visible]);

  const currentLink = useMemo(() => {
    const stats = statsQuery.data;
    if (stats?.shareCode) return stats.webUrl;
    if (shareWebUrl) return shareWebUrl;
    if (shareCode) return `https://push-pull.app/workout/${shareCode}`;
    return null;
  }, [shareCode, shareWebUrl, statsQuery.data]);

  const isWorking =
    shareLinkMutation.isPending ||
    revokeMutation.isPending ||
    updateSharingMutation.isPending;

  const copyText = async (value: string, success: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied', success);
  };

  const copyWebLink = async () => {
    if (!currentLink) return;
    await copyText(currentLink, 'Share link copied to clipboard.');
  };

  const share = async () => {
    const web = currentLink;
    if (!web) return;
    const message = `${templateName}\n\n${web}\n\n(If you have Push/Pull installed, this should open in the app.)`;
    try {
      await Share.share({ message });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Share failed';
      Alert.alert('Couldn’t share', message);
    }
  };

  const confirmRevoke = () => {
    Alert.alert(
      'Revoke this link?',
      'Anyone with the old link will no longer be able to view or copy this template.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => revokeMutation.mutate() },
      ]
    );
  };

  const toggleSharingDisabled = (nextDisabled: boolean) => {
    if (nextDisabled) {
      Alert.alert(
        'Disable sharing?',
        'This will revoke any active share link for this template.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => {
              updateSharingMutation.mutate(true, {
                onSuccess: () => {
                  setLocalSharingDisabled(true);
                  revokeMutation.mutate();
                  queryClient.invalidateQueries({ queryKey: templatesKey });
                  queryClient.invalidateQueries({ queryKey: [...templatesKey, templateId] });
                },
              });
            },
          },
        ]
      );
      return;
    }

    updateSharingMutation.mutate(false, {
      onSuccess: () => {
        setLocalSharingDisabled(false);
        queryClient.invalidateQueries({ queryKey: templatesKey });
        queryClient.invalidateQueries({ queryKey: [...templatesKey, templateId] });
      },
    });
  };

  const row = (
    label: string,
    value: string,
    icon: keyof typeof Ionicons.glyphMap,
    onPress?: () => void,
    destructive?: boolean
  ) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: destructive ? `${colors.error ?? '#ef4444'}22` : `${colors.primary}18`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={icon}
            size={18}
            color={destructive ? colors.error ?? '#ef4444' : colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 14 }}>
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textSecondary,
              fontFamily: fontFamilies.regular,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {value}
          </Text>
        </View>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} /> : null}
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.bold, fontSize: 18 }}>
              Share template
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                padding: 8,
                borderRadius: 999,
                backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
              })}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.regular, lineHeight: 18 }}>
            {localSharingDisabled
              ? 'Sharing is currently disabled for this template. Turn it on to generate a link.'
              : 'Share one link—if the app is installed, it opens in Push/Pull; otherwise it opens a preview on the web.'}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 14,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 14 }}>
                Sharing enabled
              </Text>
              <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.regular, fontSize: 12, marginTop: 2 }}>
                Turn off anytime to revoke the link.
              </Text>
            </View>
            <Switch
              value={!localSharingDisabled}
              onValueChange={(value) => toggleSharingDisabled(!value)}
              thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
              trackColor={{ false: colors.border, true: `${colors.primary}80` }}
              disabled={isWorking}
            />
          </View>

          {shareLinkMutation.isPending && !currentLink ? (
            <View style={{ paddingVertical: 18, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.medium }}>
                Creating link…
              </Text>
            </View>
          ) : currentLink ? (
            <>
              {row('Share link', currentLink, 'link-outline', copyWebLink)}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={share}
                  disabled={isWorking}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: colors.primary,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: 'center',
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: '#0B1220', fontFamily: fontFamilies.semibold, fontSize: 14 }}>
                    Share
                  </Text>
                </Pressable>
                <Pressable
                  onPress={copyWebLink}
                  disabled={isWorking}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: 'center',
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 14 }}>
                    Copy
                  </Text>
                </Pressable>
              </View>

              <View style={{ gap: 10 }}>
                <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.medium }}>
                  Performance
                </Text>
                {statsQuery.isLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.regular }}>
                      Loading stats…
                    </Text>
                  </View>
                ) : statsQuery.data ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {(['viewsCount', 'copiesCount', 'signupsCount'] as const).map((key) => {
                      const labels: Record<typeof key, string> = {
                        viewsCount: 'Views',
                        copiesCount: 'Copies',
                        signupsCount: 'Signups',
                      };
                      const value =
                        key === 'viewsCount'
                          ? statsQuery.data.stats.viewsCount
                          : key === 'copiesCount'
                          ? statsQuery.data.stats.copiesCount
                          : statsQuery.data.stats.signupsCount;
                      return (
                        <View
                          key={key}
                          style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 14,
                            backgroundColor: colors.surfaceMuted,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.medium, fontSize: 12 }}>
                            {labels[key]}
                          </Text>
                          <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.bold, fontSize: 18, marginTop: 4 }}>
                            {value}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.regular }}>
                    Stats unavailable right now.
                  </Text>
                )}
              </View>

              <Pressable
                onPress={confirmRevoke}
                disabled={isWorking}
                style={({ pressed }) => ({
                  marginTop: 4,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: `${colors.error ?? '#ef4444'}55`,
                  backgroundColor: `${colors.error ?? '#ef4444'}14`,
                  alignItems: 'center',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: colors.error ?? '#ef4444', fontFamily: fontFamilies.semibold }}>
                  Revoke link
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.regular }}>
              {localSharingDisabled ? 'Sharing is disabled for this template.' : 'A link couldn’t be created right now.'}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default ShareTemplateLinkSheet;
