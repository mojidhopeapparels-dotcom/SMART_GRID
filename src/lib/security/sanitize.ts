/**
 * Shared security sanitization and SSRF/LIKE-injection guard utilities.
 */

export function escapeLike(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 169 && b === 254) return true; // Link-local 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // Private 172.16.0.0/12
  if (a === 192 && b === 168) return true; // Private 192.168.0.0/16
  if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true; // Benchmarking
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

function isBlockedHostnameOrIp(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return true;
  }
  // IPv4 literal check
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return isBlockedIpv4(host);
  }
  // Numeric / hex / octal shorthand IPv4 tricks (e.g. 2130706433, 0x7f000001)
  if (/^(0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(host)) {
    return true;
  }
  // IPv6 literal checks (contains colon)
  if (host.includes(":")) {
    if (host === "::" || host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
    // IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1
    if (host.startsWith("::ffff:") || host.includes("::ffff:")) {
      const tail = host.split("::ffff:").pop() || "";
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(tail)) {
        return isBlockedIpv4(tail);
      }
      return true;
    }
    // ULA fc00::/7 (fc.. or fd..) and link-local fe80::/10 (fe8., fe9., fea., feb.)
    if (/^(fc|fd)[0-9a-f]{2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)) {
      return true;
    }
  }
  return false;
}

/**
 * Validates that an outbound integration or webhook target is an external HTTPS URL
 * and does not target loopback, private, link-local, or internal hostnames/IPs.
 */
export function isSafeExternalHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    if (isBlockedHostnameOrIp(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
