import { LoggerType } from '#utils/createLogger.js';
import type { Request, Response } from 'express';

export enum HTTPMethod {
  GET = 'GET',
  POST = 'POST',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export type RouteType = {
  name: string;
  method: HTTPMethod;
  description: string;
  requestData?: any;
  responseData: any;
  isDevOnly?: boolean;
  enableDebug?: boolean;
  isDisabled?: boolean;
  isGuildOnly?: boolean;
  script?: (
    req: Request,
    res: Response,
    debugStream: LoggerType
  ) => Promise<void>;
};
