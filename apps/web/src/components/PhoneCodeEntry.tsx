'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { prettyPhone } from '@/lib/phone';
import { sendPhoneCode, signInWithPhoneCode } from '@/lib/session';

interface Props {
  /** E.164 number the code is texted to. */
  phone: string;
  /** Label of the verify button, e.g. "Verify & book". */
  action: string;
  /** Called once the code is accepted and the session is stored. */
  onVerified: () => void | Promise<void>;
  onChangeNumber: () => void;
}

/**
 * Texts a sign-in code to `phone` on mount and asks for it. Not a <form>: it is used inside the
 * checkout form, so Enter is handled here instead of submitting the outer form.
 */
export function PhoneCodeEntry({ phone, action, onVerified, onChangeNumber }: Props) {
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const sentFor = useRef<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const sent = await sendPhoneCode(phone);
      setResendAt(Date.parse(sent.resendAt));
      input.current?.focus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the code. Try again.');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    // Once per number, even when React runs effects twice in development.
    if (sentFor.current === phone) return;
    sentFor.current = phone;
    void send();
  }, [phone]);

  useEffect(() => {
    if (!resendAt || resendAt <= now) return;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [resendAt, now]);

  async function verify() {
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code.');
    setVerifying(true);
    setError(null);
    try {
      await signInWithPhoneCode(phone, code);
    } catch (err) {
      setVerifying(false);
      return setError(err instanceof ApiError ? err.message : 'Network problem. Try again.');
    }
    await onVerified();
    setVerifying(false);
  }

  const wait = resendAt ? Math.ceil((resendAt - now) / 1000) : 0;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <p className="small" style={{ margin: 0 }}>
        We texted a 6-digit code to <strong>{prettyPhone(phone)}</strong>.{' '}
        <button type="button" className="link" onClick={onChangeNumber}>
          Change
        </button>
      </p>
      <div className="field">
        <label htmlFor="otp-code">Verification code</label>
        <input
          id="otp-code"
          ref={input}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void verify();
            }
          }}
        />
      </div>
      {error && (
        <p className="notice danger small" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <button type="button" disabled={verifying || sending} onClick={() => void verify()}>
        {verifying ? 'Verifying…' : action}
      </button>
      <button
        type="button"
        className="secondary"
        disabled={sending || wait > 0}
        onClick={() => void send()}
      >
        {sending ? 'Sending…' : wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
      </button>
    </div>
  );
}
