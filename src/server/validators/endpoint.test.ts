import test from "node:test";
import assert from "node:assert/strict";
import { endpointSchema, endpointUpdateSchema } from "@/server/validators/endpoint";

test("endpoint updates only contain the fields that were sent", () => {
  assert.deepEqual(endpointUpdateSchema.parse({ enabled: false }), { enabled: false });
});

test("new endpoints get defaults", () => {
  const parsed = endpointSchema.parse({ name: "Example", url: "https://example.com" });
  assert.equal(parsed.intervalSeconds, 60);
  assert.equal(parsed.expectedStatus, 200);
  assert.equal(parsed.enabled, true);
});

test("only http and https URLs are accepted", () => {
  assert.equal(endpointSchema.safeParse({ name: "Example", url: "ftp://example.com" }).success, false);
});
