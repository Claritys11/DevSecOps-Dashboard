import Docker from "dockerode";

export function createDockerClient(endpoint?: string | null) {
  if (endpoint?.startsWith("tcp://")) {
    const url = new URL(endpoint);
    return new Docker({
      host: url.hostname,
      port: Number(url.port),
      protocol: "http"
    });
  }

  return new Docker({
    socketPath: endpoint || process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock"
  });
}

export function normalizeContainerName(names?: string[]) {
  return names?.[0]?.replace(/^\//, "") ?? "unnamed";
}
