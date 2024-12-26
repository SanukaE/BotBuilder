import express from 'express';
import config from '../../../config.json' assert { type: 'json' };
import { LoggerOptions, createLogger } from '#utils/createLogger.js';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { Client } from 'discord.js';
import getAllFiles from '#utils/getAllFiles.js';
import { ActionTypes, getActions } from '#utils/getActions.js';
import { HTTPMethod, RouteType } from '#types/RouteType.js';
import checkEnvVariables from '#utils/checkEnvVariables.js';

const app = express();

export default async function (client: Client) {
  const { webServerPort, disabledCategories } = config;
  const missingVariables = checkEnvVariables();

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

  app.use((req, res, next) => {
    if (!req.baseUrl) next();

    //TODO: API Token verification
  });

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

    let endpointData: string[] = [];

    for (const routeFolderPath of routeFolderPaths) {
      //this is the endpoint category
      const folderName = routeFolderPath.split('\\').pop()!;

      if (
        (disabledCategories as string[]).includes(folderName) ||
        missingVariables.includes(folderName)
      )
        continue;

      const pushData = async (routeFilePaths: string[]) => {
        for (const routeFilePath of routeFilePaths) {
          const fileURL = pathToFileURL(routeFilePath).href;
          const fileExport = await import(fileURL);

          if (fileExport.isDisabled) continue;

          endpointData.push({ folderName, ...fileExport.default });
        }
      };

      const routeFilePaths = getAllFiles(routeFolderPath);
      pushData(routeFilePaths);

      const subRouteCategories = getAllFiles(routeFolderPath, true);
      pushData(subRouteCategories);
    }

    res.json({ endpointData });
  });

  await registerRoutes();

  app.listen(webServerPort);
}

export async function registerRoutes() {
  const routes = (await getActions(ActionTypes.Routes)) as RouteType[];

  for (const route of routes) {
    if (route.isDisabled) continue;

    const debugStream = createLogger(
      `${route.endpoint.replaceAll('/', '_')}-route`,
      LoggerOptions.Debug,
      route.enableDebug
    );

    switch (route.method) {
      case HTTPMethod.GET:
        app.get(`/${route.endpoint}`, async (req, res) => {
          await route.script!(req, res, debugStream);
        });
        break;

      case HTTPMethod.POST:
        app.post(`/${route.endpoint}`, async (req, res) => {
          await route.script!(req, res, debugStream);
        });
        break;

      case HTTPMethod.PATCH:
        app.patch(`/${route.endpoint}`, async (req, res) => {
          await route.script!(req, res, debugStream);
        });
        break;

      case HTTPMethod.DELETE:
        app.delete(`/${route.endpoint}`, async (req, res) => {
          await route.script!(req, res, debugStream);
        });
        break;
    }
  }
}
