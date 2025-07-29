import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import {
  ChannelType,
  Client,
  PermissionFlagsBits,
  OverwriteResolvable,
} from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "createCategory",
  description: "Create a discord category channel.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      categoryName: {
        type: Type.STRING,
        description: "The name of the category.",
        example: "General",
      },
      permissions: {
        type: Type.ARRAY,
        description:
          "List of permissions to set for the category for each user/role ID provided.",
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
    required: ["categoryName"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          categoryId: {
            type: Type.STRING,
            description: "The ID of the created category.",
            example: "1334114656461258784",
          },
          categoryName: {
            type: Type.STRING,
            description: "The name of the created category.",
            example: "General",
          },
          channelType: {
            type: Type.NUMBER,
            description: "The type of the created category (always 4).",
            example: 4,
          },
          position: {
            type: Type.NUMBER,
            description: "The position of the category in the channel list.",
            example: 0,
          },
          createdAt: {
            type: Type.STRING,
            description: "The timestamp of the created category.",
          },
        },
        required: [
          "categoryId",
          "categoryName",
          "channelType",
          "position",
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
  functionResults: { functionName: string; success: boolean; data: any }[],
  data: any
) => {
  const functionName = "createCategory";

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
        data: "Cannot create categories in DMs",
      };
    }

    const currentGuild = currentChannel.guild;
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

    // Create the category
    const newCategory = await currentGuild.channels.create({
      name: updatableData.categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites:
        permissionOverwrites.length > 0 ? permissionOverwrites : undefined,
    });

    return {
      functionName,
      success: true,
      data: {
        categoryId: newCategory.id,
        categoryName: newCategory.name,
        channelType: newCategory.type,
        position: newCategory.position,
        createdAt: newCategory.createdAt,
      },
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
