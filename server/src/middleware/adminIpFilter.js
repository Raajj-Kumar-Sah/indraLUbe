/**
 * Backend IP allowlisting middleware for admin API requests.
 * Configured via ADMIN_ALLOWED_IPS in environment variables.
 * Comma-separated list of IPv4 / IPv6 addresses or CIDR masks.
 * If unset or empty, requests are permitted (suitable for dev/testing
 * or when network perimeter is protected by Cloudflare Zero Trust / VPN).
 */
export function adminIpFilter(req, res, next) {
  const allowedConfig = process.env.ADMIN_ALLOWED_IPS;
  if (!allowedConfig || !allowedConfig.trim()) {
    return next();
  }

  const allowedIps = allowedConfig
    .split(",")
    .map(ip => ip.trim().toLowerCase())
    .filter(Boolean);

  // Read IP from trusted proxy or connection
  const clientIp = (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-real-ip"] ||
    (req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0].trim() : null) ||
    req.ip ||
    req.socket?.remoteAddress ||
    ""
  ).toLowerCase().replace(/^::ffff:/, ""); // Normalize IPv4-mapped IPv6

  const isAllowed = allowedIps.some(allowed => {
    const cleanAllowed = allowed.replace(/^::ffff:/, "");
    if (cleanAllowed === "*" || cleanAllowed === clientIp) return true;
    if (clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "localhost") {
      if (cleanAllowed === "127.0.0.1" || cleanAllowed === "::1" || cleanAllowed === "localhost") return true;
    }
    return false;
  });

  if (!isAllowed) {
    console.warn(`[Security] Blocked unauthorized admin API request from IP: ${clientIp}`);
    return res.status(403).json({
      success: false,
      message: "Access restricted: Your network IP is not authorized to access admin administrative endpoints."
    });
  }

  next();
}
