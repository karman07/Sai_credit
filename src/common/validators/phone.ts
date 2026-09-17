import { z } from 'zod';

/** Digits only — no spaces, dashes, '+', letters or any other characters. */
export const PHONE_REGEX = /^\d{7,15}$/;
const PHONE_MESSAGE = 'Enter numbers only (7–15 digits, no spaces, letters or symbols)';

export const requiredPhone = () => z.string().regex(PHONE_REGEX, PHONE_MESSAGE);

/** Allows omission/empty string, but rejects non-numeric content when a value is given. */
export const optionalPhone = () =>
  z.string().optional().refine((v) => !v || PHONE_REGEX.test(v), { message: PHONE_MESSAGE });
