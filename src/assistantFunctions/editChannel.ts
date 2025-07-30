import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import {
  ChannelType,
  Client,
  PermissionFlagsBits,
  OverwriteResolvable,
} from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "editChannel",
  description: "Edit a discord channel's properties.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      channelId: {
        type: Type.STRING,
        description: "The ID of the channel to edit.",
        example: "1334114656461258784",
      },
      channelName: {
        type: Type.STRING,
        description: "The new name of the channel (optional).",
        example: "new-general",
      },
      categoryID: {
        type: Type.STRING,
        description: "The new category ID for the channel (optional).",
        example: "1312094770910330960",
      },
      isNSFW: {
        type: Type.BOOLEAN,
        description: "The new NSFW status of the channel (optional).",
        example: false,
      },
      topic: {
        type: Type.STRING,
        description: "The new topic for the channel (optional).",
        example: "General discussion channel",
      },
      permissions: {
        type: Type.ARRAY,
        description:
          "List of permissions to set for the channel for each user/role ID provided (optional).",
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
    required: ["channelId"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          channelId: {
            type: Type.STRING,
            description: "The ID of the edited channel.",
            example: "1334114656461258784",
          },
          channelName: {
            type: Type.STRING,
            description: "The name of the edited channel.",
            example: "new-general",
          },
          channelType: {
            type: Type.NUMBER,
            description: "The type of the edited channel.",
            example: 0,
          },
          categoryId: {
            type: Type.STRING,
            description: "The ID of the category of the edited channel.",
            example: "1334113456461258784",
          },
          nsfw: {
            type: Type.BOOLEAN,
            description: "The NSFW status of the edited channel.",
            example: false,
          },
          topic: {
            type: Type.STRING,
            description: "The topic of the edited channel.",
            example: "General discussion channel",
          },
          updatedAt: {
            type: Type.STRING,
            description: "The timestamp when the channel was updated.",
          },
        },
        required: [
          "channelId",
          "channelName",
          "channelType",
          "categoryId",
          "nsfw",
          "updatedAt",
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
  const functionName = "editChannel";

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
        data: "Cannot edit DM channels",
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

    // Fetch the channel to edit
    const channelToEdit = await client.channels.fetch(updatableData.channelId);
    if (!channelToEdit) {
      return {
        functionName,
        success: false,
        data: "Channel to edit not found",
      };
    }

    if (
      channelToEdit.type === ChannelType.DM ||
      channelToEdit.type === ChannelType.GroupDM
    ) {
      return {
        functionName,
        success: false,
        data: "Cannot edit DM channels",
      };
    }

    // Check if the channel belongs to the same guild
    if (channelToEdit.guild.id !== currentGuild.id) {
      return {
        functionName,
        success: false,
        data: "Cannot edit channels from different guilds",
      };
    }

    // Build edit options
    const editOptions: any = {};

    if (updatableData.channelName) {
      editOptions.name = updatableData.channelName;
    }

    if (updatableData.categoryID !== undefined) {
      editOptions.parent = updatableData.categoryID;
    }

    if (updatableData.isNSFW !== undefined) {
      editOptions.nsfw = updatableData.isNSFW;
    }

    if (updatableData.topic !== undefined) {
      editOptions.topic = updatableData.topic;
    }

    // Build permission overwrites if provided
    if (updatableData.permissions && Array.isArray(updatableData.permissions)) {
      let permissionOverwrites: OverwriteResolvable[] = [];

      for (const permissionEntry of updatableData.permissions) {
        const { id, permission } = permissionEntry;

        if (permission.permissions && Array.isArray(permission.permissions)) {
          const permissionFlags = permission.permissions
            .map((perm: string) => {
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

      if (permissionOverwrites.length > 0) {
        editOptions.permissionOverwrites = permissionOverwrites;
      }
    }

    // Edit the channel
    const editedChannel = await channelToEdit.edit(editOptions);

    return {
      functionName,
      success: true,
      data: {
        channelId: editedChannel.id,
        channelName: editedChannel.name,
        channelType: editedChannel.type,
        categoryId: editedChannel.parentId,
        nsfw: "nsfw" in editedChannel ? editedChannel.nsfw || false : false,
        topic: "topic" in editedChannel ? editedChannel.topic || null : null,
        updatedAt: new Date().toISOString(),
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
