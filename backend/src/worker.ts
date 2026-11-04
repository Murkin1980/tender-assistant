const PORT = 3000;

let bootstrapPromise: Promise<void> | undefined;

export function ensureServer(): Promise<void> {
  bootstrapPromise ??= import('./app').then(async ({ createApp }) => {
    const app = await createApp();
    await app.listen(PORT);
  });
  return bootstrapPromise;
}
