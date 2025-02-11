import { LoggerType } from '#utils/createLogger.js';
import type { Request, Response } from 'express';

/**
 * Enumeration of HTTP methods supported by the API routes.
 * @enum {string}
 */
export enum HTTPMethod {
  GET = 'GET',
  POST = 'POST',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

/**
 * Represents the configuration and handler for an API route.
 * @interface
 * @property {string} endpoint - The URL path for the route
 * @property {HTTPMethod} method - The HTTP method for this route
 * @property {string} description - A description of what this route does
 * @property {any} [requestData] - Optional type definition for expected request data
 * @property {any} responseData - Type definition for the response data
 * @property {boolean} [isDevOnly] - Whether this route is only available in development mode
 * @property {boolean} [enableDebug] - Whether debug logging is enabled for this route
 * @property {boolean} [isDisabled] - Whether this route is currently disabled
 * @property {boolean} [isGuildOnly] - Whether this route requires a guild context
 * @property {function} script - The handler function for this route
 */
export type RouteType = {
  endpoint: string;
  method: HTTPMethod;
  description: string;
  requestData?: any;
  responseData: any;
  isDevOnly?: boolean;
  enableDebug?: boolean;
  isDisabled?: boolean;
  isGuildOnly?: boolean;
  script: (
    req: Request,
    res: Response,
    debugStream: LoggerType
  ) => Promise<void>;
};
