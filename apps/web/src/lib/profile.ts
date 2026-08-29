export function validateDisplayName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true, value: "", message: "Your username will be shown." };
  if (trimmed.length > 20) {
    return { valid: false, value: trimmed, message: "Use no more than 20 characters." };
  }
  if (!/^[A-Za-z0-9]+$/.test(trimmed)) {
    return { valid: false, value: trimmed, message: "Use letters and numbers only." };
  }
  return { valid: true, value: trimmed, message: "" };
}

export function validateBio(value: string) {
  const trimmed = value.trim();
  return {
    valid: trimmed.length <= 60,
    value: trimmed,
    message: trimmed.length <= 60 ? "" : "Use no more than 60 characters.",
  };
}

export function streakHue(days: number) {
  if (days <= 1) return 4;
  if (days >= 100) return 278;
  const stops = [4, 30, 55, 125, 215, 278];
  const scaled = ((days - 1) / 99) * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  const progress = scaled - index;
  return stops[index] + (stops[index + 1] - stops[index]) * progress;
}

export function usernameChangeAvailableAt(changedAt: string | null) {
  if (!changedAt) return null;
  const result = new Date(changedAt);
  result.setUTCDate(result.getUTCDate() + 90);
  return result;
}
