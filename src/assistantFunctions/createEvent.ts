import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import {
  Client,
  PermissionFlagsBits,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventEntityType,
  ChannelType,
} from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "createEvent",
  description: "Creates a Discord scheduled event in the server.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventName: {
        type: Type.STRING,
        description: "The name of the event.",
        example: "Community Game Night",
      },
      eventDescription: {
        type: Type.STRING,
        description: "The description of the event.",
        example: "Join us for a fun evening of gaming together!",
      },
      startTime: {
        type: Type.STRING,
        description: "The start time of the event in ISO format.",
        example: "2024-08-01T20:00:00.000Z",
      },
      endTime: {
        type: Type.STRING,
        description: "The end time of the event in ISO format (optional).",
        example: "2024-08-01T23:00:00.000Z",
      },
      channelId: {
        type: Type.STRING,
        description:
          "The voice/stage channel ID where the event will take place (for voice/stage events).",
        example: "1234567890123456789",
      },
      location: {
        type: Type.STRING,
        description:
          "The external location for the event (for external events).",
        example: "https://discord.gg/example",
      },
      eventType: {
        type: Type.NUMBER,
        description:
          "The type of event: 1 = Stage Instance, 2 = Voice Channel, 3 = External",
        example: 2,
      },
      coverImage: {
        type: Type.STRING,
        description: "URL or path to the event cover image (optional).",
        example: "https://example.com/image.png",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["eventName", "startTime", "eventType"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          eventId: {
            type: Type.STRING,
            description: "The ID of the created event.",
            example: "1334114656461258784",
          },
          eventName: {
            type: Type.STRING,
            description: "The name of the created event.",
            example: "Community Game Night",
          },
          eventDescription: {
            type: Type.STRING,
            description: "The description of the created event.",
            example: "Join us for a fun evening of gaming together!",
          },
          startTime: {
            type: Type.STRING,
            description: "The start time of the event.",
          },
          endTime: {
            type: Type.STRING,
            description: "The end time of the event.",
          },
          createdAt: {
            type: Type.STRING,
            description: "The timestamp when the event was created.",
          },
          eventUrl: {
            type: Type.STRING,
            description: "The Discord URL for the event.",
          },
        },
        required: [
          "eventId",
          "eventName",
          "startTime",
          "createdAt",
          "eventUrl",
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
  const functionName = "createEvent";

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

    // Validate required fields
    if (!updatableData.eventName || !updatableData.startTime) {
      return {
        functionName,
        success: false,
        data: "Event name and start time are required",
      };
    }

    // Parse dates
    const startDate = new Date(updatableData.startTime);
    const endDate = updatableData.endTime
      ? new Date(updatableData.endTime)
      : null;

    if (isNaN(startDate.getTime())) {
      return {
        functionName,
        success: false,
        data: "Invalid start time format",
      };
    }

    if (endDate && isNaN(endDate.getTime())) {
      return {
        functionName,
        success: false,
        data: "Invalid end time format",
      };
    }

    // Determine entity type and metadata
    let entityType: GuildScheduledEventEntityType;
    let entityMetadata: any = null;

    switch (updatableData.eventType) {
      case 1:
        entityType = GuildScheduledEventEntityType.StageInstance;
        if (!updatableData.channelId) {
          return {
            functionName,
            success: false,
            data: "Channel ID is required for stage events",
          };
        }
        break;
      case 2:
        entityType = GuildScheduledEventEntityType.Voice;
        if (!updatableData.channelId) {
          return {
            functionName,
            success: false,
            data: "Channel ID is required for voice events",
          };
        }
        break;
      case 3:
        entityType = GuildScheduledEventEntityType.External;
        if (!updatableData.location) {
          return {
            functionName,
            success: false,
            data: "Location is required for external events",
          };
        }
        entityMetadata = { location: updatableData.location };
        break;
      default:
        return {
          functionName,
          success: false,
          data: "Invalid event type. Use 1 (Stage), 2 (Voice), or 3 (External)",
        };
    }

    // Create the event
    const eventOptions: any = {
      name: updatableData.eventName,
      description: updatableData.eventDescription || null,
      scheduledStartTime: startDate,
      scheduledEndTime: endDate,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType,
      entityMetadata,
    };

    if (
      updatableData.channelId &&
      (entityType === GuildScheduledEventEntityType.Voice ||
        entityType === GuildScheduledEventEntityType.StageInstance)
    ) {
      eventOptions.channel = updatableData.channelId;
    }

    if (updatableData.coverImage) {
      eventOptions.image = updatableData.coverImage;
    }

    const newEvent = await currentGuild.scheduledEvents.create(eventOptions);

    return {
      functionName,
      success: true,
      data: {
        eventId: newEvent.id,
        eventName: newEvent.name,
        eventDescription: newEvent.description,
        startTime: newEvent.scheduledStartAt?.toISOString(),
        endTime: newEvent.scheduledEndAt?.toISOString(),
        createdAt: newEvent.createdAt?.toISOString(),
        eventUrl: newEvent.url,
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
