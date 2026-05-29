const MISSING_TABLE_RE =
  /could not find the table|schema cache|PGRST205|relation.*does not exist/i;
const RLS_RE = /row-level security|permission denied|42501/i;
const FK_PROFILE_RE = /mate_profile|23503|foreign key/i;

export function isMissingTableError(message) {
  return MISSING_TABLE_RE.test(message ?? '');
}

export function formatSupabaseError(message) {
  if (isMissingTableError(message)) {
    return (
      'Database tables are not set up yet. Open Supabase → SQL Editor, run ' +
      'supabase/RUN_THIS_FIRST.sql (see supabase/README.md), then try again.'
    );
  }
  if (RLS_RE.test(message ?? '')) {
    return (
      'Permission denied starting trip. Open Supabase SQL Editor, paste and run ' +
      'supabase/FIX_mate_depart_now.sql (full file), wait 30 seconds, then try Depart Now again.'
    );
  }
  if (FK_PROFILE_RE.test(message ?? '')) {
    return (
      'Your mate profile row is missing. Open Account → edit profile and save, ' +
      'or run supabase/FIX_mate_depart_now.sql in Supabase, then try again.'
    );
  }
  return message ?? 'Something went wrong. Try again.';
}
