'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TrekPhoto } from '@ohviana/contracts';
import type { PhotoCategory } from '@ohviana/shared';
import { mediaUrl, PHOTO_CATEGORY_LABELS } from '@/lib/media';

const VISIBLE = 5;

/** Photo mosaic with category filters and a keyboard-friendly full-screen viewer. */
export function PhotoGallery({ photos, title }: { photos: TrekPhoto[]; title: string }) {
  const [filter, setFilter] = useState<PhotoCategory | 'all'>('all');
  const [open, setOpen] = useState<number | null>(null);

  const categories = useMemo(() => [...new Set(photos.map((p) => p.category))], [photos]);
  const shown = filter === 'all' ? photos : photos.filter((p) => p.category === filter);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + shown.length) % shown.length)),
    [shown.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, step]);

  if (photos.length === 0) return null;
  const current = open !== null ? shown[open] : undefined;

  return (
    <section className="stack" aria-label="Photos">
      {categories.length > 1 && (
        <div className="tabs" role="group" aria-label="Filter photos">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All ({photos.length})
          </button>
          {categories.map((c) => (
            <button key={c} type="button" aria-pressed={filter === c} onClick={() => setFilter(c)}>
              {PHOTO_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      )}
      <div className="gallery">
        {shown.slice(0, VISIBLE).map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open photo ${i + 1}: ${p.caption ?? PHOTO_CATEGORY_LABELS[p.category]}`}
          >
            <img
              src={mediaUrl(i === 0 ? p.url : p.thumbUrl)}
              alt={p.caption ?? `${title} — ${PHOTO_CATEGORY_LABELS[p.category]}`}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
            <span className="badge glass photo-cat">{PHOTO_CATEGORY_LABELS[p.category]}</span>
            {i === VISIBLE - 1 && shown.length > VISIBLE && (
              <span className="more">+{shown.length - VISIBLE}</span>
            )}
          </button>
        ))}
      </div>

      {current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photos`}
          onClick={close}
        >
          <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
            <span className="small">
              {open! + 1} / {shown.length} · {PHOTO_CATEGORY_LABELS[current.category]}
            </span>
            <button type="button" onClick={close} aria-label="Close photos">
              ✕ Close
            </button>
          </div>
          <div className="lightbox-stage">
            <img
              src={mediaUrl(current.url)}
              alt={current.caption ?? title}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => step(-1)} aria-label="Previous photo">
              ← Prev
            </button>
            <span className="small" style={{ textAlign: 'center', flex: 1 }}>
              {current.caption}
            </span>
            <button type="button" onClick={() => step(1)} aria-label="Next photo">
              Next →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
