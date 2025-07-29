import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { ChannelType, Client } from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "fetchCategory",
  description:
    "Fetch detailed information about a Discord category by ID or name.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      categoryId: {
        type: Type.STRING,
        description:
          "The ID of the category to fetch (optional if categoryName is provided).",
        example: "1334114656461258784",
      },
      categoryName: {
        type: Type.STRING,
        description:
          "The name of the category to fetch (optional if categoryId is provided).",
        example: "General",
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
          categoryId: {
            type: Type.STRING,
            description: "The ID of the category.",
            example: "1334114656461258784",
          },
          categoryName: {
            type: Type.STRING,
            description: "The name of the category.",
            example: "General",
          },
          channelType: {
            type: Type.NUMBER,
            description: "The type of the category (always 4).",
            example: 4,
          },
          channelTypeName: {
            type: Type.STRING,
            description: "The human-readable name of the channel type.",
            example: "GuildCategory",
          },
          guildId: {
            type: Type.STRING,
            description: "The ID of the guild this category belongs to.",
            example: "1334112456461258784",
          },
          guildName: {
            type: Type.STRING,
            description: "The name of the guild this category belongs to.",
            example: "My Discord Server",
          },
          position: {
            type: Type.NUMBER,
            description: "The position of the category in the channel list.",
            example: 0,
          },
          createdAt: {
            type: Type.STRING,
            description: "The timestamp when the category was created.",
          },
          url: {
            type: Type.STRING,
            description: "The URL of the category.",
            example:
              "https://discord.com/channels/1334112456461258784/1334114656461258784",
          },
          permissions: {
            type: Type.ARRAY,
            description: "The permission overwrites for the category.",
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
          childChannels: {
            type: Type.ARRAY,
            description: "List of channels under this category.",
            items: {
              type: Type.OBJECT,
              properties: {
                channelId: {
                  type: Type.STRING,
                  description: "The ID of the child channel.",
                },
                channelName: {
                  type: Type.STRING,
                  description: "The name of the child channel.",
                },
                channelType: {
                  type: Type.NUMBER,
                  description: "The type of the child channel.",
                },
                channelTypeName: {
                  type: Type.STRING,
                  description:
                    "The human-readable name of the child channel type.",
                },
                position: {
                  type: Type.NUMBER,
                  description: "The position of the child channel.",
                },
                nsfw: {
                  type: Type.BOOLEAN,
                  description: "Whether the child channel is NSFW.",
                },
              },
            },
          },
          totalChildChannels: {
            type: Type.NUMBER,
            description: "The total number of child channels in this category.",
            example: 5,
          },
        },
        required: [
          "categoryId",
          "categoryName",
          "channelType",
          "channelTypeName",
          "guildId",
          "guildName",
          "position",
          "createdAt",
          "url",
          "permissions",
          "childChannels",
          "totalChildChannels",
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
  const functionName = "fetchCategory";

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
        data: "Cannot fetch guild categories from DMs",
      };
    }

    let updatableData = { ...data };

    // Handle data from previous functions if required
    if (data.requireDataFromPrev)
      updatableData = setAssistantPlaceholders(functionResults, data);

    const currentGuild = currentChannel.guild;
    let targetCategory;

    if (updatableData.categoryId) {
      // Fetch by ID
      targetCategory = await client.channels.fetch(updatableData.categoryId);
      if (!targetCategory) {
        return {
          functionName,
          success: false,
          data: `Category with ID ${updatableData.categoryId} not found`,
        };
      }
    } else if (updatableData.categoryName) {
      // Fetch by name within the same guild
      const guildChannels = await currentGuild.channels.fetch();
      targetCategory = guildChannels.find(
        (channel) =>
          channel &&
          channel.type === ChannelType.GuildCategory &&
          channel.name.toLowerCase() ===
            updatableData.categoryName.toLowerCase()
      );
      if (!targetCategory) {
        return {
          functionName,
          success: false,
          data: `Category with name "${updatableData.categoryName}" not found in this guild`,
        };
      }
    } else {
      return {
        functionName,
        success: false,
        data: "Either categoryId or categoryName must be provided",
      };
    }

    if (targetCategory.type !== ChannelType.GuildCategory) {
      return {
        functionName,
        success: false,
        data: "The specified channel is not a category",
      };
    }

    // Get permission overwrites
    const permissions =
      targetCategory.permissionOverwrites?.cache.map((overwrite) => ({
        id: overwrite.id,
        type: overwrite.type === 0 ? "Role" : "Member",
        allow: overwrite.allow.toArray(),
        deny: overwrite.deny.toArray(),
      })) || [];

    // Get child channels
    const guildChannels = await currentGuild.channels.fetch();
    const childChannels = guildChannels
      .filter((channel) => channel && channel.parentId === targetCategory.id)
      .map((channel) => {
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

        return {
          channelId: channel!.id,
          channelName: channel!.name,
          channelType: channel!.type,
          channelTypeName: getChannelTypeName(channel!.type),
          position: channel!.position,
          nsfw: "nsfw" in channel! ? channel!.nsfw || false : false,
        };
      })
      .sort((a, b) => a.position - b.position);

    const responseData = {
      categoryId: targetCategory.id,
      categoryName: targetCategory.name,
      channelType: targetCategory.type,
      channelTypeName: "GuildCategory",
      guildId: targetCategory.guild.id,
      guildName: targetCategory.guild.name,
      position: targetCategory.position,
      createdAt: targetCategory.createdAt.toISOString(),
      url: targetCategory.url,
      permissions,
      childChannels,
      totalChildChannels: childChannels.length,
    };

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
