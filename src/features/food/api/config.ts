import { readFileSync } from "node:fs";
import { z } from "zod";

const GeoCodesSchema = z.object({
  districts: z.array(z.object({ id: z.string().regex(/^BD\d{4}$/) })).length(64),
});

/** The 64 ADM2 P-codes from the vendored geo codes file. Read once, at boot. */
export function loadDistrictIds(path: string): ReadonlySet<string> {
  const { districts } = GeoCodesSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  return new Set(districts.map((d) => d.id));
}
