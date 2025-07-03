import { RouteType, HTTPMethod } from "#types/RouteType.js";
import path from "path";
import fs from "fs";

export const ReqDataType = {
  fileName: "string",
  formData: "object",
};

export const ResDataType = {
  success: "boolean",
  message: "string",
};

const route: RouteType = {
  path: "/configuration-save",
  description: "Save data to config file.",
  requireRequestData: true,
  followFolders: false,
  isDevOnly: true,
  isGuildOnly: true,
  method: HTTPMethod.POST,

  async script(req, res) {
    const { fileName, formData } = req.body;

    if (!fileName || !formData) {
      return res.status(400).send("Missing file name or form data.");
    }

    const configsDir = path.join(process.cwd(), "configs");
    const filePath = path.join(configsDir, `${fileName}.json`);

    try {
      const fileData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      fileData[0] = formData;

      fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), "utf-8");
      return res.json({
        success: true,
        message: "Configuration saved successfully.",
      });
    } catch (e) {
      return res.status(500).send("Failed to save configuration.");
    }
  },
};

export default route;
