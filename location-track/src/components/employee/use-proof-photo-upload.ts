"use client";

import { useEffect, useRef, useState } from "react";
import type { ProofType } from "@prisma/client";

import {
  EmployeeEventApiError,
  uploadProofPhoto,
} from "@/lib/employee-events";
import type { Messages } from "@/lib/i18n";
import {
  isAllowedProofPhotoType,
  MAX_PROOF_PHOTO_BYTES,
} from "@/lib/proof-photo";

export function useProofPhotoUpload({
  assignmentId,
  labels,
  proofType,
}: {
  assignmentId: string;
  labels: Messages["employee"]["proofPhoto"];
  proofType: ProofType;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  function replacePreviewUrl(nextFile: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (!nextFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(nextFile);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
  }

  function handleFileChange(nextFile: File | null) {
    setUploadedUrl(null);
    setError(null);

    if (!nextFile) {
      setFile(null);
      replacePreviewUrl(null);
      return;
    }

    if (!isAllowedProofPhotoType(nextFile.type)) {
      setFile(null);
      replacePreviewUrl(null);
      setError(labels.errors.unsupportedType);
      return;
    }

    if (nextFile.size > MAX_PROOF_PHOTO_BYTES) {
      setFile(null);
      replacePreviewUrl(null);
      setError(labels.errors.tooLarge);
      return;
    }

    setFile(nextFile);
    replacePreviewUrl(nextFile);
  }

  function clear() {
    setFile(null);
    replacePreviewUrl(null);
    setUploadedUrl(null);
    setError(null);
  }

  async function preparePhotoUrl(required: boolean) {
    if (uploadedUrl) {
      return uploadedUrl;
    }

    if (!file) {
      if (required) {
        setError(labels.errors.required);
        return null;
      }

      return undefined;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await uploadProofPhoto({
        assignmentId,
        file,
        proofType,
      });
      setUploadedUrl(result.url);
      return result.url;
    } catch (uploadError) {
      setError(
        uploadError instanceof EmployeeEventApiError
          ? uploadError.message
          : labels.errors.uploadFailed,
      );
      return null;
    } finally {
      setUploading(false);
    }
  }

  return {
    clear,
    error,
    file,
    fileName: file?.name ?? null,
    handleFileChange,
    preparePhotoUrl,
    previewUrl,
    uploadedUrl,
    uploading,
  };
}
