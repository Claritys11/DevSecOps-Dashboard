import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { ServiceStatus, type SslCertificateCheck } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { evaluateEndpointAlert, evaluateSslAlert } from "@/server/services/alert-service";

const cloudMetadataAddresses = new Set(["169.254.169.254", "100.100.100.200"]);

function monitoringConfig() {
  return {
    defaultTimeoutMs: Number(process.env.MONITORING_DEFAULT_TIMEOUT_MS ?? 5000),
    allowPrivateNetworks: process.env.MONITOR_ALLOW_PRIVATE_NETWORKS === "true",
    redirectLimit: Number(process.env.MONITOR_REDIRECT_LIMIT ?? 3)
  };
}

export async function checkEndpoint(endpointId: string) {
  const endpoint = await prisma.monitoredEndpoint.findUniqueOrThrow({ where: { id: endpointId } });
  const started = Date.now();

  try {
    const response = await guardedFetch(endpoint.url, endpoint.timeoutMs ?? monitoringConfig().defaultTimeoutMs);
    const responseTimeMs = Date.now() - started;
    const status = response.status === endpoint.expectedStatus ? ServiceStatus.HEALTHY : ServiceStatus.DEGRADED;
    const isSuccess = status === ServiceStatus.HEALTHY;
    const nextCheckAt = new Date(Date.now() + endpoint.intervalSeconds * 1000);

    const check = await prisma.endpointCheck.create({
      data: {
        endpointId,
        status,
        statusCode: response.status,
        responseTimeMs
      }
    });

    await prisma.monitoredEndpoint.update({
      where: { id: endpointId },
      data: {
        status,
        lastCheckedAt: new Date(),
        lastSuccessAt: isSuccess ? new Date() : endpoint.lastSuccessAt,
        nextCheckAt,
        consecutiveFailures: isSuccess ? 0 : { increment: 1 }
      }
    });

    await evaluateEndpointAlert(endpointId, check);
    return check;
  } catch (error) {
    const nextCheckAt = new Date(Date.now() + endpoint.intervalSeconds * 1000);
    const check = await prisma.endpointCheck.create({
      data: {
        endpointId,
        status: ServiceStatus.DOWN,
        error: describeNetworkError(error)
      }
    });

    await prisma.monitoredEndpoint.update({
      where: { id: endpointId },
      data: {
        status: ServiceStatus.DOWN,
        lastCheckedAt: new Date(),
        nextCheckAt,
        consecutiveFailures: { increment: 1 }
      }
    });

    await evaluateEndpointAlert(endpointId, check);
    return check;
  }
}

export async function checkSslCertificate(endpointId: string): Promise<SslCertificateCheck> {
  const endpoint = await prisma.monitoredEndpoint.findUniqueOrThrow({ where: { id: endpointId } });
  const url = new URL(endpoint.url);

  if (url.protocol !== "https:") {
    const check = await prisma.sslCertificateCheck.create({
      data: {
        endpointId,
        status: ServiceStatus.UNKNOWN,
        error: "Endpoint is not HTTPS"
      }
    });
    await evaluateSslAlert(endpointId, check);
    return check;
  }

  try {
    await validateMonitorUrl(endpoint.url);
  } catch (error) {
    const check = await prisma.sslCertificateCheck.create({ data: { endpointId, status: ServiceStatus.DOWN, error: describeNetworkError(error) } });
    await evaluateSslAlert(endpointId, check);
    return check;
  }

  const timeoutMs = endpoint.timeoutMs ?? monitoringConfig().defaultTimeoutMs;
  const result = await new Promise<{ cert: tls.PeerCertificate } | { error: string }>((resolve) => {
    let settled = false;
    const finish = (value: { cert: tls.PeerCertificate } | { error: string }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    const socket = tls.connect(
      {
        host: url.hostname,
        port: Number(url.port || 443),
        // SNI must not be an IP address.
        servername: net.isIP(url.hostname) ? undefined : url.hostname,
        timeout: timeoutMs
      },
      () => finish({ cert: socket.getPeerCertificate() })
    );
    // Without the settled guard, the idle timeout fired after a successful handshake and recorded a false failure.
    socket.on("timeout", () => finish({ error: "TLS connection timed out" }));
    socket.on("error", (error) => finish({ error: describeNetworkError(error) }));
  });

  if ("error" in result) {
    const check = await prisma.sslCertificateCheck.create({ data: { endpointId, status: ServiceStatus.DOWN, error: result.error } });
    await evaluateSslAlert(endpointId, check);
    return check;
  }

  const { cert } = result;
  const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
  const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
  const daysUntilExpiry = validTo ? differenceInCalendarDays(validTo, new Date()) : null;
  const sslWarnDays = Number(process.env.ALERT_SSL_EXPIRING_DAYS ?? 14);
  const status = daysUntilExpiry == null ? ServiceStatus.UNKNOWN : daysUntilExpiry < sslWarnDays ? ServiceStatus.DEGRADED : ServiceStatus.HEALTHY;
  const issuerValue = typeof cert.issuer === "object" ? cert.issuer.O : undefined;
  const issuer = Array.isArray(issuerValue) ? issuerValue.join(", ") : issuerValue;

  const check = await prisma.sslCertificateCheck.create({
    data: { endpointId, issuer, validFrom, validTo, daysUntilExpiry, fingerprint: cert.fingerprint256, status }
  });
  await evaluateSslAlert(endpointId, check);
  return check;
}

const networkErrors: Record<string, string> = {
  ECONNREFUSED: "Connection refused. Nothing is listening on that port.",
  ECONNRESET: "The connection was reset by the server.",
  ENOTFOUND: "Hostname does not resolve.",
  EAI_AGAIN: "DNS lookup failed (temporary). Check the worker's DNS.",
  EHOSTUNREACH: "Host is unreachable from the dashboard.",
  ENETUNREACH: "Network is unreachable from the dashboard.",
  ETIMEDOUT: "Connection timed out.",
  CERT_HAS_EXPIRED: "TLS certificate has expired.",
  DEPTH_ZERO_SELF_SIGNED_CERT: "TLS certificate is self-signed.",
  SELF_SIGNED_CERT_IN_CHAIN: "TLS certificate chain contains a self-signed certificate.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "TLS certificate cannot be verified.",
  ERR_TLS_CERT_ALTNAME_INVALID: "TLS certificate does not match the hostname."
};

/** Node's fetch reports "fetch failed" and hides the real reason in `cause`. */
export function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  if (error.name === "TimeoutError" || error.name === "AbortError") return "Request timed out.";
  const cause = (error as Error & { cause?: unknown }).cause;
  const code = (cause as { code?: string } | undefined)?.code ?? (error as Error & { code?: string }).code;
  if (code && networkErrors[code]) return networkErrors[code];
  if (cause instanceof Error && cause.message === "bad port") {
    return "This port is on the fetch blocked-ports list (for example 9, 25, 6000). Use a different port.";
  }
  if (cause instanceof Error && cause.message) return cause.message;
  return error.message;
}

export async function guardedFetch(initialUrl: string, requestTimeoutMs: number) {
  let currentUrl = initialUrl;
  const { redirectLimit } = monitoringConfig();

  for (let redirectCount = 0; redirectCount <= redirectLimit; redirectCount++) {
    await validateMonitorUrl(currentUrl);
    const response = await fetch(currentUrl, {
      signal: AbortSignal.timeout(requestTimeoutMs),
      cache: "no-store",
      redirect: "manual"
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) return response;
    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error("Redirect limit exceeded");
}

export async function validateMonitorUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS monitors are allowed");
  }

  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("Hostname did not resolve");
  }

  for (const address of addresses) {
    if (isBlockedAddress(address.address, monitoringConfig().allowPrivateNetworks)) {
      throw new Error("Blocked monitor target address");
    }
  }
}

export function isBlockedAddress(address: string, allowPrivateNetworks = process.env.MONITOR_ALLOW_PRIVATE_NETWORKS === "true") {
  if (cloudMetadataAddresses.has(address)) {
    return true;
  }

  const version = net.isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    const privateOrLocal = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127 || (a === 169 && b === 254);
    return allowPrivateNetworks ? false : privateOrLocal;
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    const privateOrLocal = normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80");
    return allowPrivateNetworks ? false : privateOrLocal;
  }

  return false;
}
