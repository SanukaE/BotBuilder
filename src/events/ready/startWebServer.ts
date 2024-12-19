import express from 'express';
import config from '../../../config.json' assert { type: 'json' };
import { LoggerOptions, createLogger } from '../../utils/createLogger.js';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { Client } from 'discord.js';
import getAllFiles from '../../utils/getAllFiles.js';

export const app = express();

export default async function (client: Client) {
  const { webServerPort } = config;

  if (!webServerPort) {
    const warnLogger = createLogger(
      'startWebServer-readyEvent',
      LoggerOptions.Warning,
      true
    );
    warnLogger.write('Warning: webServerPort is not set in config.json.');
    warnLogger.write(
      'Result: Your operating system will assign an arbitrary unused port.'
    );
    warnLogger.write(
      'Fix: Please allocated a port for the webServer & set it in the config.json file.'
    );
    warnLogger.close();
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const pathToPublic = path.join(__dirname, '..', '..', '..', '..', 'public');

  app.get('/', (req, res) => {
    res.sendFile(path.join(pathToPublic, 'apiEndpoints.html'), (error) => {
      if (!error) return;

      const errorLogger = createLogger(
        'startWebServer-readyEvent',
        LoggerOptions.Error,
        true
      );
      errorLogger.write(`${error.name}: ${error.message}`);
      errorLogger.close();
    });
  });

  app.get('/endpoints', async (req, res) => {
    const routeFolderPaths = getAllFiles(
      path.join(__dirname, '..', '..', 'actions', 'routes'),
      true
    );

    let endpointData = [];

    for (const routeFolderPath of routeFolderPaths) {
      //this is the endpoint category
      const folderName = routeFolderPath.split('\\').pop();

      const routeFilePaths = getAllFiles(routeFolderPath);

      for (const routeFilePath of routeFilePaths) {
        const fileURL = pathToFileURL(routeFilePath).href;

        const fileExport = await import(fileURL);
        endpointData.push({ folderName, ...fileExport.default });
      }
    }

    res.json({ endpointData });
  });

  app.use((req, res, next) => {
    if (!req.baseUrl) next();

    //TODO: API Token verification
  });

  app.listen(webServerPort);
}
