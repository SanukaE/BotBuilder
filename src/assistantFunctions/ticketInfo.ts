import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import MySQL from "#libs/MySQL.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { Client } from "discord.js";
import { RowDataPacket } from "mysql2";

export const declaration: FunctionDeclaration = {
  name: "getTicketInfo",
  description: "Retrieves detailed information about a specific ticket.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticketChannelID: {
        type: Type.STRING,
        description: "The channel ID of the ticket to get info for.",
        example: "1334114656461258784",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["ticketChannelID"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
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
          ownerID: {
            type: Type.STRING,
            description: "The user ID of the ticket owner.",
            example: "1234567890123456789",
          },
          category: {
            type: Type.STRING,
            description: "The category of the ticket.",
            example: "General Support",
          },
          reason: {
            type: Type.STRING,
            description: "The reason for creating the ticket.",
            example: "Need help with bot configuration",
          },
          priority: {
            type: Type.STRING,
            description: "The priority level of the ticket.",
            example: "medium",
          },
          status: {
            type: Type.STRING,
            description: "The current status of the ticket.",
            example: "open",
          },
          claimedBy: {
            type: Type.STRING,
            description: "The user ID of who claimed the ticket (if any).",
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
          "ownerID",
          "category",
          "reason",
          "priority",
          "status",
          "createdAt",
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
  const functionName = "getTicketInfo";

  try {
    let updatableData = { ...data };
    if (data.requireDataFromPrev) {
      updatableData = setAssistantPlaceholders(functionResults, data);
    }

    // Ensure ticketChannelID is valid before proceeding
    if (
      updatableData.ticketChannelID &&
      typeof updatableData.ticketChannelID === "string" &&
      updatableData.ticketChannelID.includes("::")
    ) {
      return {
        functionName,
        success: false,
        data: `Failed to resolve ticketChannelID: ${updatableData.ticketChannelID}`,
      };
    }

    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM tickets WHERE channelID = ?",
      [updatableData.ticketChannelID]
    );

    if (rows.length === 0) {
      return {
        functionName,
        success: false,
        data: "Ticket not found with the provided channel ID",
      };
    }

    const ticket = rows[0];

    // Try to fetch the Discord channel to get creation timestamp
    let createdAt = new Date().toISOString(); // fallback
    try {
      const channel = await client.channels.fetch(
        updatableData.ticketChannelID
      );
      if (channel && "createdAt" in channel) {
        createdAt = channel.createdAt!.toISOString();
      }
    } catch (error) {
      // Channel might be deleted, use fallback timestamp
      console.warn(
        `Could not fetch channel ${updatableData.ticketChannelID}:`,
        error
      );
    }

    // Parse formData if it exists and extract additional ticket information
    let formData = {};
    if (ticket.formData) {
      try {
        formData =
          typeof ticket.formData === "string"
            ? JSON.parse(ticket.formData)
            : ticket.formData;
      } catch (error) {
        console.warn("Failed to parse formData:", error);
      }
    }

    // Extract ticket details from formData or use defaults
    const ticketInfo = {
      reason: (formData as any)?.reason || "No reason provided",
      priority: (formData as any)?.priority || "medium",
      status: (formData as any)?.status || "open",
      ticketID: ticket.id || rows.indexOf(ticket) + 1, // Use database ID or fallback to row index
    };

    return {
      functionName,
      success: true,
      data: {
        ticketID: ticketInfo.ticketID,
        channelID: ticket.channelID,
        ownerID: ticket.ownerID,
        category: ticket.category,
        reason: ticketInfo.reason,
        priority: ticketInfo.priority,
        status: ticketInfo.status,
        claimedBy: ticket.claimedBy || null,
        createdAt: createdAt,
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
