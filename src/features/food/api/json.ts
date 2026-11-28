import type { z } from "zod";

type ParsedJson<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Parses JSON text and validates it against `schema`. Syntax and schema failures are returned, not thrown. */
export function parseJson<T extends z.ZodType>(text: string, schema: T): ParsedJson<z.output<T>> {
  try {
    return { ok: true, value: schema.parse(JSON.parse(text)) };
  } catch (error) {
    return { ok: false, error };
  }
}
