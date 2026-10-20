'use client';

import { useState, type FormEvent } from 'react';
import { toE164 } from '@/lib/phone';
import { PhoneCodeEntry } from './PhoneCodeEntry';

/** Customer sign-in: mobile number, then the code texted to it. */
export function PhoneSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const [input, setInput] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (phone) {
    return (
      <PhoneCodeEntry
        phone={phone}
        action="Sign in"
        onVerified={() => onSignedIn?.()}
        onChangeNumber={() => setPhone(null)}
      />
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const e164 = toE164(input);
    if (!e164) return setError('Enter a valid mobile number, e.g. 98765 43210.');
    setError(null);
    setPhone(e164);
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ gap: 12 }}>
      <div className="field">
        <label htmlFor="signin-phone">Mobile number you booked with</label>
        <input
          id="signin-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98765 43210"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </div>
      {error && (
        <p className="notice danger small" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <button type="submit">Text me a code</button>
    </form>
  );
}
