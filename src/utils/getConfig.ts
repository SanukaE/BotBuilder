import getAllFiles from "./getAllFiles.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export default function getConfig(...modules: string[]) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const configs = getAllFiles(path.join(__dirname, "../../configs"));
    const requiredConfigs = configs.filter(file => {
        const fileName = file.split("/").pop()!;
        return modules.some(module => fileName.startsWith(module));
    });

    let configProperties = {};

    for(const configFile of requiredConfigs) {
        const properties = JSON.parse(fs.readFileSync(configFile, 'utf-8'))[0];

        configProperties = {...configProperties, ...properties};
    }

    return configProperties;
};