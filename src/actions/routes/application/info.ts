import { RouteType, HTTPMethod } from "#types/RouteType.js";
import client from "#libs/Client.js";

export const ResDataType = {
  displayName: "string",
  username: "string",
  id: "string",
  avatarURL: "string",
  bannerURL: "string",
};

const route: RouteType = {
  path: "/info",
  description: "Gets all the data about the bot.",
  followFolders: false,
  isDevOnly: true,
  isGuildOnly: true,
  method: HTTPMethod.GET,

  async script(req, res) {
    return res.json({
      displayName: client.user?.displayName || "BotBuilder",
      username: client.user?.username || "BotBuilder",
      id: client.user?.id || "N/A",
      avatarURL: client.user?.avatarURL() || "",
      bannerURL: client.user?.bannerURL() || "",
    });
  },
};

export default route;
