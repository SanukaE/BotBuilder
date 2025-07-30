import { FunctionDeclaration, Type } from "@google/genai";
import { Client, PermissionFlagsBits } from "discord.js";
import MySQL from "#libs/MySQL.js";
import { RowDataPacket } from "mysql2";
import getConfig from "#utils/getConfig.js";
import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";

export const declaration: FunctionDeclaration = {
  name: "resetUserLevel",
  description:
    "Reset a user's level and experience back to starting values. Requires administrator permissions.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: {
        type: Type.STRING,
        description: "The ID of the user to reset.",
        example: "1234567890123456789",
      },
      reason: {
        type: Type.STRING,
        description: "Optional reason for the reset.",
        example: "Account reset requested by user",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["userId"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          userId: {
            type: Type.STRING,
            description: "The user's ID.",
            example: "1234567890123456789",
          },
          username: {
            type: Type.STRING,
            description: "The user's username.",
            example: "john_doe",
          },
          displayName: {
            type: Type.STRING,
            description: "The user's display name.",
            example: "John Doe",
          },
          previousLevel: {
            type: Type.NUMBER,
            description: "The user's level before reset.",
            example: 25,
          },
          previousExperience: {
            type: Type.NUMBER,
            description: "The user's experience before reset.",
            example: 15420,
          },
          newLevel: {
            type: Type.NUMBER,
            description: "The user's level after reset (always 1).",
            example: 1,
          },
          newExperience: {
            type: Type.NUMBER,
            description: "The user's experience after reset (always 0).",
            example: 0,
          },
          reason: {
            type: Type.STRING,
            description: "The reason for the reset.",
            example: "Account reset requested by user",
          },
          resetAt: {
            type: Type.STRING,
            description: "Timestamp when the reset was performed.",
          },
        },
        required: [
          "userId",
          "username",
          "displayName",
          "previousLevel",
          "previousExperience",
          "newLevel",
          "newExperience",
          "resetAt",
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
  const functionName = "resetUserLevel";

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
        data: "You need Administrator permissions to reset user levels",
      };
    }

    // Handle data from previous functions if required
    let updatableData = { ...data };
    if (data.requireDataFromPrev) {
      updatableData = setAssistantPlaceholders(functionResults, data);
    }

    // Get target user
    const targetUser = await client.users.fetch(updatableData.userId);
    const targetMember = await guild.members.fetch(updatableData.userId);

    // Prevent bot modification
    if (targetUser.bot) {
      return {
        functionName,
        success: false,
        data: "You cannot reset levels for a bot",
      };
    }

    // Get current user data
    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM user_levels WHERE userID = ?",
      [targetUser.id]
    );

    let previousLevel = 1;
    let previousExperience = 0;

    if (rows.length > 0) {
      previousLevel = rows[0].level;
      previousExperience = rows[0].experience;

      // Update existing record
      await MySQL.query(
        "UPDATE user_levels SET level = 1, experience = 0 WHERE userID = ?",
        [targetUser.id]
      );
    } else {
      // Insert new record with default values
      await MySQL.query(
        "INSERT INTO user_levels (userID, level, experience) VALUES (?, 1, 0)",
        [targetUser.id]
      );
    }

    return {
      functionName,
      success: true,
      data: {
        userId: targetUser.id,
        username: targetUser.username,
        displayName: targetMember.displayName,
        previousLevel,
        previousExperience,
        newLevel: 1,
        newExperience: 0,
        reason: updatableData.reason || "Level reset by administrator",
        resetAt: new Date().toISOString(),
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
