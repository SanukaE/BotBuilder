import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import {
  ChannelType,
  Client,
  PermissionFlagsBits,
  GuildScheduledEvent,
} from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "deleteEvent",
  description: "Deletes a Discord scheduled event.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventId: {
        type: Type.STRING,
        description: "The ID of the event to delete.",
        example: "1334114656461258784",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["eventId"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          eventId: {
            type: Type.STRING,
            description: "The ID of the deleted event.",
          },
          eventName: {
            type: Type.STRING,
            description: "The name of the deleted event.",
          },
          deletedAt: {
            type: Type.STRING,
            description: "The timestamp when the event was deleted.",
          },
        },
        required: ["eventId", "eventName", "deletedAt"],
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
  const functionName = "deleteEvent";

  try {
    const currentChannel = await client.channels.fetch(channelID);
    if (!currentChannel) {
      return { functionName, success: false, data: "Channel not found" };
    }

    // Check if channel is a DM channel
    if (
      currentChannel.type === ChannelType.DM ||
      currentChannel.type === ChannelType.GroupDM
    ) {
      return {
        functionName,
        success: false,
        data: "Cannot list events in DMs",
      };
    }

    const currentGuild = currentChannel.guild;
    const guildMember = await currentGuild.members.fetch(userID);

    // Check if user has MANAGE_EVENTS permission
    if (!guildMember.permissions.has(PermissionFlagsBits.ManageEvents)) {
      return {
        functionName,
        success: false,
        data: "User does not have MANAGE_EVENTS permission",
      };
    }

    let updatableData = { ...data };

    // Handle data from previous functions if required
    if (data.requireDataFromPrev)
      updatableData = setAssistantPlaceholders(functionResults, data);

    // Fetch the event before deleting to get its name
    const fetchResult = await currentGuild.scheduledEvents.fetch(
      updatableData.eventId
    );

    // Type guard to ensure we have a single event, not a collection
    if (!fetchResult || "size" in fetchResult) {
      return {
        functionName,
        success: false,
        data: "Event not found",
      };
    }

    const existingEvent = fetchResult;
    const eventName = existingEvent.name;

    // Delete the event - pass the reason parameter as required
    await existingEvent.delete();

    return {
      functionName,
      success: true,
      data: {
        eventId: updatableData.eventId,
        eventName: eventName,
        deletedAt: new Date().toISOString(),
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
