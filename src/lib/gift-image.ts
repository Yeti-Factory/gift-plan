import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getGiftImageSignedUrls, getPublicGiftImageSignedUrls } from "@/lib/gift-image.functions";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export type SniffedImageKind = "jpeg" | "png" | "webp" | "gif";

/**
 * Read the first bytes of a file and identify the image kind by magic bytes.
 * Ignores the user-provided MIME/extension (both are attacker-controlled).
 */
export async function sniffImageMagicBytes(file: File): Promise<SniffedImageKind | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (head.length < 4) return null;

  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  )
    return "png";
  // GIF: "GIF87a" or "GIF89a"
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) return "gif";
  // WEBP: "RIFF" .... "WEBP"
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  )
    return "webp";

  return null;
}

const EXT_BY_KIND: Record<SniffedImageKind, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
};

const MIME_BY_KIND: Record<SniffedImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Upload a gift image to the private "gift-images" bucket after validating
 * size and magic bytes. Returns the storage path (to persist as gifts.image_path);
 * signed URLs for display are minted server-side on demand.
 */
export async function uploadGiftImageChecked(
  userId: string,
  file: File,
): Promise<{ path: string }> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image trop lourde (max 5 Mo).");
  }
  const kind = await sniffImageMagicBytes(file);
  if (!kind) {
    throw new Error("Format d'image non supporté (JPEG, PNG, WEBP, GIF uniquement).");
  }
  const path = `${userId}/${crypto.randomUUID()}.${EXT_BY_KIND[kind]}`;
  const { error } = await supabase.storage.from("gift-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: MIME_BY_KIND[kind],
  });
  if (error) throw error;
  return { path };
}

/**
 * Hook: batch-fetch short-lived signed URLs for a list of gift ids.
 * Returns `Record<giftId, signedUrl>` for gifts the caller can see.
 */
export function useGiftImageUrls(giftIds: string[], enabled = true) {
  const fetchUrls = useServerFn(getGiftImageSignedUrls);
  const key = [...giftIds].sort().join(",");
  return useQuery({
    queryKey: ["gift-image-urls", key],
    queryFn: async () => {
      if (giftIds.length === 0) return {} as Record<string, string>;
      const res = await fetchUrls({ data: { giftIds } });
      return res.urls;
    },
    // Signed URLs expire after 5 min; refresh at 4 min.
    staleTime: 4 * 60 * 1000,
    refetchInterval: 4 * 60 * 1000,
    enabled: enabled && giftIds.length > 0,
  });
}

export function usePublicGiftImageUrls(
  username: string,
  shareToken: string | undefined,
  giftIds: string[],
  enabled = true,
) {
  const fetchUrls = useServerFn(getPublicGiftImageSignedUrls);
  const key = [...giftIds].sort().join(",");
  return useQuery({
    queryKey: ["public-gift-image-urls", username, shareToken ?? "", key],
    queryFn: async () => {
      if (giftIds.length === 0) return {} as Record<string, string>;
      const response = await fetchUrls({ data: { username, shareToken, giftIds } });
      return response.urls;
    },
    staleTime: 4 * 60 * 1000,
    refetchInterval: 4 * 60 * 1000,
    enabled: enabled && giftIds.length > 0,
  });
}
