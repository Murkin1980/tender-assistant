import { getCloudflareContext } from '@opennextjs/cloudflare';

type BackendBinding = {
  fetch(request: Request): Promise<Response>;
};

type WorkerEnv = {
  BACKEND?: BackendBinding;
};

export async function fetchBackend(path: string, init: RequestInit = {}): Promise<Response> {
  const configuredUrl = process.env.BACKEND_INTERNAL_URL?.trim();
  if (configuredUrl) {
    return fetch(`${configuredUrl.replace(/\/+$/, '')}${path}`, init);
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const backend = (env as WorkerEnv).BACKEND;
    if (backend) {
      return backend.fetch(new Request(`https://backend.internal${path}`, init));
    }
  } catch {
    // Outside Workers (Next.js development and the Docker fallback), use the local backend.
  }

  return fetch(`http://localhost:3000${path}`, init);
}
