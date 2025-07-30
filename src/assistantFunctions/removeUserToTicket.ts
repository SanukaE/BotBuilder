import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import MySQL from "#libs/MySQL.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { Client, TextChannel } from "discord.js";
import { RowDataPacket } from "mysql2";

export const declaration: FunctionDeclaration = {
  name: "removeUserFromTicket",
  description: "Removes a user from an existing ticket, revoking their access.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticketChannelID: {
        type: Type.STRING,
        description: "The channel ID of the ticket.",
        example: "1334114656461258784",
      },
      userID: {
        type: Type.STRING,
        description: "The user ID to remove from the ticket.",
        example: "1234567890123456789",
      },
      removedBy: {
        type: Type.STRING,
        description: "The user ID of who is removing the user.",
        example: "9876543210987654321",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["ticketChannelID", "userID", "removedBy"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          ticketID: {
            type: Type.STRING,
            description: "The ID of the ticket.",
            example: "1",
          },
          channelID: {
            type: Type.STRING,
            description: "The channel ID of the ticket.",
            example: "1334114656461258784",
          },
          userID: {
            type: Type.STRING,
            description: "The user ID that was removed.",
            example: "1234567890123456789",
          },
          removedBy: {
            type: Type.STRING,
            description: "The user ID who removed the user.",
            example: "9876543210987654321",
          },
          removedAt: {
            type: Type.STRING,
            description: "The timestamp when the user was removed.",
          },
        },
        required: ["ticketID", "channelID", "userID", "removedBy", "removedAt"],
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
  const functionName = "removeUserFromTicket";

  try {
    let updatableData = { ...data };
    if (data.requireDataFromPrev) {
      updatableData = setAssistantPlaceholders(functionResults, data);
    }

    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM tickets WHERE channelID = ?",
      [updatableData.ticketChannelID]
    );

    if (rows.length === 0) {
      return {
        functionName,
        success: false,
        data: "Ticket not found",
      };
    }

    const ticketData = rows[0];
    const user = await client.users.fetch(updatableData.userID);

    if (updatableData.userID === ticketData.ownerID) {
      return {
        functionName,
        success: false,
        data: "Cannot remove the ticket owner",
      };
    }

    if (updatableData.userID === updatableData.removedBy) {
      return {
        functionName,
        success: false,
        data: "Cannot remove yourself from the ticket",
      };
    }

    const ticketChannel = (await client.channels.fetch(
      updatableData.ticketChannelID
    )) as TextChannel;

    if (!ticketChannel) {
      return {
        functionName,
        success: false,
        data: "Ticket channel not found",
      };
    }

    // Remove user permissions
    await ticketChannel.permissionOverwrites.edit(user, {
      ViewChannel: false,
    });

    await ticketChannel.send(
      `${user.displayName} has been removed from the ticket.`
    );

    return {
      functionName,
      success: true,
      data: {
        ticketID: ticketData.id.toString(),
        channelID: updatableData.ticketChannelID,
        userID: updatableData.userID,
        removedBy: updatableData.removedBy,
        removedAt: new Date().toISOString(),
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
