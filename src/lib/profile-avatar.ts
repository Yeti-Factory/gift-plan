import { apiAction, uploadFile } from "@/lib/self-hosted/api-client";
import { sniffImageMagicBytes, type SniffedImageKind } from "@/lib/gift-image";

export const PROFILE_AVATAR_BUCKET = "profile-avatars";
export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;

type SupportedAvatarKind = Exclude<SniffedImageKind, "gif">;

const EXTENSION_BY_KIND: Record<SupportedAvatarKind, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

const MIME_BY_KIND: Record<SupportedAvatarKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function inspectProfileAvatarFile(
  file: File,
): Promise<{ extension: string; contentType: string }> {
  if (file.size > PROFILE_AVATAR_MAX_BYTES) {
    throw new Error("Image trop lourde (maximum 5 Mo).");
  }

  const kind = await sniffImageMagicBytes(file);
  if (!kind || kind === "gif") {
    throw new Error("Format non supporté (JPEG, PNG ou WebP uniquement).");
  }

  return {
    extension: EXTENSION_BY_KIND[kind],
    contentType: MIME_BY_KIND[kind],
  };
}

export async function uploadProfileAvatar(
  userId: string,
  file: File,
): Promise<{ path: string; publicUrl: string }> {
  await inspectProfileAvatarFile(file);
  void userId;
  const uploaded = await uploadFile("avatar", file);
  return { path: uploaded.path, publicUrl: uploaded.url };
}

export async function removeUncommittedProfileAvatar(userId: string, path: string) {
  if (!path.startsWith(`${userId}/`)) return;
  await apiAction("discard-upload", { kind: "avatar", path });
}
