import type { JobJournalErrorCode } from '../types';

/**
 * Parse error code and message from stage_executions.
 * Handles both new schema (separate code/message columns) and legacy format (encoded "CODE|message" string).
 * Returns { code, message }. If both are null/empty, returns { code: null, message: null }.
 */
export function parseStageLastError(
  lastErrorCodeOrLegacy: string | null | undefined,
  lastErrorMessage?: string | null | undefined,
): { code: JobJournalErrorCode | null; message: string | null } {
  // New schema: if second parameter provided, treat first as code and second as message
  if (lastErrorMessage !== undefined && lastErrorMessage !== null) {
    const code = validateErrorCode(lastErrorCodeOrLegacy || '');
    return { code, message: lastErrorMessage };
  }

  // Legacy schema: encoded string "CODE|message"
  if (!lastErrorCodeOrLegacy) return { code: null, message: null };
  const parts = String(lastErrorCodeOrLegacy).split('|');
  if (parts.length === 0) return { code: null, message: String(lastErrorCodeOrLegacy) };
  const codePart = parts[0] as string;
  const msgPart = parts.slice(1).join('|') || null;

  const code = validateErrorCode(codePart);
  const message = msgPart || null;
  return { code, message };
}

function validateErrorCode(codePart: string): JobJournalErrorCode | null {
  const knownCodes = new Set<JobJournalErrorCode>([
    'PRECONDITION_FAILED',
    'TIMEOUT',
    'IO_ERROR',
    'NOT_FOUND',
    'UNKNOWN',
  ]);

  return knownCodes.has(codePart as JobJournalErrorCode) ? (codePart as JobJournalErrorCode) : null;
}
