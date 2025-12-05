import * as FileSystem from "expo-file-system";
import { ImagePickerAsset } from "expo-image-picker";

const isShareableUri = (uri?: string) =>
  Boolean(
    uri &&
      (uri.startsWith("http://") ||
        uri.startsWith("https://") ||
        uri.startsWith("data:"))
  );

const dataUriFromBase64 = (base64: string, mimeType = "image/jpeg") =>
  `data:${mimeType};base64,${base64}`;

const readFileAsDataUri = async (uri: string, mimeType: string) => {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return undefined;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return dataUriFromBase64(base64, mimeType);
  } catch (err) {
    console.warn("Failed to read avatar file", err);
    return undefined;
  }
};

export const processAvatarAsset = async (asset: ImagePickerAsset) => {
  const mimeType =
    (asset as { mimeType?: string }).mimeType ??
    (asset.type === "image" ? "image/jpeg" : "application/octet-stream");

  if (asset.base64) {
    return dataUriFromBase64(asset.base64, mimeType);
  }

  if (isShareableUri(asset.uri)) return asset.uri;

  return readFileAsDataUri(asset.uri, mimeType);
};

export const ensureShareableAvatarUri = async (uri?: string | null) => {
  if (!uri) return undefined;
  if (isShareableUri(uri)) return uri;
  return readFileAsDataUri(uri, "image/jpeg");
};
