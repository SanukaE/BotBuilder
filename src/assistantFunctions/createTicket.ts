import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import MySQL from "#libs/MySQL.js";
import getConfig from "#utils/getConfig.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { ChannelType, Client, PermissionFlagsBits } from "discord.js";
import { RowDataPacket } from "mysql2";

const supportConfig = getConfig("support") as any;

export const declaration: FunctionDeclaration = {
  name: "createTicket",
  description:
    "Creates a new support ticket for a user with specified category and details.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userID: {
        type: Type.STRING,
        description: "The ID of the user creating the ticket.",
        example: "1234567890123456789",
      },
      category: {
        type: Type.STRING,
        description: "The category/type of the ticket.",
        example: "General Support",
      },
      reason: {
        type: Type.STRING,
        description: "The reason or description for creating the ticket.",
        example: "Need help with bot configuration",
      },
      priority: {
        type: Type.STRING,
        description: "Priority level of the ticket.",
        example: "medium",
      },
      supportTeamRoleID: {
        type: Type.STRING,
        description: "The role ID of the support team to mention.",
        example: "1234567890123456789",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["userID", "category", "reason"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          ticketID: {
            type: Type.NUMBER,
            description: "The database ID of the created ticket.",
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
          createdAt: {
            type: Type.STRING,
            description: "The timestamp when the ticket was created.",
          },
          status: {
            type: Type.STRING,
            description: "The current status of the ticket.",
            example: "open",
          },
        },
        required: [
          "ticketID",
          "channelID",
          "ownerID",
          "category",
          "createdAt",
          "status",
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
  const functionName = "createTicket";

  try {
    if (!supportConfig.enableTicketSystem) {
      return {
        functionName,
        success: false,
        data: "Ticket system is disabled",
      };
    }

    const currentChannel = await client.channels.fetch(channelID);
    if (
      !currentChannel ||
      currentChannel.type === ChannelType.DM ||
      currentChannel.type === ChannelType.GroupDM
    ) {
      return {
        functionName,
        success: false,
        data: "Cannot create tickets in DMs",
      };
    }

    let updatableData = { ...data };
    if (data.requireDataFromPrev) {
      updatableData = setAssistantPlaceholders(functionResults, data);
    }

    const guild = currentChannel.guild;
    const ticketOwner = await client.users.fetch(updatableData.userID);

    if (!supportConfig.allowMultipleTickets) {
      const [existingTickets] = await MySQL.query<RowDataPacket[]>(
        "SELECT * FROM tickets WHERE category = ? AND ownerID = ?",
        [updatableData.category, updatableData.userID]
      );

      if (existingTickets.length > 0) {
        return {
          functionName,
          success: false,
          data: `User already has an open ticket in category: ${updatableData.category}`,
        };
      }
    }

    // Create ticket channel
    const ticketChannel = await guild.channels.create({
      name: `ticket-${ticketOwner.username}`,
      type: ChannelType.GuildText,
      parent: supportConfig.ticketCategoryID,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: updatableData.userID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        ...(updatableData.supportTeamRoleID
          ? [
              {
                id: updatableData.supportTeamRoleID,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageMessages,
                ],
              },
            ]
          : []),
      ],
    });

    // Insert ticket into database
    const [result] = await MySQL.query(
      "INSERT INTO tickets (channelID, ownerID, category, reason, priority, createdAt, status) VALUES (?, ?, ?, ?, ?, NOW(), 'open')",
      [
        ticketChannel.id,
        updatableData.userID,
        updatableData.category,
        updatableData.reason,
        updatableData.priority || "medium",
      ]
    );

    const ticketID = (result as any).insertId;

    // Send welcome message
    const welcomeMessage =
      supportConfig.ticketWelcomeMessage ||
      `Hello <@${updatableData.userID}>, thank you for creating a ticket. Please describe your issue and we'll help you as soon as possible.`;

    await ticketChannel.send(welcomeMessage);

    if (updatableData.supportTeamRoleID && supportConfig.mentionSupportTeam) {
      await ticketChannel.send(
        `<@&${updatableData.supportTeamRoleID}> - New ticket created`
      );
    }

    return {
      functionName,
      success: true,
      data: {
        ticketID,
        channelID: ticketChannel.id,
        ownerID: updatableData.userID,
        category: updatableData.category,
        createdAt: new Date().toISOString(),
        status: "open",
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
