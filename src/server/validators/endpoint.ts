import { z } from "zod";

export const endpointSchema = z.object({
  serverId: z.string().trim().nullish().transform((value) => value || null),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  url: z
    .string()
    .trim()
    .url("Enter a full URL, like https://example.com/health")
    .refine((value) => /^https?:\/\//i.test(value), "Only http:// and https:// URLs can be monitored"),
  expectedStatus: z.coerce.number().int().min(100).max(599).default(200),
  enabled: z.boolean().default(true),
  intervalSeconds: z.coerce.number().int().min(15, "Check at most every 15 seconds").max(86400).default(60),
  timeoutMs: z.coerce.number().int().min(500).max(30000).default(5000)
});

export const endpointUpdateSchema = endpointSchema.partial();
