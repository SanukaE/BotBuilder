import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import {
  Client,
  PermissionFlagsBits,
  GuildScheduledEventEntityType,
  ChannelType,
  GuildScheduledEvent,
} from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "updateEvent",
  description: "Updates an existing Discord scheduled event.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventId: {
        type: Type.STRING,
        description: "The ID of the event to update.",
        example: "1334114656461258784",
      },
      eventName: {
        type: Type.STRING,
        description: "The new name of the event (optional).",
        example: "Updated Community Game Night",
      },
      eventDescription: {
        type: Type.STRING,
        description: "The new description of the event (optional).",
        example: "Updated description for our gaming event!",
      },
      startTime: {
        type: Type.STRING,
        description:
          "The new start time of the event in ISO format (optional).",
        example: "2024-08-01T21:00:00.000Z",
      },
      endTime: {
        type: Type.STRING,
        description: "The new end time of the event in ISO format (optional).",
        example: "2024-08-02T00:00:00.000Z",
      },
      coverImage: {
        type: Type.STRING,
        description: "New URL or path to the event cover image (optional).",
        example: "https://example.com/new-image.png",
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
            description: "The ID of the updated event.",
          },
          eventName: {
            type: Type.STRING,
            description: "The updated name of the event.",
          },
          eventDescription: {
            type: Type.STRING,
            description: "The updated description of the event.",
          },
          startTime: {
            type: Type.STRING,
            description: "The updated start time of the event.",
          },
          endTime: {
            type: Type.STRING,
            description: "The updated end time of the event.",
          },
          updatedAt: {
            type: Type.STRING,
            description: "The timestamp when the event was updated.",
          },
        },
        required: ["eventId", "updatedAt"],
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
  const functionName = "updateEvent";

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

    // Fetch the existing event
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

    // Prepare update options
    const updateOptions: any = {};

    if (updatableData.eventName) {
      updateOptions.name = updatableData.eventName;
    }

    if (updatableData.eventDescription !== undefined) {
      updateOptions.description = updatableData.eventDescription;
    }

    if (updatableData.startTime) {
      const startDate = new Date(updatableData.startTime);
      if (isNaN(startDate.getTime())) {
        return {
          functionName,
          success: false,
          data: "Invalid start time format",
        };
      }
      updateOptions.scheduledStartTime = startDate;
    }

    if (updatableData.endTime) {
      const endDate = new Date(updatableData.endTime);
      if (isNaN(endDate.getTime())) {
        return {
          functionName,
          success: false,
          data: "Invalid end time format",
        };
      }
      updateOptions.scheduledEndTime = endDate;
    }

    if (updatableData.coverImage) {
      updateOptions.image = updatableData.coverImage;
    }

    // Update the event
    const updatedEvent = await existingEvent.edit(updateOptions);

    return {
      functionName,
      success: true,
      data: {
        eventId: updatedEvent.id,
        eventName: updatedEvent.name,
        eventDescription: updatedEvent.description,
        startTime: updatedEvent.scheduledStartAt?.toISOString(),
        endTime: updatedEvent.scheduledEndAt?.toISOString(),
        updatedAt: new Date().toISOString(),
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
