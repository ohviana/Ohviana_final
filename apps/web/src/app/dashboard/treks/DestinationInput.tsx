'use client';

import { useEffect, useId, useState } from 'react';
import { CatalogTrekList } from '@ohviana/contracts';
import { Icon } from '@/components/Icon';
import { useOrg } from '@/components/dash/org-context';
import { qs } from '@/lib/api';

/**
 * Free-text destination with suggestions from the Ohviana catalog. Whatever the organizer types
 * is saved: an existing destination is reused, a new one is added to the catalog instantly.
 */
export function DestinationInput({
  value,
  onChange,
  disabled,
  label = 'Destination / peak',
  placeholder = 'e.g. Kudremukh, Devarayanadurga',
  big = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  /** The headline field of the new-trek form. */
  big?: boolean;
}) {
  const { call } = useOrg();
  const listId = useId();
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) return setSuggestions([]);
    const t = setTimeout(() => {
      call(`/catalog-treks${qs({ query: q, limit: 8 })}`, CatalogTrekList)
        .then((r) => setSuggestions(r.items.map((i) => i.name)))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [value, call]);

  const exact = suggestions.some((s) => s.toLowerCase() === value.trim().toLowerCase());

  return (
    <div className={`field${big ? ' field-big' : ''}`}>
      <label htmlFor={`${listId}-input`}>{label}</label>
      <div className="input-icon">
        <Icon name="pin" />
        <input
          id={`${listId}-input`}
          list={listId}
          required
          minLength={2}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
      </div>
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <span className="hint">
        {value.trim().length >= 2 && !exact && suggestions.length >= 0
          ? 'New destinations are added to Ohviana automatically.'
          : 'Pick a suggestion or type a new place.'}
      </span>
    </div>
  );
}
