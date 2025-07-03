import { RouteType, HTTPMethod } from "#types/RouteType.js";
import path from "path";
import fs from "fs";

export const ResDataType = {
  configs: "object[]",
};

const route: RouteType = {
  path: "/configurations",
  description: "Gets all the data from the config files.",
  followFolders: false,
  isDevOnly: true,
  isGuildOnly: true,
  method: HTTPMethod.GET,

  async script(req, res) {
    const configsDir = path.join(process.cwd(), "configs");
    const files = fs.readdirSync(configsDir).filter((f) => f.endsWith(".json"));
    const configs = files.map((filename) => {
      const filePath = path.join(configsDir, filename);
      const content = fs.readFileSync(filePath, "utf-8");
      let data;
      try {
        data = JSON.parse(content.replace(/^\s*\/\/.*$/gm, "")); // Remove comments if any
      } catch (e) {
        data = null;
      }
      return {
        name: filename.replace(/\.json$/, ""),
        data,
      };
    });

    return res.json({ configs });
  },
};

export default route;
