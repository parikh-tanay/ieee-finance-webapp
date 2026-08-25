// Only allow http:// and https:// links to ever render as clickable.
// Without this check, someone could type "javascript:alert(document.cookie)"
// into a Drive Link / Invoice Link / Payment Proof field, and if that value
// were rendered directly as <a href={value}>, clicking it would execute
// arbitrary JavaScript in whoever's browser clicked it — including an
// Admin's or Master's session. This function is the single choke point
// every link field must pass through before being rendered as an <a href>.
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // not a valid URL at all
  }
  return null;
}
