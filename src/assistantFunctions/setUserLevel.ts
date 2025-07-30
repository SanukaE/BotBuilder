import { FunctionDeclaration, Type } from "@google/genai";
import { Client, PermissionFlagsBits } from "discord.js";
import MySQL from "#libs/MySQL.js";
import { RowDataPacket } from "mysql2";
import getConfig from "#utils/getConfig.js";
import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";

export const declaration: FunctionDeclaration = {
  name: "setUserLevel",
  description:
    "Set a user's level or experience points. Requires administrator permissions.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: {
        type: Type.STRING,
        description: "The ID of the user to modify leveling data for.",
        example: "1234567890123456789",
      },
      type: {
        type: Type.STRING,
        description: "Whether to set level or experience.",
        example: "level",
        enum: ["level", "experience"],
      },
      value: {
        type: Type.NUMBER,
        description:
          "The value to set (level must be >= 1, experience must be >= 0).",
        example: 25,
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["userId", "type", "value"],
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
          type: {
            type: Type.STRING,
            description: "What was modified (level or experience).",
            example: "level",
          },
          oldValue: {
            type: Type.NUMBER,
            description: "The previous value.",
            example: 20,
          },
          newValue: {
            type: Type.NUMBER,
            description: "The new value.",
            example: 25,
          },
          updatedAt: {
            type: Type.STRING,
            description: "Timestamp when the change was made.",
          },
        },
        required: [
          "userId",
          "username",
          "displayName",
          "type",
          "oldValue",
          "newValue",
          "updatedAt",
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
  const functionName = "setUserLevel";

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
        data: "You need Administrator permissions to modify user levels",
      };
    }

    // Handle data from previous functions if required
    let updatableData = { ...data };
    if (data.requireDataFromPrev) {
      updatableData = setAssistantPlaceholders(functionResults, data);
    }

    // Validate inputs
    if (!["level", "experience"].includes(updatableData.type)) {
      return {
        functionName,
        success: false,
        data: "Type must be either 'level' or 'experience'",
      };
    }

    if (updatableData.type === "level" && updatableData.value < 1) {
      return {
        functionName,
        success: false,
        data: "Level must be at least 1",
      };
    }

    if (updatableData.type === "experience" && updatableData.value < 0) {
      return {
        functionName,
        success: false,
        data: "Experience must be at least 0",
      };
    }

    // Get target user
    const targetUser = await client.users.fetch(updatableData.userId);
    const targetMember = await guild.members.fetch(updatableData.userId);

    // Prevent self-modification
    if (targetUser.id === userID) {
      return {
        functionName,
        success: false,
        data: "You cannot modify your own level or experience",
      };
    }

    // Prevent bot modification
    if (targetUser.bot) {
      return {
        functionName,
        success: false,
        data: "You cannot modify the level or experience for a bot",
      };
    }

    // Get current user data
    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM user_levels WHERE userID = ?",
      [targetUser.id]
    );

    let oldValue: number;
    let newValue = updatableData.value;

    if (updatableData.type === "level") {
      if (rows.length === 0) {
        // Insert new record
        await MySQL.query(
          "INSERT INTO user_levels (userID, level, experience) VALUES (?, ?, ?)",
          [targetUser.id, newValue, 0]
        );
        oldValue = 1; // Default starting level
      } else {
        // Update existing record
        oldValue = rows[0].level;
        await MySQL.query("UPDATE user_levels SET level = ? WHERE userID = ?", [
          newValue,
          targetUser.id,
        ]);
      }
    } else {
      // experience
      if (rows.length === 0) {
        // Insert new record
        await MySQL.query(
          "INSERT INTO user_levels (userID, level, experience) VALUES (?, ?, ?)",
          [targetUser.id, 1, newValue]
        );
        oldValue = 0; // Default starting experience
      } else {
        // Update existing record
        oldValue = rows[0].experience;
        await MySQL.query(
          "UPDATE user_levels SET experience = ? WHERE userID = ?",
          [newValue, targetUser.id]
        );
      }
    }

    return {
      functionName,
      success: true,
      data: {
        userId: targetUser.id,
        username: targetUser.username,
        displayName: targetMember.displayName,
        type: updatableData.type,
        oldValue,
        newValue,
        updatedAt: new Date().toISOString(),
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
