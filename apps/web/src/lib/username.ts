export type UsernameValidation = { valid: boolean; message: string };

export function validateUsernameFormat(username: string): UsernameValidation {
  if (username.length === 0) return { valid: false, message: "Enter at least 1 character" };
  if (username.length > 20) return { valid: false, message: "Use no more than 20 characters" };
  if (!/^[A-Za-z0-9]+$/.test(username))
    return { valid: false, message: "Use letters and numbers only" };
  return { valid: true, message: "Username available" };
}

export function normalizeUsername(username: string): string {
  return username.toLowerCase();
}
