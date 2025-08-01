import { FunctionDeclaration, Type } from "@google/genai";
import {
  Client,
  GuildScheduledEventStatus,
  GuildScheduledEvent,
  ChannelType,
} from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "listEvents",
  description:
    "Lists all scheduled events in the server with optional filtering.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        description:
          "Filter events by status: 'scheduled', 'active', 'completed', 'canceled'",
        example: "scheduled",
      },
      limit: {
        type: Type.NUMBER,
        description:
          "Maximum number of events to return (default: 10, max: 100)",
        example: 10,
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
          events: {
            type: Type.ARRAY,
            description: "List of events matching the criteria.",
            items: {
              type: Type.OBJECT,
              properties: {
                eventId: { type: Type.STRING },
                eventName: { type: Type.STRING },
                eventDescription: { type: Type.STRING },
                startTime: { type: Type.STRING },
                endTime: { type: Type.STRING },
                status: { type: Type.STRING },
                participantCount: { type: Type.NUMBER },
                eventUrl: { type: Type.STRING },
              },
            },
          },
          totalCount: {
            type: Type.NUMBER,
            description: "Total number of events found.",
          },
        },
        required: ["events", "totalCount"],
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
  const functionName = "listEvents";

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
    if (!currentGuild) {
      return { functionName, success: false, data: "Guild not found" };
    }

    const limit = Math.min(data.limit || 10, 100);

    // Fetch all scheduled events
    const events = await currentGuild.scheduledEvents.fetch();
    let eventArray = Array.from(events.values()) as GuildScheduledEvent[];

    // Filter by status if specified
    if (data.status) {
      const statusMap: { [key: string]: GuildScheduledEventStatus } = {
        scheduled: GuildScheduledEventStatus.Scheduled,
        active: GuildScheduledEventStatus.Active,
        completed: GuildScheduledEventStatus.Completed,
        canceled: GuildScheduledEventStatus.Canceled,
      };

      const targetStatus = statusMap[data.status.toLowerCase()];
      if (targetStatus !== undefined) {
        eventArray = eventArray.filter(
          (event: GuildScheduledEvent) => event.status === targetStatus
        );
      }
    }

    // Sort by start time (upcoming first)
    eventArray.sort((a: GuildScheduledEvent, b: GuildScheduledEvent) => {
      const aTime = a.scheduledStartAt?.getTime() || 0;
      const bTime = b.scheduledStartAt?.getTime() || 0;
      return aTime - bTime;
    });

    // Apply limit
    const limitedEvents = eventArray.slice(0, limit);

    // Format the response
    const formattedEvents = limitedEvents.map((event: GuildScheduledEvent) => ({
      eventId: event.id,
      eventName: event.name,
      eventDescription: event.description || "",
      startTime: event.scheduledStartAt?.toISOString() || "",
      endTime: event.scheduledEndAt?.toISOString() || "",
      status: Object.keys(GuildScheduledEventStatus)[event.status] || "unknown",
      participantCount: event.userCount || 0,
      eventUrl: event.url,
    }));

    return {
      functionName,
      success: true,
      data: {
        events: formattedEvents,
        totalCount: eventArray.length,
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
