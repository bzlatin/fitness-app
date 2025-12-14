import { ImagePickerAsset } from "expo-image-picker";

export const isRemoteAvatarUrl = (uri?: string | null) =>
  Boolean(uri && (uri.startsWith("http://") || uri.startsWith("https://")));

export const processAvatarAsset = async (asset: ImagePickerAsset) => {
  // Keep this lightweight: return the local asset URI for preview and upload via multipart later.
  return asset.uri;
};

export const ensureShareableAvatarUri = async (uri?: string | null) => {
  // Backwards-compatible: callers should prefer uploading via `/social/me/avatar`.
  if (!uri) return undefined;
  return isRemoteAvatarUrl(uri) ? uri : undefined;
};
