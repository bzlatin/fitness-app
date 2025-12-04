export const formatHandle = (handle?: string | null) => {
  if (!handle) return undefined;
  const cleaned = handle.replace(/^@+/, "").trim();
  if (!cleaned) return undefined;
  return `@${cleaned}`;
};

export const normalizeHandle = (handle?: string | null) => {
  if (!handle) return "";
  const cleaned = handle.replace(/^@+/, "").trim().toLowerCase();
  if (!cleaned) return "";
  return `@${cleaned}`;
};
