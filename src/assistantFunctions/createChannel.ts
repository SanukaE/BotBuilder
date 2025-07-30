import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import {
  ChannelType,
  Client,
  PermissionFlagsBits,
  OverwriteResolvable,
} from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "createChannel",
  description: "Create's a discord channel from the data provided.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      categoryID: {
        type: Type.STRING,
        description: "The category the channel will be created under.",
        example: "1312094770910330960",
      },
      channelType: {
        type: Type.NUMBER,
        description: "The type of the channel to create.",
        example: 0,
      },
      channelName: {
        type: Type.STRING,
        description: "The name of the channel.",
        example: "general",
      },
      isNSFW: {
        type: Type.BOOLEAN,
        description: "Is the channel NSFW.",
        example: false,
      },
      permissions: {
        type: Type.ARRAY,
        description:
          "List of permissions to set for the channel for each user/role ID provided.",
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "The user/role ID.",
            },
            permission: {
              type: Type.OBJECT,
              properties: {
                isAllowed: {
                  type: Type.BOOLEAN,
                  description: "Are the permissions listed allowed.",
                  example: true,
                },
                permissions: {
                  type: Type.ARRAY,
                  description: "List of permissions to allow/disallow.",
                  items: {
                    type: Type.STRING,
                    description: "The permission.",
                    example: "VIEW_CHANNEL",
                  },
                },
              },
              required: ["isAllowed", "permissions"],
            },
          },
          required: ["id", "permission"],
        },
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the property requires a value from a different function.",
        example: false,
      },
    },
    required: ["channelType", "channelName"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          channelId: {
            type: Type.STRING,
            description: "The ID of the created channel.",
            example: "1334114656461258784",
          },
          channelName: {
            type: Type.STRING,
            description: "The name of the created channel.",
            example: "general",
          },
          channelType: {
            type: Type.NUMBER,
            description: "The type of the created channel.",
            example: 0,
          },
          categoryId: {
            type: Type.STRING,
            description: "The ID of the category of the new channel.",
            example: "1334113456461258784",
          },
          nsfw: {
            type: Type.BOOLEAN,
            description: "The NSFW status of the new channel.",
            example: false,
          },
          createdAt: {
            type: Type.STRING,
            description: "The timestamp of the created channel.",
          },
        },
        required: [
          "channelId",
          "channelName",
          "channelType",
          "categoryId",
          "nsfw",
          "createdAt",
        ],
      },
    },
  },
};

export const script = async (
  client: Client,
  channelID: string,
  userID: string,
  functionResults: {
    functionName: string;
    success: boolean;
    data: any;
    callIndex?: number;
  }[],
  data: any
) => {
  const functionName = "createChannel";

  try {
    const currentChannel = await client.channels.fetch(channelID);
    if (!currentChannel) {
      return { functionName, success: false, data: "Channel not found" };
    }

    if (
      currentChannel.type === ChannelType.DM ||
      currentChannel.type === ChannelType.GroupDM
    ) {
      return {
        functionName,
        success: false,
        data: "Cannot create channels in DMs",
      };
    }

    const currentGuild = currentChannel.guild;
    const currentUser = await client.users.fetch(userID);
    const guildMember = await currentGuild.members.fetch(userID);

    // Check if user has MANAGE_CHANNELS permission
    if (!guildMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return {
        functionName,
        success: false,
        data: "User does not have MANAGE_CHANNELS permission",
      };
    }

    let updatableData = { ...data };

    // Handle data from previous functions if required
    if (data.requireDataFromPrev)
      updatableData = setAssistantPlaceholders(functionResults, data);

    // Ensure categoryID is valid before proceeding
    if (
      updatableData.categoryID &&
      typeof updatableData.categoryID === "string" &&
      updatableData.categoryID.includes("::")
    ) {
      return {
        functionName,
        success: false,
        data: `Failed to resolve categoryID: ${updatableData.categoryID}`,
      };
    }

    // Build permission overwrites
    let permissionOverwrites: OverwriteResolvable[] = [];
    if (updatableData.permissions && Array.isArray(updatableData.permissions)) {
      for (const permissionEntry of updatableData.permissions) {
        const { id, permission } = permissionEntry;

        if (permission.permissions && Array.isArray(permission.permissions)) {
          const permissionFlags = permission.permissions
            .map((perm: string) => {
              // Convert string permission to PermissionFlagsBits
              return PermissionFlagsBits[
                perm as keyof typeof PermissionFlagsBits
              ];
            })
            .filter(Boolean);

          if (permissionFlags.length > 0) {
            const overwrite: OverwriteResolvable = {
              id: id,
              allow: permission.isAllowed ? permissionFlags : [],
              deny: permission.isAllowed ? [] : permissionFlags,
            };
            permissionOverwrites.push(overwrite);
          }
        }
      }
    }

    // Create the channel
    const newChannel = await currentGuild.channels.create({
      name: updatableData.channelName,
      nsfw: updatableData.isNSFW || false,
      parent: updatableData.categoryID || null,
      type: updatableData.channelType,
      permissionOverwrites:
        permissionOverwrites.length > 0 ? permissionOverwrites : undefined,
    });

    return {
      functionName,
      success: true,
      data: {
        channelId: newChannel.id,
        channelName: newChannel.name,
        channelType: newChannel.type,
        categoryId: newChannel.parentId,
        nsfw: newChannel.nsfw,
        createdAt: newChannel.createdAt,
      },
    };
  } catch (error) {
    return {
      functionName,
      success: false,
      data: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
