import { ChannelType, Client, PermissionsBitField } from "discord.js";
import express from "express";
import getConfig from "#utils/getConfig.js";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import { createLogger, LoggerOptions } from "#utils/createLogger.js";
import { HTTPMethod, RouteType } from "#types/RouteType.js";
import MySQL from "#libs/MySQL.js";

export default async function startDashboard(client: Client) {
  console.log("[System] Starting dashboard...");

  const app = express();
  app.set("view engine", "ejs");
  app.use(express.static("public"));
  app.use(express.json());

  // Middleware: User authentication for dashboard pages
  const verifyUser = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const code = req.query.code as string;
    const getLoginUrl = (path: string) => {
      const baseUrl = `http://${process.env.WEB_SERVER_IP}:${process.env.WEB_SERVER_PORT}`;
      return `https://discord.com/oauth2/authorize?client_id=${
        client.user?.id
      }&response_type=code&redirect_uri=${encodeURIComponent(
        baseUrl + path
      )}&scope=identify`;
    };

    if (!code) return res.redirect(getLoginUrl(req.path));
    if (!client.user)
      return res
        .status(500)
        .send("Bot is not ready yet. Please try again later.");

    try {
      const tokenResponse = await fetch(
        "https://discord.com/api/oauth2/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: client.user.id,
            client_secret: process.env.APP_SECRET!,
            grant_type: "authorization_code",
            code,
            redirect_uri: `http://${process.env.WEB_SERVER_IP}:${process.env.WEB_SERVER_PORT}${req.path}`,
          }),
        }
      );

      if (!tokenResponse.ok)
        return res
          .status(500)
          .send("Failed to authenticate. Please try again.");

      const tokenData = await tokenResponse.json();
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok)
        return res
          .status(500)
          .send("Failed to fetch user data. Please try again.");

      const userData = await userResponse.json();
      const { productionGuildID } = getConfig("application") as {
        productionGuildID: string;
      };
      const productionGuild = await client.guilds.fetch(productionGuildID);
      const member = await productionGuild.members.fetch(userData.id);

      if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
        return res
          .status(403)
          .send("You do not have permission to access this page.");

      return next();
    } catch {
      return res
        .status(500)
        .send(
          "An error occurred while processing your request. Please try again later."
        );
    }
  };

  // Middleware: API key verification for API routes
  const verifyRequest = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const apiKey = req.headers.authorization;
    if (!apiKey) return res.status(401).send("Missing API Key.");

    let userID: string;
    try {
      const [rows] = await MySQL.query(
        "SELECT * FROM api_keys WHERE apiKey = ?",
        [apiKey]
      );
      if (!Array.isArray(rows) || rows.length === 0)
        return res.status(401).send("Invalid API Key.");

      const keyData = rows[0] as {
        userID: string;
        keyStatus: string;
        statusNote?: string;
      };
      if (keyData.keyStatus !== "ACTIVE")
        return res
          .status(403)
          .send(
            "API Key is not active" +
              (keyData.statusNote ? `: ${keyData.statusNote}` : ".")
          );
      userID = keyData.userID;
    } catch {
      return res.status(500).send("Database error.");
    }

    const [_, __, ___, [filePath, route]] = routes.find(([, , , [, route]]) =>
      req.path.endsWith(route.path)
    )!;
    const { productionGuildID, developmentGuildID } = getConfig(
      "application"
    ) as {
      productionGuildID: string;
      developmentGuildID: string;
    };

    if (route.isDisabled)
      return res.status(403).send("This route is currently disabled.");

    if (route.isDevOnly) {
      const developmentGuild = await client.guilds.fetch(developmentGuildID);
      try {
        await developmentGuild.members.fetch(userID);
      } catch {
        return res
          .status(403)
          .send("You are not a member of the development guild.");
      }
    }

    if (route.isGuildOnly) {
      const productionGuild = await client.guilds.fetch(productionGuildID);
      try {
        await productionGuild.members.fetch(userID);
      } catch {
        return res
          .status(403)
          .send("You are not a member of the production guild.");
      }
    }

    if (route.requireRequestData) {
      const reqData = req.body;
      if (!reqData) return res.status(400).send("Missing data.");

      const fileURL = pathToFileURL(filePath).href;
      const { ReqDataType } = await import(fileURL);

      const isValid = (): boolean => {
        if (!ReqDataType) return false;
        for (const key in ReqDataType) {
          const expectedType = ReqDataType[key];
          const actualValue = reqData[key];

          if (typeof expectedType === "string") {
            if (expectedType === "string" && typeof actualValue !== "string")
              return false;
            if (expectedType === "number" && typeof actualValue !== "number")
              return false;
            if (expectedType === "boolean" && typeof actualValue !== "boolean")
              return false;
            if (
              expectedType === "object" &&
              (typeof actualValue !== "object" ||
                actualValue === null ||
                Array.isArray(actualValue))
            )
              return false;
            const arrayTypeMatch = expectedType.match(/^(\w+)\[\]$/);
            if (arrayTypeMatch) {
              if (!Array.isArray(actualValue)) return false;
              const itemType = arrayTypeMatch[1];
              for (const item of actualValue) {
                if (itemType === "object") {
                  if (
                    typeof item !== "object" ||
                    item === null ||
                    Array.isArray(item)
                  )
                    return false;
                } else if (typeof item !== itemType) {
                  return false;
                }
              }
              continue;
            }
          }
        }
        return true;
      };

      if (!isValid()) return res.status(400).send("Invalid data format.");
    }

    return next();
  };

  // Home page
  app.get("/", (req, res) => {
    const { appMotto, serverInvite } = getConfig("application") as {
      appMotto: string;
      serverInvite: string;
    };
    const appProfile = client.user!;
    return res.render("home", {
      appDisplayname: appProfile.displayName,
      appMotto,
      appAvatar: appProfile.displayAvatarURL(),
      serverInvite,
    });
  });

  // Auth middleware for dashboard pages
  app.use(async (req, res, next) => {
    if (req.path === "/stats" || req.path === "/config")
      await verifyUser(req, res, next);
    else return next();
  });

  // Stats page
  app.get("/stats", async (req, res) => {
    const { productionGuildID, serverInvite, staffRoleIDs } = getConfig(
      "application",
      "moderation"
    ) as {
      productionGuildID: string;
      serverInvite: string;
      staffRoleIDs: string[];
    };
    const productionGuild = await client.guilds.fetch(productionGuildID);
    const channels = await productionGuild.channels.fetch();
    const roles = await productionGuild.roles.fetch();
    const members = await productionGuild.members.fetch();

    const channelStatistics = {
      text: channels.filter((c) => c && c.type === ChannelType.GuildText).size,
      voice: channels.filter((c) => c && c.type === ChannelType.GuildVoice)
        .size,
      announcement: channels.filter(
        (c) => c && c.type === ChannelType.GuildAnnouncement
      ).size,
      forum: channels.filter((c) => c && c.type === ChannelType.GuildForum)
        .size,
      stage: channels.filter((c) => c && c.type === ChannelType.GuildStageVoice)
        .size,
      category: channels.filter(
        (c) => c && c.type === ChannelType.GuildCategory
      ).size,
      total: channels.filter((c) => !!c).size,
    };

    const roleStatistics = {
      member: roles.filter(
        (r) =>
          !r.managed &&
          !staffRoleIDs.includes(r.id) &&
          r.id !== productionGuild.id &&
          !r.permissions.has(PermissionsBitField.Flags.Administrator) &&
          !r.permissions.has(PermissionsBitField.Flags.ManageGuild) &&
          !r.permissions.has(PermissionsBitField.Flags.KickMembers) &&
          !r.permissions.has(PermissionsBitField.Flags.BanMembers)
      ).size,
      premium: roles.filter((r) => r.tags?.premiumSubscriberRole).size,
      staff: roles.filter(
        (r) =>
          staffRoleIDs.includes(r.id) ||
          r.permissions.has(PermissionsBitField.Flags.ManageGuild)
      ).size,
      moderator: roles.filter(
        (r) =>
          r.permissions.has(PermissionsBitField.Flags.KickMembers) ||
          r.permissions.has(PermissionsBitField.Flags.BanMembers)
      ).size,
      admin: roles.filter((r) =>
        r.permissions.has(PermissionsBitField.Flags.Administrator)
      ).size,
      total: roles.filter((r) => r.id !== productionGuild.id).size,
    };

    const memberStatistics = {
      bots: members.filter((m) => m.user.bot).size,
      members: members.filter((m) => !m.user.bot).size,
      nitro: members.filter((m) => m.premiumSince).size,
      premium: members.filter((m) =>
        m.roles.cache.some((r) => r.tags?.premiumSubscriberRole)
      ).size,
      staff: members.filter(
        (m) =>
          m.roles.cache.some((r) => staffRoleIDs.includes(r.id)) ||
          m.permissions.has(PermissionsBitField.Flags.ManageGuild)
      ).size,
      moderators: members.filter(
        (m) =>
          m.permissions.has(PermissionsBitField.Flags.KickMembers) ||
          m.permissions.has(PermissionsBitField.Flags.BanMembers)
      ).size,
      admins: members.filter((m) =>
        m.permissions.has(PermissionsBitField.Flags.Administrator)
      ).size,
      total: members.size,
    };

    const emojiStatistics = {
      total: productionGuild.emojis.cache.size,
      static: productionGuild.emojis.cache.filter((e) => !e.animated).size,
      animated: productionGuild.emojis.cache.filter((e) => e.animated).size,
    };

    const stickerStatistics = {
      total: productionGuild.stickers.cache.size,
      guild: productionGuild.stickers.cache.filter((s) => s.type === 1).size,
      nitro: productionGuild.stickers.cache.filter((s) => s.type === 2).size,
    };

    const boostStatistics = {
      level: productionGuild.premiumTier,
      count: productionGuild.premiumSubscriptionCount,
    };

    const onlineMembers = members.filter(
      (m) => m.presence && m.presence.status !== "offline"
    ).size;

    const creationDates = {
      guild: productionGuild.createdAt,
      oldestMember: members.reduce(
        (oldest, m) => (m.user.createdAt < oldest ? m.user.createdAt : oldest),
        new Date()
      ),
      newestMember: members.reduce(
        (newest, m) => (m.user.createdAt > newest ? m.user.createdAt : newest),
        new Date(0)
      ),
    };

    return res.render("stats", {
      serverInvite,
      channelStatistics,
      roleStatistics,
      memberStatistics,
      emojiStatistics,
      stickerStatistics,
      boostStatistics,
      onlineMembers,
      creationDates,
    });
  });

  // API info page
  app.get("/api", (req, res) => {
    const { serverInvite } = getConfig("application") as {
      serverInvite: string;
    };
    return res.render("api", { serverInvite });
  });

  // Config page
  app.get("/config", (req, res) => {
    const { serverInvite } = getConfig("application") as {
      serverInvite: string;
    };
    return res.render("config", { serverInvite });
  });

  console.log("[System] Registering API routes...");
  const routes = await getRoutes();

  // API key middleware for API endpoints
  app.use(async (req, res, next) => {
    if (req.path.startsWith("/api") && req.path !== "/api")
      await verifyRequest(req, res, next);
    else return next();
  });

  // Register API routes
  for (const [routePath, method, script, [filePath, route]] of routes) {
    if (route.isDisabled) continue;
    const expressMethod = method.toLowerCase() as keyof express.Application;
    if (typeof app[expressMethod] === "function") {
      app[expressMethod](
        routePath.startsWith("/") ? "/api" + routePath : `/api/${routePath}`,
        async (req: express.Request, res: express.Response) => {
          try {
            await script(req, res);
          } catch (error) {
            if (route.isDevOnly) console.log(error);
            res
              .status(500)
              .send("An error occurred while processing your request.");
            const errorLogger = createLogger(
              `${filePath.split("/").pop()!.replace(/\.js$/, "")}-route`,
              LoggerOptions.Error,
              true
            );
            errorLogger.write(error);
            errorLogger.close();
          }
        }
      );
    } else {
      console.log(`[System] Unsupported HTTP method: ${method}`);
    }
  }

  console.log("[System] API routes registered!");

  app.listen(process.env.WEB_SERVER_PORT, () => {
    console.log(
      `[System] Dashboard online! You can access it at http://${process.env.WEB_SERVER_IP}:${process.env.WEB_SERVER_PORT}`
    );
  });
}

// Helper: Recursively load all API route files
async function getRoutes() {
  let routes: [
    string,
    HTTPMethod,
    (req: express.Request, res: express.Response) => Promise<express.Response>,
    [string, RouteType]
  ][] = [];

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const routePath = path.join(__dirname, "../../actions/routes");

  async function addRoutesFromFolders(currentPath: string) {
    const entries = fs.readdirSync(currentPath);
    for (const entryName of entries) {
      const entry = path.join(currentPath, entryName);
      const stat = fs.statSync(entry);

      if (stat.isFile()) {
        const fileURL = pathToFileURL(entry).href;
        const route = (await import(fileURL)).default as RouteType;
        if (route.isDisabled) continue;

        let routePathStr: string;
        if (typeof route.followFolders === "undefined" || route.followFolders) {
          const foldersPaths = entry.split("/");
          const folders = foldersPaths.splice(0, foldersPaths.length - 1);
          const routesIndex = folders.indexOf("routes");
          const filteredFolders = folders.slice(routesIndex + 1);
          routePathStr =
            "/" +
            [...filteredFolders, route.path.replace(/^\//, "")]
              .filter(Boolean)
              .join("/");
        } else {
          routePathStr = route.path;
        }

        routes.push([routePathStr, route.method, route.script, [entry, route]]);
      } else if (stat.isDirectory()) {
        await addRoutesFromFolders(entry);
      }
    }
  }

  await addRoutesFromFolders(routePath);
  return routes;
}
