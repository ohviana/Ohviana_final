'use client';

import { useRef, useState } from 'react';
import { ErrorResponse, OrganizerTrek, type TrekPhoto } from '@ohviana/contracts';
import type { PhotoCategory } from '@ohviana/shared';
import { Icon } from '@/components/Icon';
import { useOrg } from '@/components/dash/org-context';
import { Outcome } from '@/components/dash/ui';
import { mediaUrl } from '@/lib/media';
import { authHeader } from '@/lib/session';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
/** Photos per trek, the same as on the add-trek form. The first is the cover. */
export const MAX_PHOTOS = 3;
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
 * Trek photos as up to three slots, the first being the cover. Read-only it just shows them;
 * writable adds an "Add photo" slot, remove buttons and "Make cover".
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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photos = trek.photos;

  async function upload(list: FileList) {
    setError(null);
    const files = [...list]
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    const problems: string[] = [];
    for (const [i, file] of files.entries()) {
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name}: larger than 10 MB`);
        continue;
      }
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      try {
        onChange(await uploadTrekPhoto(trek.id, org.organizerId, file, 'destination'));
      } catch (err) {
        problems.push(`${file.name}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }
    setBusy(null);
    if (problems.length) setError(problems.join(' · '));
    if (input.current) input.current.value = '';
  }

  async function run(label: string, fn: () => Promise<OrganizerTrek>) {
    setError(null);
    setBusy(label);
    try {
      onChange(await fn());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  }

  const remove = (photo: TrekPhoto) =>
    confirm('Remove this photo?') &&
    run('Removing…', () =>
      call(`/treks/${trek.id}/photos/${photo.id}`, OrganizerTrek, { method: 'DELETE' }),
    );

  /** Moves `photo` first; the others keep their order behind it. */
  const makeCover = (photo: TrekPhoto) =>
    run('Saving…', async () => {
      const order = [photo, ...photos.filter((p) => p.id !== photo.id)];
      let latest = trek;
      for (const [i, p] of order.entries()) {
        latest = await call(`/treks/${trek.id}/photos/${p.id}`, OrganizerTrek, {
          method: 'PATCH',
          body: { sortOrder: i },
        });
      }
      return latest;
    });

  if (!writable) return <PhotoCarousel photos={photos} title={trek.title} />;

  return (
    <div className="stack" style={{ gap: 8 }}>
      {writable && (
        <div className="spread">
          <h2 style={{ margin: 0 }}>Photos</h2>
          <span className="small muted">
            {busy ?? `${photos.length}/${MAX_PHOTOS} · the first is the cover`}
          </span>
        </div>
      )}
      <div className="photo-slots">
        {photos.map((p, i) => (
          <figure key={p.id} className="photo-slot">
            <img src={mediaUrl(p.thumbUrl)} alt={p.caption ?? `${trek.title} photo ${i + 1}`} />
            {i === 0 && <span className="badge glass">Cover</span>}
            {writable && (
              <>
                <button
                  type="button"
                  className="photo-remove"
                  aria-label={`Remove photo ${i + 1}`}
                  disabled={!!busy}
                  onClick={() => void remove(p)}
                >
                  <Icon name="x" size={16} />
                </button>
                {i > 0 && (
                  <button
                    type="button"
                    className="photo-cover small"
                    disabled={!!busy}
                    onClick={() => void makeCover(p)}
                  >
                    Make cover
                  </button>
                )}
              </>
            )}
          </figure>
        ))}
        {writable && photos.length < MAX_PHOTOS && (
          <label className="photo-slot empty" htmlFor={`photos-${trek.id}`}>
            <Icon name="download" size={22} style={{ transform: 'rotate(180deg)' }} />
            <span>{busy ?? 'Add photo'}</span>
            <input
              ref={input}
              id={`photos-${trek.id}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              disabled={!!busy}
              onChange={(e) => e.target.files && void upload(e.target.files)}
            />
          </label>
        )}
      </div>
      {writable && <span className="hint">JPEG, PNG or WebP, up to 10 MB each.</span>}
      <Outcome error={error} />
    </div>
  );
}

/** View mode: the cover, full width; the other photos are a swipe / sideways scroll away. */
function PhotoCarousel({ photos, title }: { photos: TrekPhoto[]; title: string }) {
  const [index, setIndex] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="photo-carousel empty" aria-hidden="true">
        <Icon name="sparkle" size={20} />
        <span>No photos yet</span>
      </div>
    );
  }
  return (
    <div className="photo-carousel">
      <div
        className="photo-track"
        tabIndex={0}
        aria-label={`${title} photos`}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {photos.map((p, i) => (
          <img
            key={p.id}
            src={mediaUrl(p.url)}
            alt={p.caption ?? `${title} photo ${i + 1}`}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        ))}
      </div>
      {index === 0 && <span className="badge glass photo-badge">Cover</span>}
      {photos.length > 1 && (
        <span className="photo-count">
          {index + 1} / {photos.length}
          {index === 0 && ' · swipe for more'}
        </span>
      )}
    </div>
  );
}
