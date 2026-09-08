const EXTRA_USERNAMES = ['saasproduct', 'nomiadmin3535'];

export function getAdminEmail(): string {
  return String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || 'nomiadmin3535@gmail.com')
    .trim()
    .toLowerCase();
}

export function getAdminUsername(): string {
  return String(process.env.ADMIN_USERNAME || 'nomiadmin3535').trim().toLowerCase();
}

export function isAdminEmail(email?: string | null): boolean {
  return String(email || '').trim().toLowerCase() === getAdminEmail();
}

export function isAdminIdentifier(value?: string | null): boolean {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return false;
  return isAdminEmail(v) || v === getAdminUsername() || EXTRA_USERNAMES.includes(v);
}
