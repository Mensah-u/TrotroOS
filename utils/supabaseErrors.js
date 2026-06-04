const MISSING_TABLE_RE =
  /could not find the table|schema cache|PGRST205|relation.*does not exist/i;
const RLS_RE = /row-level security|permission denied|42501/i;
const FK_PROFILE_RE = /mate_profile|23503|foreign key/i;
const NETWORK_RE = /timeout|connection|network|fetch failed|503|502/i;

export function isMissingTableError(message) {
  return MISSING_TABLE_RE.test(message ?? '');
}

/** User-safe message — never exposes SQL file paths or dev instructions. */
export function formatSupabaseError(message) {
  const msg = message ?? '';

  if (isMissingTableError(msg)) {
    return (
      'This feature is temporarily unavailable. Please try again in a few minutes ' +
      'or contact support if the problem continues.'
    );
  }
  if (RLS_RE.test(msg)) {
    return (
      'We could not complete this action due to a permissions issue. ' +
      'Please check your connection and try again.'
    );
  }
  if (FK_PROFILE_RE.test(msg)) {
    return (
      'Your mate profile could not be found. Open Account, review your profile details, save, and try again.'
    );
  }
  if (NETWORK_RE.test(msg)) {
    return 'Connection problem. Check your internet and try again.';
  }
  if (!msg.trim()) {
    return 'Something went wrong. Please try again.';
  }
  return msg;
}

export function formatUserError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const msg = typeof error === 'string' ? error : error?.message;
  if (!msg) return fallback;
  return formatSupabaseError(msg);
}
