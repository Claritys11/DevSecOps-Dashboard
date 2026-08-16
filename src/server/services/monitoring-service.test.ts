import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import assert from "node:assert/strict";
import { guardedFetch, isBlockedAddress } from "@/server/services/monitoring-service";

test("private networks are blocked by default while cloud metadata stays blocked when private monitoring is enabled", () => {
  const previous = process.env.MONITOR_ALLOW_PRIVATE_NETWORKS;
  delete process.env.MONITOR_ALLOW_PRIVATE_NETWORKS;
  try {
    assert.equal(isBlockedAddress("10.0.0.5"), true);
    assert.equal(isBlockedAddress("192.168.1.10"), true);
    assert.equal(isBlockedAddress("127.0.0.1"), true);
    assert.equal(isBlockedAddress("8.8.8.8"), false);
    assert.equal(isBlockedAddress("10.0.0.5", true), false);
    assert.equal(isBlockedAddress("169.254.169.254", true), true);
    assert.equal(isBlockedAddress("100.100.100.200", true), true);
  } finally {
    if (previous) process.env.MONITOR_ALLOW_PRIVATE_NETWORKS = previous;
  }
});

test("guardedFetch validates redirect targets", async () => {
  const server = http.createServer((_request, response) => {
    response.statusCode = 302;
    response.setHeader("location", "http://169.254.169.254/latest/meta-data/");
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  process.env.MONITOR_ALLOW_PRIVATE_NETWORKS = "true";
  try {
    await assert.rejects(
      guardedFetch(`http://127.0.0.1:${address.port}`, 1000),
      /Blocked monitor target address/
    );
  } finally {
    delete process.env.MONITOR_ALLOW_PRIVATE_NETWORKS;
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
