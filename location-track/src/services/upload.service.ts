import { randomUUID } from "node:crypto";

import { put } from "@vercel/blob";
import { ProofType } from "@prisma/client";

import {
  isAllowedProofPhotoType,
  proofPhotoExtension,
  MAX_PROOF_PHOTO_BYTES,
  type AllowedProofPhotoType,
} from "../lib/proof-photo.ts";
import { prisma } from "../lib/prisma.ts";
import type { AuthenticatedSession } from "../lib/permissions.ts";

export class UploadServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "UploadServiceError";
    this.status = status;
    this.code = code;
  }
}

export type ProofPhotoType =
  | typeof ProofType.CHECK_IN
  | typeof ProofType.RECHECK
  | typeof ProofType.CHECK_OUT;

export type ProofPhotoUploadResult = {
  url: string;
  pathname: string;
};

type BlobUploader = (
  pathname: string,
  body: Blob,
  options: {
    access: "public";
    addRandomSuffix: boolean;
    allowOverwrite: boolean;
    contentType: string;
  },
) => Promise<{
  url: string;
  pathname: string;
}>;

type AssignmentLookup = {
  eventAssignment: {
    findFirst(args: {
      where: {
        employeeId: string;
        id: string;
      };
      select: {
        id: true;
      };
    }): Promise<{ id: string } | null>;
  };
};

const proofPhotoTypes = new Set<string>([
  ProofType.CHECK_IN,
  ProofType.RECHECK,
  ProofType.CHECK_OUT,
]);

function isProofPhotoType(value: string): value is ProofPhotoType {
  return proofPhotoTypes.has(value);
}

function hasSignature(
  bytes: Uint8Array,
  contentType: AllowedProofPhotoType,
) {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (contentType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function timestampPathSegment(now: Date) {
  return now.toISOString().replace(/[:.]/g, "-");
}

export async function uploadProofPhoto({
  assignmentId,
  database = prisma,
  file,
  now = new Date(),
  proofType,
  session,
  uploadBlob = put as BlobUploader,
}: {
  assignmentId: string;
  database?: AssignmentLookup;
  file: File;
  now?: Date;
  proofType: string;
  session: AuthenticatedSession;
  uploadBlob?: BlobUploader;
}): Promise<ProofPhotoUploadResult> {
  if (!assignmentId.trim()) {
    throw new UploadServiceError(
      400,
      "VALIDATION_ERROR",
      "Assignment ID is required.",
    );
  }

  if (!isProofPhotoType(proofType)) {
    throw new UploadServiceError(
      400,
      "VALIDATION_ERROR",
      "Proof type is not supported for photo upload.",
    );
  }

  if (!isAllowedProofPhotoType(file.type)) {
    throw new UploadServiceError(
      400,
      "UNSUPPORTED_FILE_TYPE",
      "Proof photo must be a JPEG, PNG, or WebP image.",
    );
  }

  if (file.size <= 0) {
    throw new UploadServiceError(
      400,
      "EMPTY_FILE",
      "Proof photo cannot be empty.",
    );
  }

  if (file.size > MAX_PROOF_PHOTO_BYTES) {
    throw new UploadServiceError(
      413,
      "FILE_TOO_LARGE",
      "Proof photo must be 5MB or smaller.",
    );
  }

  const assignment = await database.eventAssignment.findFirst({
    where: {
      employeeId: session.user.id,
      id: assignmentId,
    },
    select: {
      id: true,
    },
  });

  if (!assignment) {
    throw new UploadServiceError(
      404,
      "ASSIGNMENT_NOT_FOUND",
      "Assigned event was not found.",
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (!hasSignature(bytes, file.type)) {
    throw new UploadServiceError(
      400,
      "INVALID_IMAGE_FILE",
      "Proof photo content does not match the selected image type.",
    );
  }

  const extension = proofPhotoExtension(file.type);
  const pathname = [
    "proofs",
    safePathSegment(session.user.id),
    safePathSegment(assignmentId),
    proofType,
    `${timestampPathSegment(now)}-${randomUUID()}.${extension}`,
  ].join("/");

  const blob = await uploadBlob(pathname, new Blob([bytes], { type: file.type }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: file.type,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}
