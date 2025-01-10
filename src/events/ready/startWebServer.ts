import express, { Request, Response } from 'express';
import config from '../../../config.json' assert { type: 'json' };
import { LoggerOptions, createLogger } from '#utils/createLogger.js';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { Client } from 'discord.js';
import getAllFiles from '#utils/getAllFiles.js';
import { ActionTypes, getActions } from '#utils/getActions.js';
import { HTTPMethod, RouteType } from '#types/RouteType.js';
import checkEnvVariables from '#utils/checkEnvVariables.js';
import MySQL from '#libs/MySQL.js';
import { RowDataPacket } from 'mysql2';
import getErrorSolution from '#utils/getErrorSolution.js';

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

  app.use(async (req, res, next) => {
    if (req.url === '/' || req.url === '/endpoints') {
      next();
      return;
    }

    const apiKey = req.headers.authorization;

    const [rows] = await MySQL.query<RowDataPacket[]>(
      'SELECT userID FROM api_keys WHERE apiKey = ?',
      [apiKey]
    );

    if (!rows.length) {
      res.status(401).json({
        success: false,
        message: 'Key not found.',
      });
      return;
    } else {
      if (rows[0].keyStatus === 'REVOKED') {
        res.status(401).json({
          success: false,
          message: 'Contact a staff member.',
        });
        return;
      }
    }

    req.params.apiUserID = rows[0].userID;
    next();
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const pathToPublic = path.join(__dirname, '..', '..', '..', 'public');

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

    let endpointData: any[] = [];

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

          if (fileExport.default.isDisabled) continue;

          endpointData.push({ folderName, ...fileExport.default });
        }
      };

      const routeFilePaths = getAllFiles(routeFolderPath);
      await pushData(routeFilePaths);

      const subRouteCategories = getAllFiles(routeFolderPath, true);
      await pushData(subRouteCategories);
    }

    res.json({ endpointData });
  });

  await registerRoutes(client);

  app.listen(webServerPort);
}

export async function registerRoutes(client: Client) {
  const routes = (await getActions(ActionTypes.Routes)) as RouteType[];
  const { developmentGuildID } = config;

  for (const route of routes) {
    if (route.isDisabled) continue;

    const routeScript = async (req: Request, res: Response) => {
      const apiUserID = req.params.apiUserID;
      const devGuild = await client.guilds.fetch(developmentGuildID);
      const developer = await devGuild.members.fetch(apiUserID);

      if (route.isDevOnly && !developer) {
        res.status(401).json({
          success: false,
          message: 'This endpoint is only available to developers.',
        });
        return;
      }

      if (route.isGuildOnly) {
        const userGuilds = client.guilds.cache.filter((guild) =>
          guild.members.cache.has(apiUserID)
        );

        if (userGuilds.size === 0) {
          res.status(401).json({
            success: false,
            message:
              'This endpoint requires you to be in a server thats using BotBuilder.',
          });
          return;
        }
      }

      const debugStream = createLogger(
        `${route.endpoint.replaceAll('/', '_')}-route`,
        LoggerOptions.Debug,
        route.enableDebug
      );

      try {
        await route.script(req, res, debugStream);
      } catch (error) {
        debugStream.close();

        const errorLogger = createLogger(
          `${route.endpoint.replaceAll('/', '_')}-route`,
          LoggerOptions.Error,
          true
        );
        errorLogger.write(error);
        errorLogger.close();

        const solution = await getErrorSolution(route, ActionTypes.Routes);

        if (solution) {
          res.status(500).json({
            success: false,
            message: 'An error occurred while processing your request.',
            error: error,
            solution,
          });
        } else if (route.enableDebug && route.isDevOnly) {
          res.status(500).json({
            success: false,
            message: 'An error occurred while processing your request.',
            error: error,
            solution: 'No possible fix found.',
          });
        }

        res.status(500).json({
          success: false,
          message: 'An error occurred while processing your request.',
          error: error,
        });
      } finally {
        debugStream.close();
      }
    };

    switch (route.method) {
      case HTTPMethod.GET:
        app.get(`/${route.endpoint}`, routeScript);
        break;

      case HTTPMethod.POST:
        app.post(`/${route.endpoint}`, routeScript);
        break;

      case HTTPMethod.PATCH:
        app.patch(`/${route.endpoint}`, routeScript);
        break;

      case HTTPMethod.DELETE:
        app.delete(`/${route.endpoint}`, routeScript);
        break;
    }
  }
}
