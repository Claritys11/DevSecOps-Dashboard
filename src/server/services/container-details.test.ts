import test from "node:test";
import assert from "node:assert/strict";
import { demuxDockerLogs, formatActionLogLine, formatPorts, isSafeProjectDir, parseComposeLabels, toContainerDetails } from "@/server/services/container-details";

test("compose labels give the project folder and files", () => {
  const compose = parseComposeLabels({
    "com.docker.compose.project": "mic",
    "com.docker.compose.service": "mongo",
    "com.docker.compose.project.working_dir": "/srv/mic",
    "com.docker.compose.project.config_files": "/srv/mic/docker-compose.yml,/srv/mic/override.yml"
  });
  assert.deepEqual(compose, { project: "mic", service: "mongo", workingDir: "/srv/mic", configFiles: ["/srv/mic/docker-compose.yml", "/srv/mic/override.yml"] });
  assert.equal(parseComposeLabels({ maintainer: "someone" }), null);
  assert.equal(parseComposeLabels(null), null);
});

test("ports merge IPv4 and IPv6 bindings and show local-only and internal ports", () => {
  assert.deepEqual(
    formatPorts([
      { IP: "0.0.0.0", PrivatePort: 3000, PublicPort: 3003, Type: "tcp" },
      { IP: "::", PrivatePort: 3000, PublicPort: 3003, Type: "tcp" },
      { IP: "127.0.0.1", PrivatePort: 27017, PublicPort: 27017, Type: "tcp" },
      { PrivatePort: 8080, Type: "tcp" }
    ]),
    ["3003 → 3000/tcp", "127.0.0.1:27017 → 27017/tcp", "8080/tcp (internal)"]
  );
});

test("details expose environment names but never their values", () => {
  const details = toContainerDetails({
    Id: "abc",
    Name: "/web",
    State: { Status: "running", StartedAt: "2026-01-01T00:00:00Z", FinishedAt: "0001-01-01T00:00:00Z" },
    Config: { Image: "nginx", Env: ["DB_PASSWORD=hunter2", "A=1=2"] },
    NetworkSettings: { Ports: { "80/tcp": [{ HostIp: "0.0.0.0", HostPort: "8080" }], "443/tcp": null } }
  });
  assert.equal(details.name, "web");
  assert.deepEqual(details.envNames, ["A", "DB_PASSWORD"]);
  assert.doesNotMatch(JSON.stringify(details), /hunter2/);
  assert.deepEqual(details.ports, ["8080 → 80/tcp", "443/tcp (internal)"]);
  assert.equal(details.finishedAt, null);
});

test("only absolute normalized folders can be mounted", () => {
  assert.equal(isSafeProjectDir("/srv/app"), true);
  for (const dir of ["/", "", null, "relative/path", "/srv/../etc"]) assert.equal(isSafeProjectDir(dir), false, String(dir));
});

test("a reason with line breaks cannot forge a log entry", () => {
  const line = formatActionLogLine({ at: new Date("2026-01-01T00:00:00Z"), action: "restart", containerName: "web", user: "a@b.c", reason: "new config\n2026\tfake\tentry" });
  assert.equal(line.split("\n").length, 1);
  assert.equal(line.split("\t").length, 5);
});

test("docker log stream headers are removed and TTY logs pass through", () => {
  const frame = (stream: number, text: string) => {
    const header = Buffer.alloc(8);
    header[0] = stream;
    header.writeUInt32BE(Buffer.byteLength(text), 4);
    return Buffer.concat([header, Buffer.from(text)]);
  };
  assert.equal(demuxDockerLogs(Buffer.concat([frame(1, "out\n"), frame(2, "err\n")])), "out\nerr\n");
  assert.equal(demuxDockerLogs(Buffer.from("plain tty output\n")), "plain tty output\n");
  assert.equal(demuxDockerLogs(Buffer.alloc(0)), "");
});
