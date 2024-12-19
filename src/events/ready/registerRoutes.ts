import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import getAllFiles from '../../utils/getAllFiles.js';
import { Client } from 'discord.js';
import { app } from './startWebServer.js';
import { Router } from 'express';

export default async function (client: Client) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const routeCategories = getAllFiles(
    path.join(__dirname, '..', '..', 'actions', 'routes'),
    true
  );

  for (const routeCategory of routeCategories) {
    const endpoint = `/${routeCategory.split('\\').pop()!}`;
    const endpointPaths = getAllFiles(routeCategory);

    const router = Router();

    for (const endpointPath of endpointPaths) {
      const endpointURL = pathToFileURL(endpointPath).href;
      const endpointExport = await import(endpointURL);

      const { name, method, script } = endpointExport.default;

      switch (method) {
        case 'GET':
          router.get(`/${name}`, script);
          break;

        case 'POST':
          router.post(`/${name}`, script);
          break;

        case 'PATCH':
          router.patch(`/${name}`, script);
          break;

        case 'DELETE':
          router.delete(`/${name}`, script);
          break;
      }
    }

    app.use(endpoint, router);
  }
}
