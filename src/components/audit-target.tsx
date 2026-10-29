/** Picks the most human-readable name out of an audit log's metadata. */
export function auditTargetName(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  const name = record.containerName ?? record.name ?? record.title ?? record.email;
  return typeof name === "string" ? name : null;
}

export function AuditTarget({ metadata }: { metadata: unknown }) {
  const name = auditTargetName(metadata);
  return name ? <span className="font-medium">{name}</span> : null;
}
