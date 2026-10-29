import test from "node:test";
import assert from "node:assert/strict";
import { containerCrashed } from "@/server/services/alert-service";

test("only non-zero exits and dead containers count as crashed", () => {
  assert.equal(containerCrashed("running", "Up 3 hours"), false);
  assert.equal(containerCrashed("exited", "Exited (0) 4 days ago"), false);
  assert.equal(containerCrashed("exited", "Exited (255) 4 days ago"), true);
  assert.equal(containerCrashed("exited", "Exited (137) 1 minute ago"), true);
  assert.equal(containerCrashed("dead", "Dead"), true);
});
