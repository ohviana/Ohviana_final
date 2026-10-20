'use client';

import { useRef, useState, type DragEvent } from 'react';
import { ErrorResponse, OrganizerTrek, type TrekPhoto } from '@ohviana/contracts';
import { PHOTO_CATEGORIES, type PhotoCategory } from '@ohviana/shared';
import { Icon } from '@/components/Icon';
import { useOrg } from '@/components/dash/org-context';
import { Outcome } from '@/components/dash/ui';
import { mediaUrl, PHOTO_CATEGORY_LABELS } from '@/lib/media';
import { authHeader } from '@/lib/session';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
export const MAX_PHOTOS = 20;
export const MAX_BYTES = 10 * 1024 * 1024;

/** Uploads one photo (multipart: category and caption fields must precede the file). */
export async function uploadTrekPhoto(
  trekId: string,
  organizerId: string,
  file: File,
  category: PhotoCategory,
): Promise<OrganizerTrek> {
  const form = new FormData();
  form.append('category', category);
  form.append('caption', '');
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/v1/organizer/treks/${trekId}/photos`, {
    method: 'POST',
    headers: { ...(await authHeader()), 'x-organizer-id': organizerId },
    body: form,
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ErrorResponse.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error.message : `Upload failed (${res.status})`);
  }
  return OrganizerTrek.parse(body);
}

/**
 * Trek gallery: upload (drag & drop or pick several), tag each photo (destination, transport,
 * stay…), caption, reorder and delete. Uploads run one after another with live progress.
 */
export function PhotoManager({
  trek,
  writable,
  onChange,
}: {
  trek: OrganizerTrek;
  writable: boolean;
  onChange: (t: OrganizerTrek) => void;
}) {
  const { call, org } = useOrg();
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<PhotoCategory>('destination');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photos = trek.photos;

  const uploadOne = (file: File) => uploadTrekPhoto(trek.id, org.organizerId, file, category);

  async function uploadFiles(list: FileList | File[]) {
    setError(null);
    const files = [...list].filter(
      (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name),
    );
    if (files.length === 0) return setError('Choose JPEG, PNG or WebP photos.');
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setError(`A trek can have up to ${MAX_PHOTOS} photos.`);
    const queue = files.slice(0, room);
    const problems: string[] = [];
    for (const [i, file] of queue.entries()) {
      setProgress(`Uploading ${i + 1} of ${queue.length}…`);
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name}: larger than 10 MB`);
        continue;
      }
      try {
        onChange(await uploadOne(file));
      } catch (err) {
        problems.push(`${file.name}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }
    setProgress(null);
    if (files.length > room)
      problems.push(`Only ${room} more photo(s) fit; the rest were skipped.`);
    if (problems.length) setError(problems.join(' · '));
    if (input.current) input.current.value = '';
  }

  async function patch(photo: TrekPhoto, body: Record<string, unknown>) {
    try {
      onChange(
        await call(`/treks/${trek.id}/photos/${photo.id}`, OrganizerTrek, {
          method: 'PATCH',
          body,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function remove(photo: TrekPhoto) {
    if (!confirm('Delete this photo?')) return;
    try {
      onChange(
        await call(`/treks/${trek.id}/photos/${photo.id}`, OrganizerTrek, { method: 'DELETE' }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  /** Swap positions with the neighbour (positions are renumbered so order is explicit). */
  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const a = photos[index]!;
    const b = photos[target]!;
    await patch(a, { sortOrder: target });
    await patch(b, { sortOrder: index });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (writable && e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
  }

  return (
    <section className="card stack">
      <div className="spread">
        <h2 className="cluster" style={{ gap: 8, margin: 0 }}>
          <Icon name="sparkle" /> Photos
        </h2>
        <span className="small muted">
          {photos.length}/{MAX_PHOTOS} · treks with photos get far more bookings
        </span>
      </div>

      {writable && (
        <div
          className={`dropzone ${dragging ? 'active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className="icon-circle">
            <Icon name="download" size={22} style={{ transform: 'rotate(180deg)' }} />
          </span>
          <strong>Drag photos here, or choose files</strong>
          <span className="small muted">
            Destination views, the trail, your bus or jeep, stays, food, happy groups. JPEG / PNG /
            WebP, up to 10 MB each. Location data is removed automatically.
          </span>
          <div className="cluster" style={{ justifyContent: 'center' }}>
            <label className="small" htmlFor="photo-category">
              These photos show
            </label>
            <select
              id="photo-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as PhotoCategory)}
              style={{ width: 'auto', minHeight: 40 }}
            >
              {PHOTO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PHOTO_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <button type="button" disabled={!!progress} onClick={() => input.current?.click()}>
              {progress ?? 'Choose photos'}
            </button>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              aria-label="Upload photos"
              onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
            />
          </div>
        </div>
      )}

      <Outcome error={error} />

      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p, i) => (
            <div key={p.id} className="photo-tile">
              <img
                src={mediaUrl(p.thumbUrl)}
                alt={p.caption ?? PHOTO_CATEGORY_LABELS[p.category]}
                loading="lazy"
              />
              <div className="tile-body">
                {writable ? (
                  <>
                    <select
                      aria-label="Category"
                      value={p.category}
                      onChange={(e) => void patch(p, { category: e.target.value })}
                    >
                      {PHOTO_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {PHOTO_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Caption"
                      placeholder="Add a caption"
                      defaultValue={p.caption ?? ''}
                      maxLength={200}
                      onBlur={(e) => {
                        if (e.target.value !== (p.caption ?? ''))
                          void patch(p, { caption: e.target.value || null });
                      }}
                    />
                    <div className="spread">
                      <span className="cluster" style={{ gap: 4 }}>
                        <button
                          type="button"
                          className="small secondary"
                          aria-label="Move earlier"
                          disabled={i === 0}
                          onClick={() => void move(i, -1)}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="small secondary"
                          aria-label="Move later"
                          disabled={i === photos.length - 1}
                          onClick={() => void move(i, 1)}
                        >
                          →
                        </button>
                      </span>
                      <button type="button" className="small danger" onClick={() => void remove(p)}>
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <span className="badge">{PHOTO_CATEGORY_LABELS[p.category]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {photos.length === 0 && !writable && <p className="muted small">No photos yet.</p>}
    </section>
  );
}
