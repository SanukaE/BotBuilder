import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { ChannelType, Client, PermissionFlagsBits } from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "deleteCategory",
  description: "Delete a discord category channel by ID.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      categoryId: {
        type: Type.STRING,
        description: "The ID of the category to delete.",
        example: "1334114656461258784",
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
            description: "The ID of the deleted category.",
            example: "1334114656461258784",
          },
          categoryName: {
            type: Type.STRING,
            description: "The name of the deleted category.",
            example: "General",
          },
          deletedAt: {
            type: Type.STRING,
            description: "The timestamp when the category was deleted.",
          },
        },
        required: ["categoryId", "categoryName", "deletedAt"],
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
  const functionName = "deleteCategory";

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
        data: "Cannot delete categories in DMs",
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

    // Fetch the category to delete
    const categoryToDelete = await client.channels.fetch(
      updatableData.categoryId
    );
    if (!categoryToDelete) {
      return {
        functionName,
        success: false,
        data: "Category to delete not found",
      };
    }

    if (categoryToDelete.type !== ChannelType.GuildCategory) {
      return {
        functionName,
        success: false,
        data: "Channel is not a category",
      };
    }

    // Check if the category belongs to the same guild
    if (categoryToDelete.guild.id !== currentGuild.id) {
      return {
        functionName,
        success: false,
        data: "Cannot delete categories from different guilds",
      };
    }

    const categoryName = categoryToDelete.name;
    const categoryId = categoryToDelete.id;

    // Delete the category
    await categoryToDelete.delete();

    return {
      functionName,
      success: true,
      data: {
        categoryId,
        categoryName,
        deletedAt: new Date().toISOString(),
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
