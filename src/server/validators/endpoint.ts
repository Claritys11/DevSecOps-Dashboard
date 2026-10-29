import { z } from "zod";

// Field rules without defaults. Zod 4 applies `.default()` even inside `.partial()`,
// so updates must be built from this base or a PATCH would reset unrelated fields.
const endpointFields = {
  serverId: z.string().trim().nullish().transform((value) => value || null),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  url: z
    .string()
    .trim()
    .url("Enter a full URL, like https://example.com/health")
    .refine((value) => /^https?:\/\//i.test(value), "Only http:// and https:// URLs can be monitored"),
  expectedStatus: z.coerce.number().int().min(100).max(599),
  enabled: z.boolean(),
  intervalSeconds: z.coerce.number().int().min(15, "Check at most every 15 seconds").max(86400),
  timeoutMs: z.coerce.number().int().min(500).max(30000)
};

export const endpointSchema = z.object({
  ...endpointFields,
  expectedStatus: endpointFields.expectedStatus.default(200),
  enabled: endpointFields.enabled.default(true),
  intervalSeconds: endpointFields.intervalSeconds.default(60),
  timeoutMs: endpointFields.timeoutMs.default(5000)
});

export const endpointUpdateSchema = z.object(endpointFields).partial();
