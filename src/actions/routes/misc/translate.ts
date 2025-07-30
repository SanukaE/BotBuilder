import { RouteType, HTTPMethod } from "#types/RouteType.js";
import { translate } from "bing-translate-api";

export const ReqDataType = {
  text: "string",
  currentLanguageCode: "string|undefined",
  toLanguageCode: "string",
};

export const ResDataType = {
  translation: "string",
};

const route: RouteType = {
  path: "/translate",
  description: "Translate text to another language.",
  requireRequestData: true,
  method: HTTPMethod.GET,

  async script(req, res) {
    const translationData = await translate(
      req.body.text,
      req.body.currentLanguageCode,
      req.body.toLanguageCode,
      true
    );

    if (translationData?.correctedText && translationData?.translation)
      return res.status(500).send("Failed to get translation.");

    const responseData = {
      translation:
        translationData?.correctedText || translationData?.translation || "",
    };

    return res.json(responseData);
  },
};

export default route;
