export const ADMIN_EMAIL = String(
  import.meta.env.VITE_ADMIN_EMAIL || 'nomiadmin3535@gmail.com'
)
  .trim()
  .toLowerCase();

export const ADMIN_USERNAMES = ['saasproduct', 'nomiadmin3535'];

export function isAdminEmail(email?: string | null): boolean {
  return String(email || '').trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdminIdentifier(value?: string | null): boolean {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return false;
  return isAdminEmail(v) || ADMIN_USERNAMES.includes(v);
}
