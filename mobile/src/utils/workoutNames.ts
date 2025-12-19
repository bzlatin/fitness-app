export const normalizeWorkoutTemplateName = (
  raw?: string | null
): string | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  if (lower === "imported_workout" || lower === "imported workout") {
    return "Imported workout";
  }
  if (lower.includes("\\(type.rawvalue)") || lower.includes("type.rawvalue")) {
    return "Imported workout";
  }

  return trimmed;
};
