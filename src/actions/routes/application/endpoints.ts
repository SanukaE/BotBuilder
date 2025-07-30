import { RouteType, HTTPMethod } from "#types/RouteType.js";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

export const ResDataType = {
  routes: "object",
};

const route: RouteType = {
  path: "/endpoints",
  description: "Get's all the API endpoints.",
  followFolders: false,
  isDevOnly: true,
  method: HTTPMethod.GET,

  async script(req, res) {
    const routePath = path.join(process.cwd(), "build/actions/routes");
    let routes: any = [];

    async function addRoutesFromFolders(currentPath: string) {
      const entries = fs.readdirSync(currentPath);

      for (const entryName of entries) {
        const entry = path.join(currentPath, entryName);
        const stat = fs.statSync(entry);

        if (stat.isFile()) {
          const fileURL = pathToFileURL(entry).href;
          const route = (await import(fileURL)).default as RouteType;
          if (route.isDisabled) continue;
          if (route.isDevOnly) continue;

          let routePathStr: string;

          if (
            typeof route.followFolders === "undefined" ||
            route.followFolders
          ) {
            const foldersPaths = entry.split("/");
            const folders = foldersPaths.splice(0, foldersPaths.length - 1);

            const routesIndex = folders.indexOf("routes");
            const filteredFolders = folders.slice(routesIndex + 1);

            routePathStr =
              "/" +
              [...filteredFolders, route.path.replace(/^\//, "")]
                .filter(Boolean)
                .join("/");
          } else routePathStr = route.path;

          const imports = await import(fileURL);

          routes.push([routePathStr, route, imports]);
        } else if (stat.isDirectory()) {
          await addRoutesFromFolders(entry);
        }
      }
    }

    await addRoutesFromFolders(routePath);

    return res.json({ routes });
  },
};

export default route;
