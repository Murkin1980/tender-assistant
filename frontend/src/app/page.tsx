'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

type HealthResponse = {
  status: 'ok';
  service: string;
  timestamp: string;
};

type HealthState = 'loading' | 'available' | 'unavailable';

const healthUrl = '/api/v1/health';

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
    loading: 'Проверяем доступность сервера…',
    available: 'Сервер доступен',
    unavailable: 'Сервер временно недоступен',
  }[healthState];

  return (
    <main className="page-shell">
      <section className="card" aria-labelledby="page-title">
        <p className="eyebrow">Среда разработки</p>
        <h1 id="page-title">Tender Assistant</h1>
        <p className="intro">Основа для проверяемого процесса анализа тендеров.</p>
        <p className={`status status-${healthState}`} role="status" aria-live="polite">
          <span aria-hidden="true" className="status-dot" />
          {statusMessage}
        </p>
      </section>
    </main>
  );
}
