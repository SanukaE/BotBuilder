import getAllFiles from "./getAllFiles.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export default function getConfig(...modules: string[]) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const configDir = path.join(__dirname, "../../configs");

  if (!fs.existsSync(configDir))
    throw new Error(
      "No configs directory found. Please ensure 'configs' or 'configs.template' directory exists."
    );

  const configs = getAllFiles(configDir);
  const requiredConfigs = configs.filter((file) => {
    const fileName = path.basename(file, ".json"); // Get filename without extension
    return modules.some(
      (module) => fileName === module || fileName.startsWith(module)
    );
  });

  let configProperties = {};

  for (const configFile of requiredConfigs) {
    try {
      const fileContent = fs.readFileSync(configFile, "utf-8");
      const parsedConfig = JSON.parse(fileContent);

      const properties = parsedConfig[0];

      if (properties && typeof properties === "object") {
        configProperties = { ...configProperties, ...properties };
      }
    } catch (error) {
      console.error(`[Error] Failed to read config file ${configFile}:`, error);
    }
  }

  return configProperties;
}
