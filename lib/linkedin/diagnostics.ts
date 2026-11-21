export const DIAGNOSE_MESSAGE = 'linkedin:diagnose';
export const TEST_BLUR_MESSAGE = 'linkedin:test-blur';
export const PROBE_MESSAGE = 'linkedin:probe';
export const RESET_MESSAGE = 'linkedin:reset';

export interface TestBlurResult {
  ok: boolean;
  urn?: string;
  error?: string;
}

export interface LinkedInDiagnostics {
  loaded: true;
  active: boolean;
  /** Post roots found in the last scan. */
  roots: number;
  /** Posts that produced a score. */
  scored: number;
  blurred: number;
  revealed: number;
  lastError: string | null;
  sample: { urn: string; textLength: number; author: string } | null;
}
