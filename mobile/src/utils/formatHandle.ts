export const formatHandle = (handle?: string | null) => {
  if (!handle) return undefined;
  const cleaned = handle.replace(/^@+/, "").trim();
  if (!cleaned) return undefined;
  return `@${cleaned}`;
};
