import Gemini from "#libs/Gemini.js";
import { RouteType, HTTPMethod } from "#types/RouteType.js";

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
    const model = Gemini();

    if (!model.enabled) {
      return res.status(503).send("AI feature is currently disabled");
    }

    const modelResponse = await model.model?.generateContent(req.body.query)!;
    const responseData = {
      text: modelResponse.response.text(),
    };

    return res.json(responseData);
  },
};

export default route;
