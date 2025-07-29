import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import MySQL from "#libs/MySQL.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { Client } from "discord.js";
import { RowDataPacket } from "mysql2";

export const declaration: FunctionDeclaration = {
  name: "listUserTickets",
  description: "Lists all tickets owned by a specific user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userID: {
        type: Type.STRING,
        description: "The user ID to list tickets for.",
        example: "1234567890123456789",
      },
      status: {
        type: Type.STRING,
        description: "Filter tickets by status (optional).",
        example: "open",
      },
      category: {
        type: Type.STRING,
        description: "Filter tickets by category (optional).",
        example: "General Support",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["userID"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          userID: {
            type: Type.STRING,
            description: "The user ID that was searched.",
            example: "1234567890123456789",
          },
          totalTickets: {
            type: Type.NUMBER,
            description: "The total number of tickets found.",
            example: 3,
          },
          tickets: {
            type: Type.ARRAY,
            description: "Array of ticket information.",
            items: {
              type: Type.OBJECT,
              properties: {
                ticketID: {
                  type: Type.NUMBER,
                  description: "The database ID of the ticket.",
                  example: 1,
                },
                channelID: {
                  type: Type.STRING,
                  description: "The Discord channel ID of the ticket.",
                  example: "1334114656461258784",
                },
                category: {
                  type: Type.STRING,
                  description: "The category of the ticket.",
                  example: "General Support",
                },
                status: {
                  type: Type.STRING,
                  description: "The current status of the ticket.",
                  example: "open",
                },
                claimedBy: {
                  type: Type.STRING,
                  description:
                    "The user ID of who claimed the ticket (if any).",
                  example: "9876543210987654321",
                },
                createdAt: {
                  type: Type.STRING,
                  description: "The timestamp when the ticket was created.",
                },
              },
              required: [
                "ticketID",
                "channelID",
                "category",
                "status",
                "createdAt",
              ],
            },
          },
        },
        required: ["userID", "totalTickets", "tickets"],
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
  const functionName = "listUserTickets";

  try {
    let updatableData = { ...data };
    if (data.requireDataFromPrev) {
      updatableData = setAssistantPlaceholders(functionResults, data);
    }

    let query = "SELECT * FROM tickets WHERE ownerID = ?";
    const queryParams: any[] = [updatableData.userID];

    if (updatableData.status) {
      query += " AND status = ?";
      queryParams.push(updatableData.status);
    }

    if (updatableData.category) {
      query += " AND category = ?";
      queryParams.push(updatableData.category);
    }

    query += " ORDER BY createdAt DESC";

    const [rows] = await MySQL.query<RowDataPacket[]>(query, queryParams);

    const tickets = rows.map((ticket) => ({
      ticketID: ticket.id,
      channelID: ticket.channelID,
      category: ticket.category,
      status: ticket.status || "open",
      claimedBy: ticket.claimedBy || null,
      createdAt: ticket.createdAt,
    }));

    return {
      functionName,
      success: true,
      data: {
        userID: updatableData.userID,
        totalTickets: tickets.length,
        tickets,
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
