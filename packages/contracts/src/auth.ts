import { z } from 'zod';
import { Uuid } from './common';

const Email = z
  .email()
  .max(254)
  .transform((e) => e.trim().toLowerCase());

/** 8–128 characters; length matters more than character classes (NIST SP 800-63B). */
export const Password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters');

export const SignUpRequest = z.object({
  email: Email,
  password: Password,
  fullName: z.string().trim().min(1).max(120).optional(),
});
export type SignUpRequest = z.infer<typeof SignUpRequest>;

export const SignInRequest = z.object({
  email: Email,
  password: z.string().min(1).max(128),
});
export type SignInRequest = z.infer<typeof SignInRequest>;

export const SessionResponse = z.object({
  accessToken: z.string(),
  expiresAt: z.iso.datetime(),
  user: z.object({ id: Uuid, email: z.string(), fullName: z.string().nullable() }),
});
export type SessionResponse = z.infer<typeof SessionResponse>;
