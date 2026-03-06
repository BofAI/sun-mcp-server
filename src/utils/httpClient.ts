import fetch from 'node-fetch';

/**
 * Fetches content from an HTTP URL
 * @param url The URL to fetch content from
 * @returns The content as a string
 */
export async function fetchFromUrl(url: string): Promise<string> {
  try {
    console.error(`Fetching from URL: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }
    
    const content = await response.text();
    console.error(`Successfully fetched ${content.length} bytes from ${url}`);
    return content;
  } catch (error: any) {
    console.error(`Error fetching from URL ${url}: ${error.message}`);
    throw error;
  }
}

/**
 * Checks if a string is an HTTP or HTTPS URL
 * @param urlOrPath String to check
 * @returns True if the string is an HTTP(S) URL, false otherwise
 */
export function isHttpUrl(urlOrPath: string): boolean {
  return urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://');
}
