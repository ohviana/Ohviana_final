'use client';

import { useEffect, useId, useMemo } from 'react';
import { ErrorResponse, OrganizerProfile } from '@ohviana/contracts';
import { logoSrc } from '@/lib/media';
import { authHeader } from '@/lib/session';
import { Icon } from './Icon';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const MAX_BYTES = 10 * 1024 * 1024;

export interface LogoChoice {
  mode: 'upload' | 'link';
  file: File | null;
  link: string;
}

export const logoChoice = (current: string | null): LogoChoice => ({
  // A previously pasted link opens on "Paste a link"; uploads (and no logo) on "Upload".
  mode: current && !current.startsWith('/') ? 'link' : 'upload',
  file: null,
  link: current && !current.startsWith('/') ? current : '',
});

/** Uploads a logo for `organizerId` (multipart) and returns the updated profile. */
export async function uploadLogo(organizerId: string, file: File): Promise<OrganizerProfile> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/v1/organizer/profile/logo`, {
    method: 'POST',
    headers: { ...(await authHeader()), 'x-organizer-id': organizerId },
    body: form,
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ErrorResponse.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error.message : `Upload failed (${res.status})`);
  }
  return OrganizerProfile.parse(body);
}

/** Logo: upload a photo or paste a link (toggle), with a preview of what will show. */
export function LogoInput({
  value,
  current,
  onChange,
}: {
  value: LogoChoice;
  /** The logo already saved, if any. */
  current: string | null;
  onChange: (next: LogoChoice) => void;
}) {
  const id = useId();
  const filePreview = useMemo(
    () => (value.file ? URL.createObjectURL(value.file) : null),
    [value.file],
  );
  useEffect(() => () => void (filePreview && URL.revokeObjectURL(filePreview)), [filePreview]);

  const preview =
    value.mode === 'upload'
      ? (filePreview ?? (current?.startsWith('/') ? logoSrc(current) : null))
      : /^https:\/\/\S+$/.test(value.link)
        ? value.link
        : null;
  const tooBig = value.file && value.file.size > MAX_BYTES;

  return (
    <div className="field">
      <span className="label-like">Logo</span>
      <div className="logo-input">
        <div className="logo-preview" aria-hidden="true">
          {preview ? <img src={preview} alt="" /> : <Icon name="building" size={24} />}
        </div>
        <div className="stack" style={{ gap: 8, flex: 1, minWidth: 0 }}>
          <div className="segmented" role="group" aria-label="Logo source">
            <button
              type="button"
              aria-pressed={value.mode === 'upload'}
              onClick={() => onChange({ ...value, mode: 'upload' })}
            >
              Upload photo
            </button>
            <button
              type="button"
              aria-pressed={value.mode === 'link'}
              onClick={() => onChange({ ...value, mode: 'link' })}
            >
              Paste a link
            </button>
          </div>
          {value.mode === 'upload' ? (
            <>
              <label
                className="btn secondary small"
                htmlFor={`${id}-file`}
                style={{ alignSelf: 'flex-start' }}
              >
                {value.file ? 'Choose another' : 'Choose image'}
              </label>
              <input
                id={`${id}-file`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => onChange({ ...value, file: e.target.files?.[0] ?? null })}
              />
              <span className={`hint${tooBig ? ' error-text' : ''}`}>
                {tooBig
                  ? 'That image is larger than 10 MB.'
                  : value.file
                    ? value.file.name
                    : 'A square image works best. JPEG, PNG or WebP, up to 10 MB.'}
              </span>
            </>
          ) : (
            <>
              <input
                aria-label="Logo link"
                type="url"
                inputMode="url"
                placeholder="https://…/logo.png"
                value={value.link}
                onChange={(e) => onChange({ ...value, link: e.target.value })}
              />
              <span className="hint">An https link to your logo image.</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
