/**
 * Resilient fetch wrapper for all client API requests.
 * Catches network-level rejections (like offline state or momentary disconnects)
 * and returns a standard HTTP 503 Response instead of throwing an unhandled "TypeError: Failed to fetch".
 */
export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Network request failed',
        networkError: true,
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
