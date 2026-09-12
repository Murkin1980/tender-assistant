import { ConfigService } from '@nestjs/config';

import { createApp } from './app';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
