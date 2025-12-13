import { useState } from 'react';
import { Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import ShareTemplateLinkSheet from './ShareTemplateLinkSheet';
import { colors } from '../../theme/colors';

type ShareTemplateButtonProps = {
  templateId: string;
  templateName: string;
  sharingDisabled?: boolean;
};

const ShareTemplateButton = ({
  templateId,
  templateName,
  sharingDisabled,
}: ShareTemplateButtonProps) => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={({ pressed }) => ({
          padding: 6,
          borderRadius: 999,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        })}
        accessibilityRole="button"
        accessibilityLabel="Share workout template"
      >
        <Ionicons name="share-social-outline" size={20} color={colors.textSecondary} />
      </Pressable>

      <ShareTemplateLinkSheet
        visible={visible}
        onClose={() => setVisible(false)}
        templateId={templateId}
        templateName={templateName}
        sharingDisabled={sharingDisabled}
      />
    </>
  );
};

export default ShareTemplateButton;

