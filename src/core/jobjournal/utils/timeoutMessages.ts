/*
 * Localization helper for jobjournal stage timeout/known errors.
 * Returns a short, user-facing message for an error code or Error object.
 */

type SupportedLocale = 'en' | 'es';

export type StageErrorCode =
  | 'TIMEOUT'
  | 'UNKNOWN';

const MESSAGES: Record<SupportedLocale, Record<StageErrorCode, string>> = {
  en: {
    TIMEOUT: 'Operation timed out. Please try again later.',
    UNKNOWN: 'An unknown error occurred.',
  },
  es: {
    TIMEOUT: 'Tiempo de espera agotado. Por favor, inténtalo de nuevo más tarde.',
    UNKNOWN: 'Ocurrió un error desconocido.',
  },
};

/**
 * Convert a stage error (code string or Error) into a localized user message.
 * - If a string matching a known StageErrorCode is passed, that message is used.
 * - If an Error is passed and appears to be an abort/timeout, TIMEOUT is used.
 * - The original error message is appended in parentheses for debugging when available.
 */
export function timeoutErrorToMessage(
  errorOrCode: StageErrorCode | string | Error | null | undefined,
  locale: SupportedLocale = 'en',
): string {
  if (!errorOrCode) return MESSAGES[locale].UNKNOWN;

  // Normalize locale fallback
  const loc: SupportedLocale = (locale === 'es' ? 'es' : 'en');

  // If caller passed a known code exactly, use it.
  if (typeof errorOrCode === 'string') {
    const asCode = (errorOrCode as string).split('|')[0] as StageErrorCode;
    if (MESSAGES[loc][asCode]) {
      return MESSAGES[loc][asCode];
    }
  }

  // If it's an Error, try to infer timeout/abort
  if (errorOrCode instanceof Error) {
    const msg = errorOrCode.message || '';
    const isAbort = msg === 'Aborted' || msg === 'AbortedError' || /abort/i.test(msg) || /timeout/i.test(msg);
    const code: StageErrorCode = isAbort ? 'TIMEOUT' : 'UNKNOWN';
    const base = MESSAGES[loc][code] || MESSAGES[loc].UNKNOWN;
    // Append short original message for context (non-sensitive)
    return msg ? `${base} (${msg})` : base;
  }

  // Fallback: unknown string
  return MESSAGES[loc].UNKNOWN;
}
