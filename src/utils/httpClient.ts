import fetch from "node-fetch";

const DEFAULT_FETCH_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }

  // Basic private IPv4 detection for literal IP hosts.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split(".").map((n) => Number(n));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }

  return false;
}

/**
 * Fetches content from an HTTP URL
 * @param url The URL to fetch content from
 * @returns The content as a string
 */
export async function fetchFromUrl(url: string): Promise<string> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
    }
    if (process.env.ALLOW_PRIVATE_URLS !== "true" && isPrivateOrLocalHost(parsed.hostname)) {
      throw new Error(`Blocked private/local URL host: ${parsed.hostname}`);
    }

    const timeoutMs = Number(process.env.FETCH_TIMEOUT_MS || DEFAULT_FETCH_TIMEOUT_MS);
    const maxBytes = Number(process.env.FETCH_MAX_BYTES || DEFAULT_MAX_BYTES);
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), timeoutMs);

    console.error(`Fetching from URL: ${url}`);
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    const content = await response.text();
    if (content.length > maxBytes) {
      throw new Error(`Response too large: ${content.length} bytes (max ${maxBytes})`);
    }
    console.error(`Successfully fetched ${content.length} bytes from ${url}`);
    return content;
  } catch (error: any) {
    console.error(`Error fetching from URL ${url}: ${error.message}`);
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Checks if a string is an HTTP or HTTPS URL
 * @param urlOrPath String to check
 * @returns True if the string is an HTTP(S) URL, false otherwise
 */
export function isHttpUrl(urlOrPath: string): boolean {
  return urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://");
}
