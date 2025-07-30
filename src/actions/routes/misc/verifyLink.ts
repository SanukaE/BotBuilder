import { RouteType, HTTPMethod } from "#types/RouteType.js";

export const ReqDataType = {
  link: "string",
};

export const ResDataType = {
  isScam: "boolean",
};

const route: RouteType = {
  path: "/verify-link",
  description: "Check if a link is a scam or not.",
  requireRequestData: true,
  method: HTTPMethod.GET,

  async script(req, res) {
    const response = await fetch(
      "https://raw.githubusercontent.com/Discord-AntiScam/scam-links/main/list.json"
    );
    const scamLinks: string[] = await response.json();
    let isScam = false;

    if (scamLinks.some((link) => link === req.body.link)) isScam = true;

    return res.json({ isScam });
  },
};

export default route;
