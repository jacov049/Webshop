import { z } from "zod";

const cursorSchema = z.object({ at: z.string().datetime(), id: z.string().uuid() });
/** Cursor includes the timestamp so deletion of the previous row cannot break paging. */
export function readPage(query: Record<string, unknown>) {
  const limit = z.coerce.number().int().min(1).max(200).parse(query.limit ?? 50);
  const raw = z.string().max(500).optional().parse(query.cursor);
  const cursor = raw ? cursorSchema.parse(JSON.parse(Buffer.from(raw, "base64url").toString())) : null;
  return { limit, at: cursor?.at ?? null, id: cursor?.id ?? null };
}
export function pageResult<T extends { id: string; created_at: Date }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor = rows.length > limit && last
    ? Buffer.from(JSON.stringify({ at: last.created_at.toISOString(), id: last.id })).toString("base64url") : null;
  return { items, nextCursor };
}
