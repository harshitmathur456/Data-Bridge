// Regex to extract emails from a string
export function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(emailRegex) || [];
}

/**
 * Resolves the primary email and extra emails from a raw field.
 */
export function resolveEmails(emailRawVal: string): { primaryEmail: string; extraEmails: string[] } {
  const emailRaw = String(emailRawVal || '').trim().toLowerCase();
  let emails = extractEmails(emailRaw);
  
  if (emails.length === 0 && emailRaw) {
    emails = [emailRaw]; // fallback
  }

  return {
    primaryEmail: emails[0] || '',
    extraEmails: emails.slice(1)
  };
}
