import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import MySQL from "#libs/MySQL.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { Client } from "discord.js";
import { RowDataPacket } from "mysql2";

export const declaration: FunctionDeclaration = {
  name: "closeTicket",
  description:
    "Closes an existing ticket with optional reason and transcript saving.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticketChannelID: {
        type: Type.STRING,
        description: "The channel ID of the ticket to close.",
        example: "1334114656461258784",
      },
      closedBy: {
        type: Type.STRING,
        description: "The user ID of who is closing the ticket.",
        example: "1234567890123456789",
      },
      reason: {
        type: Type.STRING,
        description: "The reason for closing the ticket.",
        example: "Problem Resolved",
      },
      saveTranscript: {
        type: Type.BOOLEAN,
        description: "Whether to save a transcript of the ticket.",
        example: true,
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["ticketChannelID", "closedBy"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          ticketID: {
            type: Type.STRING,
            description: "The ID of the closed ticket.",
            example: "1",
          },
          channelID: {
            type: Type.STRING,
            description: "The channel ID that was closed.",
            example: "1334114656461258784",
          },
          closedBy: {
            type: Type.STRING,
            description: "The user ID who closed the ticket.",
            example: "1234567890123456789",
          },
          reason: {
            type: Type.STRING,
            description: "The reason for closure.",
            example: "Problem Resolved",
          },
          transcriptSaved: {
            type: Type.BOOLEAN,
            description: "Whether a transcript was saved.",
            example: true,
          },
          closedAt: {
            type: Type.STRING,
            description: "The timestamp when the ticket was closed.",
          },
        },
        required: [
          "ticketID",
          "channelID",
          "closedBy",
          "reason",
          "transcriptSaved",
          "closedAt",
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
  const functionName = "closeTicket";

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

    return {
      functionName,
      success: true,
      data: {
        ticketID: ticketData.id,
        channelID: ticketData.channelID,
        ownerID: ticketData.ownerID,
        category: ticketData.category,
        reason: ticketData.reason,
        priority: ticketData.priority || "medium",
        status: ticketData.status || "open",
        claimedBy: ticketData.claimedBy || null,
        createdAt: ticketData.createdAt,
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
