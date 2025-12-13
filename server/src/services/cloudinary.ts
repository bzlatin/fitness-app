import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import streamifier from "streamifier";

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

let isConfigured = false;
const ENABLE_MODERATION = process.env.CLOUDINARY_ENABLE_MODERATION === "true";

const isModerationSubscriptionError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const anyErr = error as { http_code?: unknown; message?: unknown };
  const httpCode = typeof anyErr.http_code === "number" ? anyErr.http_code : null;
  const message = typeof anyErr.message === "string" ? anyErr.message.toLowerCase() : "";
  return httpCode === 420 && message.includes("moderation") && message.includes("subscription");
};

/**
 * Configure Cloudinary on first use
 */
const ensureConfigured = () => {
  if (isConfigured) return true;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn(
      "[Cloudinary] Missing credentials. Image uploads will be disabled. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env"
    );
    return false;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  isConfigured = true;
  return true;
};

/**
 * Upload image buffer to Cloudinary
 * @param buffer - Image file buffer
 * @param folder - Cloudinary folder (e.g., "custom-exercises")
 * @param publicId - Optional custom public ID
 * @returns Cloudinary upload response with secure URL
 */
export const uploadImage = (
  buffer: Buffer,
  folder: string = "custom-exercises",
  publicId?: string
): Promise<UploadApiResponse> => {
  if (!ensureConfigured()) {
    throw new Error("Cloudinary is not configured. Image uploads are disabled.");
  }

  const doUpload = (options: { moderation?: string }) =>
    new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: "image",
          // Image transformations
          transformation: [
            { width: 800, height: 800, crop: "limit" }, // Max 800x800px
            { quality: "auto:good" }, // Automatic quality optimization
            { fetch_format: "auto" }, // Automatic format (WebP on supported browsers)
          ],
          ...(options.moderation ? { moderation: options.moderation } : {}),
          eager: [{ width: 400, height: 400, crop: "fill" }], // Thumbnail
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("Upload failed: No result returned"));
          resolve(result);
        }
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });

  const moderation = ENABLE_MODERATION ? "aws_rek" : undefined;

  return doUpload({ moderation }).catch((error) => {
    if (moderation && isModerationSubscriptionError(error)) {
      console.warn(
        "[Cloudinary] Moderation upload failed (subscription missing). Retrying without moderation."
      );
      return doUpload({ moderation: undefined });
    }
    throw error;
  });
};

/**
 * Delete image from Cloudinary
 * @param publicId - The public ID of the image to delete
 */
export const deleteImage = async (publicId: string): Promise<void> => {
  if (!ensureConfigured()) {
    console.warn("[Cloudinary] Skipping image deletion (not configured)");
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("[Cloudinary] Failed to delete image:", error);
    throw error;
  }
};

/**
 * Extract public ID from Cloudinary URL
 * Example: https://res.cloudinary.com/demo/image/upload/v123/custom-exercises/abc.jpg
 * Returns: custom-exercises/abc
 */
export const extractPublicId = (url: string): string | null => {
  try {
    const match = url.match(/\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp)$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

/**
 * Validate image buffer
 * @param buffer - Image file buffer
 * @param maxSizeBytes - Maximum file size (default: 5MB for free tier, 10MB for Pro)
 */
export const validateImageBuffer = (
  buffer: Buffer,
  maxSizeBytes: number = 5 * 1024 * 1024
): { valid: boolean; error?: string } => {
  // Check file size
  if (buffer.length > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${Math.round(maxSizeBytes / 1024 / 1024)}MB limit`,
    };
  }

  // Check magic bytes for common image formats
  const magicBytes = buffer.slice(0, 12).toString("hex");

  const validFormats = [
    { signature: "ffd8ff", type: "JPEG" },
    { signature: "89504e47", type: "PNG" },
    { signature: "47494638", type: "GIF" },
    { signature: "52494646", type: "WEBP" }, // RIFF (WebP uses RIFF container)
  ];

  const isValidFormat = validFormats.some((format) =>
    magicBytes.startsWith(format.signature)
  );

  if (!isValidFormat) {
    return {
      valid: false,
      error: "Invalid image format. Only JPEG, PNG, GIF, and WebP are supported.",
    };
  }

  return { valid: true };
};
