"use client";

import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";

type ProofPhotoFieldProps = {
  disabled?: boolean;
  error: string | null;
  fileName: string | null;
  labels: Messages["employee"]["proofPhoto"];
  onClear: () => void;
  onFileChange: (file: File | null) => void;
  previewUrl: string | null;
  required: boolean;
  uploadedUrl: string | null;
  uploading: boolean;
};

export function ProofPhotoField({
  disabled = false,
  error,
  fileName,
  labels,
  onClear,
  onFileChange,
  previewUrl,
  required,
  uploadedUrl,
  uploading,
}: ProofPhotoFieldProps) {
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {labels.title}
          </span>
          <span className="rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-xs font-medium text-text-muted">
            {required ? labels.required : labels.optional}
          </span>
        </div>
        <p className="text-sm leading-6 text-text-muted">{labels.help}</p>
      </div>

      <label className="grid min-h-11 cursor-pointer place-items-center rounded-md border border-dashed border-border bg-surface-subtle px-4 py-3 text-center text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary">
        <input
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          type="file"
        />
        {fileName ? labels.change : labels.select}
      </label>

      {fileName ? (
        <div className="grid min-w-0 gap-2 rounded-md border border-border bg-surface px-3 py-3">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 break-all text-sm text-foreground">
              {labels.selected.replace("{name}", fileName)}
            </p>
            <Button
              className="w-full sm:w-auto"
              disabled={disabled || uploading}
              onClick={onClear}
              type="button"
              variant="outline"
            >
              {labels.remove}
            </Button>
          </div>
          {previewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={labels.previewAlt}
                className="max-h-72 w-full rounded-md border border-border object-contain"
                src={previewUrl}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {uploading ? (
        <p className="text-sm font-medium text-primary">{labels.uploading}</p>
      ) : null}
      {uploadedUrl ? (
        <a
          className="break-all text-sm font-medium text-primary hover:text-primary-hover"
          href={uploadedUrl}
          rel="noreferrer"
          target="_blank"
        >
          {labels.uploaded}
        </a>
      ) : null}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
