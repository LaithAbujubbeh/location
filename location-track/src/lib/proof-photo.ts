export const MAX_PROOF_PHOTO_BYTES = 5 * 1024 * 1024;

export const ALLOWED_PROOF_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedProofPhotoType = (typeof ALLOWED_PROOF_PHOTO_TYPES)[number];

export function isAllowedProofPhotoType(
  value: string,
): value is AllowedProofPhotoType {
  return ALLOWED_PROOF_PHOTO_TYPES.some((type) => type === value);
}

export function proofPhotoExtension(contentType: AllowedProofPhotoType) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }
}
