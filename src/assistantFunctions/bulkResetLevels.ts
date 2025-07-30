import { FunctionDeclaration, Type } from "@google/genai";
import { Client, PermissionFlagsBits } from "discord.js";
import MySQL from "#libs/MySQL.js";
import { RowDataPacket } from "mysql2";
import getConfig from "#utils/getConfig.js";

export const declaration: FunctionDeclaration = {
  name: "bulkResetLevels",
  description:
    "Reset all users' levels and experience in the server. This is a destructive operation that requires administrator permissions.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      confirmReset: {
        type: Type.BOOLEAN,
        description: "Must be set to true to confirm the bulk reset operation.",
        example: true,
      },
      reason: {
        type: Type.STRING,
        description: "Reason for the bulk reset.",
        example: "Server leveling system reset",
      },
    },
    required: ["confirmReset"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          usersReset: {
            type: Type.NUMBER,
            description: "Number of users that were reset.",
            example: 150,
          },
          reason: {
            type: Type.STRING,
            description: "The reason for the bulk reset.",
            example: "Server leveling system reset",
          },
          resetAt: {
            type: Type.STRING,
            description: "Timestamp when the bulk reset was performed.",
          },
          performedBy: {
            type: Type.STRING,
            description: "ID of the user who performed the reset.",
            example: "1234567890123456789",
          },
        },
        required: ["usersReset", "resetAt", "performedBy"],
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
  const functionName = "bulkResetLevels";

  try {
    // Get experience config
    const experienceConfig = getConfig("experience") as any;
    if (!experienceConfig.enableExperience) {
      return {
        functionName,
        success: false,
        data: "Experience system is disabled",
      };
    }

    // Get current channel and guild
    const currentChannel = await client.channels.fetch(channelID);
    if (!currentChannel || !("guild" in currentChannel)) {
      return {
        functionName,
        success: false,
        data: "Channel not found or not in a guild",
      };
    }

    const guild = currentChannel.guild;
    const requestingMember = await guild.members.fetch(userID);

    // Check permissions
    if (!requestingMember.permissions.has(PermissionFlagsBits.Administrator)) {
      return {
        functionName,
        success: false,
        data: "You need Administrator permissions to perform bulk level reset",
      };
    }

    // Validate confirmation
    if (!data.confirmReset) {
      return {
        functionName,
        success: false,
        data: "You must set confirmReset to true to perform this destructive operation",
      };
    }

    // Get current count of users
    const [countResult] = await MySQL.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM user_levels"
    );
    const usersCount = countResult[0].count;

    // Reset all users to level 1, experience 0
    await MySQL.query("UPDATE user_levels SET level = 1, experience = 0");

    return {
      functionName,
      success: true,
      data: {
        usersReset: usersCount,
        reason: data.reason || "Bulk level reset performed by administrator",
        resetAt: new Date().toISOString(),
        performedBy: userID,
      },
    };
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    return {
      functionName,
      success: false,
      data: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};
