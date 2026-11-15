import { handleAsNodeRequest } from 'cloudflare:node';
import workerModule from './dist/worker.js';

export default {
  async fetch(request) {
    await workerModule.ensureServer();
    return handleAsNodeRequest(3000, request);
  },
};
