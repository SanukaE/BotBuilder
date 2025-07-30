import Gemini from "#libs/Gemini.js";
import { RouteType, HTTPMethod } from "#types/RouteType.js";
import getConfig from "#utils/getConfig.js";

export const ReqDataType = {
  query: "string",
};

export const ResDataType = {
  text: "string",
};

const route: RouteType = {
  path: "/text",
  description: "Generate text based on your query.",
  requireRequestData: true,
  method: HTTPMethod.GET,

  async script(req, res) {
    const { geminiModel } = getConfig("ai") as { geminiModel: string };
    const model = Gemini();

    if (!model.enabled) {
      return res.status(503).send("AI feature is currently disabled");
    }

    const modelResponse = await model.model!.generateContent({
      model: geminiModel || "gemini-2.5-flash",
      contents: req.body.query,
      config: { tools: [{ googleSearch: {} }, { urlContext: {} }] },
    })!;
    const responseData = {
      text: modelResponse.text,
    };

    return res.json(responseData);
  },
};

export default route;
