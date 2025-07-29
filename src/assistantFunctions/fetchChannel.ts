import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { ChannelType, Client, PermissionOverwrites } from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "fetchChannel",
  description:
    "Fetch detailed information about a Discord channel by ID or name.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      channelId: {
        type: Type.STRING,
        description:
          "The ID of the channel to fetch (optional if channelName is provided).",
        example: "1334114656461258784",
      },
      channelName: {
        type: Type.STRING,
        description:
          "The name of the channel to fetch (optional if channelId is provided).",
        example: "general",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the property requires a value from a different function.",
        example: false,
      },
    },
    required: [],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          channelId: {
            type: Type.STRING,
            description: "The ID of the channel.",
            example: "1334114656461258784",
          },
          channelName: {
            type: Type.STRING,
            description: "The name of the channel.",
            example: "general",
          },
          channelType: {
            type: Type.NUMBER,
            description: "The type of the channel.",
            example: 0,
          },
          channelTypeName: {
            type: Type.STRING,
            description: "The human-readable name of the channel type.",
            example: "GuildText",
          },
          categoryId: {
            type: Type.STRING,
            description: "The ID of the parent category.",
            example: "1334113456461258784",
          },
          categoryName: {
            type: Type.STRING,
            description: "The name of the parent category.",
            example: "General Category",
          },
          guildId: {
            type: Type.STRING,
            description: "The ID of the guild this channel belongs to.",
            example: "1334112456461258784",
          },
          guildName: {
            type: Type.STRING,
            description: "The name of the guild this channel belongs to.",
            example: "My Discord Server",
          },
          position: {
            type: Type.NUMBER,
            description: "The position of the channel in the channel list.",
            example: 1,
          },
          nsfw: {
            type: Type.BOOLEAN,
            description: "Whether the channel is marked as NSFW.",
            example: false,
          },
          topic: {
            type: Type.STRING,
            description: "The topic of the channel (if applicable).",
            example: "General discussion",
          },
          bitrate: {
            type: Type.NUMBER,
            description: "The bitrate of the voice channel (if applicable).",
            example: 64000,
          },
          userLimit: {
            type: Type.NUMBER,
            description: "The user limit of the voice channel (if applicable).",
            example: 10,
          },
          rateLimitPerUser: {
            type: Type.NUMBER,
            description: "The rate limit per user in seconds (slowmode).",
            example: 0,
          },
          createdAt: {
            type: Type.STRING,
            description: "The timestamp when the channel was created.",
          },
          url: {
            type: Type.STRING,
            description: "The URL of the channel.",
            example:
              "https://discord.com/channels/1334112456461258784/1334114656461258784",
          },
          permissions: {
            type: Type.ARRAY,
            description: "The permission overwrites for the channel.",
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description: "The ID of the user/role.",
                },
                type: {
                  type: Type.STRING,
                  description: "The type of overwrite (Member/Role).",
                },
                allow: {
                  type: Type.ARRAY,
                  description: "Allowed permissions.",
                  items: { type: Type.STRING },
                },
                deny: {
                  type: Type.ARRAY,
                  description: "Denied permissions.",
                  items: { type: Type.STRING },
                },
              },
            },
          },
        },
        required: [
          "channelId",
          "channelName",
          "channelType",
          "channelTypeName",
          "guildId",
          "guildName",
          "position",
          "createdAt",
          "url",
        ],
      },
    },
  },
};

export const script = async (
  client: Client,
  channelID: string,
  userID: string,
  functionResults: { functionName: string; success: boolean; data: any }[],
  data: any
) => {
  const functionName = "fetchChannel";

  try {
    const currentChannel = await client.channels.fetch(channelID);
    if (!currentChannel) {
      return {
        functionName,
        success: false,
        data: "Current channel not found",
      };
    }

    if (
      currentChannel.type === ChannelType.DM ||
      currentChannel.type === ChannelType.GroupDM
    ) {
      return {
        functionName,
        success: false,
        data: "Cannot fetch guild channels from DMs",
      };
    }

    let updatableData = { ...data };

    // Handle data from previous functions if required
    if (data.requireDataFromPrev)
      updatableData = setAssistantPlaceholders(functionResults, data);

    const currentGuild = currentChannel.guild;
    let targetChannel;

    if (updatableData.channelId) {
      // Fetch by ID
      targetChannel = await client.channels.fetch(updatableData.channelId);
      if (!targetChannel) {
        return {
          functionName,
          success: false,
          data: `Channel with ID ${updatableData.channelId} not found`,
        };
      }
    } else if (updatableData.channelName) {
      // Fetch by name within the same guild
      const guildChannels = await currentGuild.channels.fetch();
      targetChannel = guildChannels.find(
        (channel) =>
          channel &&
          channel.name.toLowerCase() === updatableData.channelName.toLowerCase()
      );
      if (!targetChannel) {
        return {
          functionName,
          success: false,
          data: `Channel with name "${updatableData.channelName}" not found in this guild`,
        };
      }
    } else {
      return {
        functionName,
        success: false,
        data: "Either channelId or channelName must be provided",
      };
    }

    if (
      targetChannel.type === ChannelType.DM ||
      targetChannel.type === ChannelType.GroupDM
    ) {
      return {
        functionName,
        success: false,
        data: "Cannot fetch DM channels",
      };
    }

    // Get channel type name
    const getChannelTypeName = (type: ChannelType): string => {
      const typeNames: Record<ChannelType, string> = {
        [ChannelType.GuildText]: "GuildText",
        [ChannelType.DM]: "DM",
        [ChannelType.GuildVoice]: "GuildVoice",
        [ChannelType.GroupDM]: "GroupDM",
        [ChannelType.GuildCategory]: "GuildCategory",
        [ChannelType.GuildAnnouncement]: "GuildAnnouncement",
        [ChannelType.AnnouncementThread]: "AnnouncementThread",
        [ChannelType.PublicThread]: "PublicThread",
        [ChannelType.PrivateThread]: "PrivateThread",
        [ChannelType.GuildStageVoice]: "GuildStageVoice",
        [ChannelType.GuildDirectory]: "GuildDirectory",
        [ChannelType.GuildForum]: "GuildForum",
        [ChannelType.GuildMedia]: "GuildMedia",
      };
      return typeNames[type] || "Unknown";
    };

    // Get parent category info
    let categoryId = null;
    let categoryName = null;
    if (targetChannel.parentId) {
      const parentCategory = await client.channels.fetch(
        targetChannel.parentId
      );
      if (parentCategory && parentCategory.type === ChannelType.GuildCategory) {
        categoryId = parentCategory.id;
        categoryName = parentCategory.name;
      }
    }

    // Get permission overwrites - check if the channel has permission overwrites
    const permissions: Array<{
      id: string;
      type: string;
      allow: string[];
      deny: string[];
    }> = [];

    if (
      "permissionOverwrites" in targetChannel &&
      targetChannel.permissionOverwrites
    ) {
      targetChannel.permissionOverwrites.cache.forEach(
        (overwrite: PermissionOverwrites) => {
          permissions.push({
            id: overwrite.id,
            type: overwrite.type === 0 ? "Role" : "Member",
            allow: overwrite.allow.toArray(),
            deny: overwrite.deny.toArray(),
          });
        }
      );
    }

    // Get position - thread channels don't have position
    const position = "position" in targetChannel ? targetChannel.position : 0;

    // Get creation date - handle potential null
    const createdAt = targetChannel.createdAt || new Date();

    // Build response data
    const responseData: any = {
      channelId: targetChannel.id,
      channelName: targetChannel.name,
      channelType: targetChannel.type,
      channelTypeName: getChannelTypeName(targetChannel.type),
      categoryId,
      categoryName,
      guildId: targetChannel.guild.id,
      guildName: targetChannel.guild.name,
      position,
      createdAt: createdAt.toISOString(),
      url: targetChannel.url,
      permissions,
    };

    // Add type-specific properties
    if ("nsfw" in targetChannel) {
      responseData.nsfw = targetChannel.nsfw || false;
    } else {
      responseData.nsfw = false;
    }

    if ("topic" in targetChannel) {
      responseData.topic = targetChannel.topic || null;
    } else {
      responseData.topic = null;
    }

    if ("bitrate" in targetChannel) {
      responseData.bitrate = targetChannel.bitrate || null;
    } else {
      responseData.bitrate = null;
    }

    if ("userLimit" in targetChannel) {
      responseData.userLimit = targetChannel.userLimit || null;
    } else {
      responseData.userLimit = null;
    }

    if ("rateLimitPerUser" in targetChannel) {
      responseData.rateLimitPerUser = targetChannel.rateLimitPerUser || 0;
    } else {
      responseData.rateLimitPerUser = 0;
    }

    return {
      functionName,
      success: true,
      data: responseData,
    };
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    return {
      functionName,
      success: false,
      data: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
