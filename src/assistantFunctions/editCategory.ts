import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import {
  ChannelType,
  Client,
  PermissionFlagsBits,
  OverwriteResolvable,
} from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "editCategory",
  description: "Edit a discord category channel's properties.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      categoryId: {
        type: Type.STRING,
        description: "The ID of the category to edit.",
        example: "1334114656461258784",
      },
      categoryName: {
        type: Type.STRING,
        description: "The new name of the category (optional).",
        example: "Updated Category",
      },
      permissions: {
        type: Type.ARRAY,
        description:
          "List of permissions to set for the category for each user/role ID provided (optional).",
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
    required: ["categoryId"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          categoryId: {
            type: Type.STRING,
            description: "The ID of the edited category.",
            example: "1334114656461258784",
          },
          categoryName: {
            type: Type.STRING,
            description: "The name of the edited category.",
            example: "Updated Category",
          },
          channelType: {
            type: Type.NUMBER,
            description: "The type of the edited category (always 4).",
            example: 4,
          },
          position: {
            type: Type.NUMBER,
            description: "The position of the category in the channel list.",
            example: 0,
          },
          updatedAt: {
            type: Type.STRING,
            description: "The timestamp when the category was updated.",
          },
        },
        required: [
          "categoryId",
          "categoryName",
          "channelType",
          "position",
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
  const functionName = "editCategory";

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
        data: "Cannot edit categories in DMs",
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

    // Fetch the category to edit
    const categoryToEdit = await client.channels.fetch(
      updatableData.categoryId
    );
    if (!categoryToEdit) {
      return {
        functionName,
        success: false,
        data: "Category to edit not found",
      };
    }

    if (categoryToEdit.type !== ChannelType.GuildCategory) {
      return {
        functionName,
        success: false,
        data: "Channel is not a category",
      };
    }

    // Check if the category belongs to the same guild
    if (categoryToEdit.guild.id !== currentGuild.id) {
      return {
        functionName,
        success: false,
        data: "Cannot edit categories from different guilds",
      };
    }

    // Build edit options
    const editOptions: any = {};

    if (updatableData.categoryName) {
      editOptions.name = updatableData.categoryName;
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

    // Edit the category
    const editedCategory = await categoryToEdit.edit(editOptions);

    return {
      functionName,
      success: true,
      data: {
        categoryId: editedCategory.id,
        categoryName: editedCategory.name,
        channelType: editedCategory.type,
        position: editedCategory.position,
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
