import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { ServiceStatus, type SslCertificateCheck } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { evaluateEndpointAlert, evaluateSslAlert } from "@/server/services/alert-service";

const defaultTimeoutMs = Number(process.env.MONITORING_DEFAULT_TIMEOUT_MS ?? 5000);
const allowPrivateNetworks = process.env.MONITOR_ALLOW_PRIVATE_NETWORKS !== "false";
const redirectLimit = Number(process.env.MONITOR_REDIRECT_LIMIT ?? 3);

export async function checkEndpoint(endpointId: string) {
  const endpoint = await prisma.monitoredEndpoint.findUniqueOrThrow({ where: { id: endpointId } });
  const started = Date.now();

  try {
    const response = await guardedFetch(endpoint.url, endpoint.timeoutMs ?? defaultTimeoutMs);
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
        error: error instanceof Error ? error.message : "Unknown error"
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

  await validateMonitorUrl(endpoint.url);

  return new Promise<SslCertificateCheck>((resolve, reject) => {
    const socket = tls.connect(
      {
        host: url.hostname,
        port: Number(url.port || 443),
        servername: url.hostname,
        timeout: endpoint.timeoutMs ?? defaultTimeoutMs
      },
      async () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
        const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
        const daysUntilExpiry = validTo ? differenceInCalendarDays(validTo, new Date()) : null;
        const status = daysUntilExpiry == null ? ServiceStatus.UNKNOWN : daysUntilExpiry < 14 ? ServiceStatus.DEGRADED : ServiceStatus.HEALTHY;

        const issuerValue = typeof cert.issuer === "object" ? cert.issuer.O : undefined;
        const issuer = Array.isArray(issuerValue) ? issuerValue.join(", ") : issuerValue;

        const check = await prisma.sslCertificateCheck.create({
            data: {
              endpointId,
              issuer,
              validFrom,
              validTo,
              daysUntilExpiry,
              fingerprint: cert.fingerprint256,
              status
            }
          });
        await evaluateSslAlert(endpointId, check);
        resolve(check);
      }
    );

    socket.on("timeout", async () => {
      socket.destroy();
      const check = await prisma.sslCertificateCheck.create({
          data: { endpointId, status: ServiceStatus.DOWN, error: "TLS connection timed out" }
        });
      await evaluateSslAlert(endpointId, check);
      resolve(check);
    });

    socket.on("error", async (error) => {
      reject(error);
    });
  }).catch(async (error) => {
    const check = await prisma.sslCertificateCheck.create({
      data: {
        endpointId,
        status: ServiceStatus.DOWN,
        error: error instanceof Error ? error.message : "Unknown TLS error"
      }
    });
    await evaluateSslAlert(endpointId, check);
    return check;
  });
}

async function guardedFetch(initialUrl: string, requestTimeoutMs: number) {
  let currentUrl = initialUrl;

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

async function validateMonitorUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS monitors are allowed");
  }

  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("Hostname did not resolve");
  }

  for (const address of addresses) {
    if (isBlockedAddress(address.address)) {
      throw new Error("Blocked monitor target address");
    }
  }
}

function isBlockedAddress(address: string) {
  if (address === "169.254.169.254" || address === "100.100.100.200") {
    return true;
  }

  if (allowPrivateNetworks) return false;

  const version = net.isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127 || (a === 169 && b === 254);
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80");
  }

  return false;
}
