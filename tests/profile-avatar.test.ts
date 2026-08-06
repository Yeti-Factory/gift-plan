import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadFileMock, apiActionMock } = vi.hoisted(() => ({
  uploadFileMock: vi.fn(),
  apiActionMock: vi.fn(),
}));

vi.mock("@/lib/self-hosted/api-client", () => ({
  uploadFile: uploadFileMock,
  apiAction: apiActionMock,
}));

import {
  inspectProfileAvatarFile,
  PROFILE_AVATAR_MAX_BYTES,
  removeUncommittedProfileAvatar,
  uploadProfileAvatar,
} from "@/lib/profile-avatar";

function imageFile(bytes: number[], name: string) {
  return new File([new Uint8Array(bytes)], name, { type: "application/octet-stream" });
}

describe("profile avatar validation", () => {
  it("accepts JPEG and normalizes the extension and MIME type", async () => {
    const file = imageFile([0xff, 0xd8, 0xff, 0xe0], "avatar.txt");

    await expect(inspectProfileAvatarFile(file)).resolves.toEqual({
      extension: "jpg",
      contentType: "image/jpeg",
    });
  });

  it("accepts a PNG based on its magic bytes", async () => {
    const file = imageFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "avatar.bin");

    await expect(inspectProfileAvatarFile(file)).resolves.toEqual({
      extension: "png",
      contentType: "image/png",
    });
  });

  it("accepts WebP based on its RIFF signature", async () => {
    const file = imageFile(
      [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
      "avatar.webp",
    );

    await expect(inspectProfileAvatarFile(file)).resolves.toEqual({
      extension: "webp",
      contentType: "image/webp",
    });
  });

  it("rejects GIF avatars", async () => {
    const file = imageFile([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], "avatar.gif");

    await expect(inspectProfileAvatarFile(file)).rejects.toThrow("JPEG, PNG ou WebP");
  });

  it("rejects a renamed non-image file", async () => {
    const file = imageFile([0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74], "avatar.png");

    await expect(inspectProfileAvatarFile(file)).rejects.toThrow("Format non supporté");
  });

  it("rejects files larger than 5 MB", async () => {
    const file = new File([new Uint8Array(PROFILE_AVATAR_MAX_BYTES + 1)], "large.png");

    await expect(inspectProfileAvatarFile(file)).rejects.toThrow("maximum 5 Mo");
  });
});

describe("profile avatar storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadFileMock.mockResolvedValue({
      path: "user-123/00000000-0000-4000-8000-000000000001.png",
      url: "/api/v1/files/avatars/user-123/00000000-0000-4000-8000-000000000001.png",
    });
  });

  it("uploads a validated image in the authenticated user's folder", async () => {
    const file = imageFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "avatar.bin");

    await expect(uploadProfileAvatar("user-123", file)).resolves.toEqual({
      path: "user-123/00000000-0000-4000-8000-000000000001.png",
      publicUrl: "/api/v1/files/avatars/user-123/00000000-0000-4000-8000-000000000001.png",
    });
    expect(uploadFileMock).toHaveBeenCalledWith("avatar", file);
  });

  it("queues only the current user's uncommitted file for cleanup", async () => {
    await removeUncommittedProfileAvatar("user-a", "user-b/forbidden.png");
    await removeUncommittedProfileAvatar("user-a", "user-a/orphan.png");
    expect(apiActionMock).toHaveBeenCalledOnce();
    expect(apiActionMock).toHaveBeenCalledWith("discard-upload", {
      kind: "avatar",
      path: "user-a/orphan.png",
    });
  });
});
