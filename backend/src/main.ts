import { createApp } from './app';
import configuration from './configuration';

async function bootstrap(): Promise<void> {
  const { port } = configuration();
  const app = await createApp();

  await app.listen(port, '0.0.0.0');
}

function handleBootstrapFailure(): void {
  console.error('[bootstrap] API failed to start');
  process.exitCode = 1;
}

void bootstrap().catch(handleBootstrapFailure);
