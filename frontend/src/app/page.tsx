'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

type HealthResponse = {
  status: 'ok';
  service: string;
  timestamp: string;
};

type HealthState = 'loading' | 'available' | 'unavailable';

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api').replace(/\/$/, '');
const healthUrl = `${apiBaseUrl}/v1/health`;

function isHealthResponse(payload: unknown): payload is HealthResponse {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'status' in payload &&
    payload.status === 'ok' &&
    'service' in payload &&
    typeof payload.service === 'string' &&
    'timestamp' in payload &&
    typeof payload.timestamp === 'string'
  );
}

export default function Home(): ReactElement {
  const [healthState, setHealthState] = useState<HealthState>('loading');

  useEffect(() => {
    let isCurrent = true;

    async function checkHealth(): Promise<void> {
      try {
        const response = await fetch(healthUrl, {
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Health endpoint returned a non-success status');
        }

        const payload: unknown = await response.json();

        if (!isHealthResponse(payload)) {
          throw new Error('Health endpoint returned an unexpected response');
        }

        if (isCurrent) {
          setHealthState('available');
        }
      } catch {
        if (isCurrent) {
          setHealthState('unavailable');
        }
      }
    }

    void checkHealth();

    return () => {
      isCurrent = false;
    };
  }, []);

  const statusMessage = {
    loading: 'Checking backend availability…',
    available: 'Backend is available',
    unavailable: 'Backend is temporarily unavailable',
  }[healthState];

  return (
    <main className="page-shell">
      <section className="card" aria-labelledby="page-title">
        <p className="eyebrow">Development environment</p>
        <h1 id="page-title">Tender Assistant</h1>
        <p className="intro">A foundation for a verifiable tender analysis workflow.</p>
        <p className={`status status-${healthState}`} role="status" aria-live="polite">
          <span aria-hidden="true" className="status-dot" />
          {statusMessage}
        </p>
      </section>
    </main>
  );
}
