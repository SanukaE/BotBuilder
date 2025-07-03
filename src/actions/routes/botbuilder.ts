import { RouteType, HTTPMethod } from "#types/RouteType.js";

export const ResDataType = {
  text: "string",
};

const route: RouteType = {
  path: "/botbuilder",
  description: "Get information about BotBuilder.",
  method: HTTPMethod.GET,

  async script(req, res) {
    return res.json({
      text: "BotBuilder is your free, open-source, all-in-one Discord companion made with love by Sanuka. To learn more check out the project on GitHub: https://github.com/SanukaE/BotBuilder/",
    });
  },
};

export default route;
