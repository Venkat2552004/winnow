/** Public Roar AI gateway settings. Safe to import from any bundle. */

export const ROAR_BASE_URL = 'https://api.roar-ai.com/v1';
export const ROAR_MODEL = 'jev';

export function isRoarBaseUrl(baseUrl: string): boolean {
  return /(^|\.)roar-ai\.com/i.test(baseUrl);
}
