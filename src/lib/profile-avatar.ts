import { supabase } from "@/integrations/supabase/client";
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
  const { extension, contentType } = await inspectProfileAvatarFile(file);
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function removeUncommittedProfileAvatar(userId: string, path: string) {
  if (!path.startsWith(`${userId}/`)) return;
  const { error } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([path]);
  if (error) throw error;
}
