import { RouteType, HTTPMethod } from "#types/RouteType.js";
import path from "path";
import fs from "fs";

export const ResDataType = {
  configs: "object[]",
};

const route: RouteType = {
  path: "/transcript/:channelId/download",
  description: "Downloads transcript file.",
  followFolders: false,
  isDevOnly: true,
  isGuildOnly: true,
  method: HTTPMethod.GET,

  async script(req, res) {
    const transcriptPath = path.join(
      process.cwd(),
      "localData",
      "ticketTranscripts"
    );
    const channelId = req.params.channelId;

    let transcriptFile: string | undefined;
    let transcriptCategory: string | undefined;

    for (const category of fs.readdirSync(transcriptPath)) {
      const transcriptFiles = fs.readdirSync(
        path.join(transcriptPath, category)
      );

      if (transcriptFiles.some((file) => file.includes(channelId))) {
        transcriptFile = transcriptFiles.find((file) =>
          file.includes(channelId)
        );
        transcriptCategory = category;
        break;
      }
    }

    if (!transcriptFile || !transcriptCategory)
      return res.status(404).json({
        error: "Transcript not found for the specified channel.",
      });

    const transcriptFilePath = path.join(
      transcriptPath,
      transcriptCategory,
      transcriptFile
    );
    return res.download(transcriptFilePath);
  },
};

export default route;
