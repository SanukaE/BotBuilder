import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { ChannelType, Client, PermissionFlagsBits } from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "deleteChannel",
  description: "Delete a discord channel by ID.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      channelId: {
        type: Type.STRING,
        description: "The ID of the channel to delete.",
        example: "1334114656461258784",
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
            description: "The ID of the deleted channel.",
            example: "1334114656461258784",
          },
          channelName: {
            type: Type.STRING,
            description: "The name of the deleted channel.",
            example: "general",
          },
          deletedAt: {
            type: Type.STRING,
            description: "The timestamp when the channel was deleted.",
          },
        },
        required: ["channelId", "channelName", "deletedAt"],
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
  const functionName = "deleteChannel";

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
        data: "Cannot delete DM channels",
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

    // Fetch the channel to delete
    const channelToDelete = await client.channels.fetch(
      updatableData.channelId
    );
    if (!channelToDelete) {
      return {
        functionName,
        success: false,
        data: "Channel to delete not found",
      };
    }

    if (
      channelToDelete.type === ChannelType.DM ||
      channelToDelete.type === ChannelType.GroupDM
    ) {
      return {
        functionName,
        success: false,
        data: "Cannot delete DM channels",
      };
    }

    // Check if the channel belongs to the same guild
    if (channelToDelete.guild.id !== currentGuild.id) {
      return {
        functionName,
        success: false,
        data: "Cannot delete channels from different guilds",
      };
    }

    const channelName = channelToDelete.name;
    const channelId = channelToDelete.id;

    // Delete the channel
    await channelToDelete.delete();

    return {
      functionName,
      success: true,
      data: {
        channelId,
        channelName,
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
