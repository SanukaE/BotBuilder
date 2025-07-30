import type { Request, Response } from "express";

/**
 * Enumeration of HTTP methods supported by the API routes.
 * @enum {string}
 */
export enum HTTPMethod {
  GET = "GET",
  POST = "POST",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

/**
 * Represents the configuration and handler for an API route.
 * @interface
 * @property {string} path - The URL path for the route
 * @property {boolean} [followFolders] - Weather the path so inherit the folder names for the route (default: true)
 * @property {HTTPMethod} method - The HTTP method for this route
 * @property {string} description - A description of what this route does
 * @property {boolean} [requireRequestData] - Weather request data is a must
 * @property {boolean} [isDevOnly] - Whether this route is only available in development mode
 * @property {boolean} [isDisabled] - Whether this route is currently disabled
 * @property {boolean} [isGuildOnly] - Whether this route requires a guild context
 * @property {function} script - The handler function for this route
 */
export type RouteType = {
  path: string;
  followFolders?: boolean;
  method: HTTPMethod;
  description: string;
  requireRequestData?: boolean;
  isDevOnly?: boolean;
  isDisabled?: boolean;
  isGuildOnly?: boolean;
  script: (req: Request, res: Response) => Promise<Response>;
};
