/** 避免 /api 在服务端挂死时前端无限等待 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 45000, signal: outerSignal, ...rest } = init;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  outerSignal?.addEventListener('abort', onAbort, { once: true });
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
    outerSignal?.removeEventListener('abort', onAbort);
  }
}
