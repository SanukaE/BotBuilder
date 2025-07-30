import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import MySQL from "#libs/MySQL.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { Client, TextChannel } from "discord.js";
import { RowDataPacket } from "mysql2";

export const declaration: FunctionDeclaration = {
  name: "claimTicket",
  description: "Claims an unclaimed ticket for a support staff member.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticketChannelID: {
        type: Type.STRING,
        description: "The channel ID of the ticket to claim.",
        example: "1334114656461258784",
      },
      claimedBy: {
        type: Type.STRING,
        description: "The user ID of the support staff claiming the ticket.",
        example: "1234567890123456789",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["ticketChannelID", "claimedBy"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          ticketID: {
            type: Type.STRING,
            description: "The ID of the claimed ticket.",
            example: "1",
          },
          channelID: {
            type: Type.STRING,
            description: "The channel ID of the ticket.",
            example: "1334114656461258784",
          },
          claimedBy: {
            type: Type.STRING,
            description: "The user ID who claimed the ticket.",
            example: "1234567890123456789",
          },
          ownerID: {
            type: Type.STRING,
            description: "The user ID of the ticket owner.",
            example: "9876543210987654321",
          },
          claimedAt: {
            type: Type.STRING,
            description: "The timestamp when the ticket was claimed.",
          },
        },
        required: [
          "ticketID",
          "channelID",
          "claimedBy",
          "ownerID",
          "claimedAt",
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
  const functionName = "claimTicket";

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

    if (ticketData.claimedBy) {
      const claimUser = await client.users.fetch(ticketData.claimedBy);
      return {
        functionName,
        success: false,
        data: `Ticket already claimed by ${claimUser.displayName} (${claimUser.username})`,
      };
    }

    // Update database
    await MySQL.query("UPDATE tickets SET claimedBy = ? WHERE channelID = ?", [
      updatableData.claimedBy,
      updatableData.ticketChannelID,
    ]);

    const ticketChannel = (await client.channels.fetch(
      updatableData.ticketChannelID
    )) as TextChannel;
    const claimer = await client.users.fetch(updatableData.claimedBy);

    if (ticketChannel) {
      await ticketChannel.send(
        `This ticket is now claimed by <@${updatableData.claimedBy}>!`
      );
    }

    // Notify ticket owner
    try {
      const ticketOwner = await client.users.fetch(ticketData.ownerID);
      await ticketOwner.send(
        `Hey ${ticketOwner.displayName}, your ${ticketData.category} ticket has been claimed by ${claimer.displayName}.`
      );
    } catch (error) {
      console.error("Failed to notify ticket owner:", error);
    }

    return {
      functionName,
      success: true,
      data: {
        ticketID: ticketData.id.toString(),
        channelID: updatableData.ticketChannelID,
        claimedBy: updatableData.claimedBy,
        ownerID: ticketData.ownerID,
        claimedAt: new Date().toISOString(),
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
