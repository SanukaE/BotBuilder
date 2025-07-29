import { FunctionDeclaration, Type } from "@google/genai";
import { Client, PermissionFlagsBits } from "discord.js";
import MySQL from "#libs/MySQL.js";
import { RowDataPacket } from "mysql2";
import getConfig from "#utils/getConfig.js";
import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import sendLevelUpMessage from "#utils/sendLevelUpMessage.js";

export const declaration: FunctionDeclaration = {
  name: "addExperience",
  description:
    "Add or remove experience points from a user. Handles level calculations automatically. Requires administrator permissions.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: {
        type: Type.STRING,
        description: "The ID of the user to modify experience for.",
        example: "1234567890123456789",
      },
      amount: {
        type: Type.NUMBER,
        description:
          "Amount of experience to add (positive) or remove (negative).",
        example: 500,
      },
      reason: {
        type: Type.STRING,
        description: "Optional reason for the experience change.",
        example: "Manual adjustment by admin",
      },
      sendLevelUpNotification: {
        type: Type.BOOLEAN,
        description:
          "Whether to send a level up notification if the user levels up (default: true).",
        example: true,
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: ["userId", "amount"],
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
          experienceChange: {
            type: Type.NUMBER,
            description: "The amount of experience that was added/removed.",
            example: 500,
          },
          previousExperience: {
            type: Type.NUMBER,
            description: "The user's experience before the change.",
            example: 1200,
          },
          newExperience: {
            type: Type.NUMBER,
            description: "The user's experience after the change.",
            example: 1700,
          },
          previousLevel: {
            type: Type.NUMBER,
            description: "The user's level before the change.",
            example: 5,
          },
          newLevel: {
            type: Type.NUMBER,
            description: "The user's level after the change.",
            example: 6,
          },
          leveledUp: {
            type: Type.BOOLEAN,
            description: "Whether the user leveled up from this change.",
            example: true,
          },
          leveledDown: {
            type: Type.BOOLEAN,
            description: "Whether the user leveled down from this change.",
            example: false,
          },
          reason: {
            type: Type.STRING,
            description: "The reason for the experience change.",
            example: "Manual adjustment by admin",
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
          "experienceChange",
          "previousExperience",
          "newExperience",
          "previousLevel",
          "newLevel",
          "leveledUp",
          "leveledDown",
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
  const functionName = "addExperience";

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
        data: "You need Administrator permissions to modify user experience",
      };
    }

    // Handle data from previous functions if required
    let updatableData = { ...data };
    if (data.requireDataFromPrev) {
      updatableData = setAssistantPlaceholders(functionResults, data);
    }

    // Validate amount
    if (
      typeof updatableData.amount !== "number" ||
      updatableData.amount === 0
    ) {
      return {
        functionName,
        success: false,
        data: "Amount must be a non-zero number",
      };
    }

    // Get target user
    const targetUser = await client.users.fetch(updatableData.userId);
    const targetMember = await guild.members.fetch(updatableData.userId);

    // Prevent bot modification
    if (targetUser.bot) {
      return {
        functionName,
        success: false,
        data: "You cannot modify experience for a bot",
      };
    }

    // Get current user data
    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM user_levels WHERE userID = ?",
      [targetUser.id]
    );

    let previousLevel: number;
    let previousExperience: number;

    if (rows.length === 0) {
      // User doesn't exist in the database
      previousLevel = 1;
      previousExperience = 0;
    } else {
      previousLevel = rows[0].level;
      previousExperience = rows[0].experience;
    }

    // Calculate new experience (ensure it doesn't go below 0)
    const newExperience = Math.max(
      0,
      previousExperience + updatableData.amount
    );

    // Level calculation functions
    const calculateLevelFromExperience = (exp: number): number => {
      if (exp === 0) return 1;

      const startingXPRequirement =
        experienceConfig.startingXPRequirement as number;
      const nextLevelXPRequirement =
        experienceConfig.nextLevelXPRequirement as number;

      let level = 1;
      let totalXPNeeded = 0;

      while (true) {
        const xpForThisLevel =
          startingXPRequirement * Math.pow(nextLevelXPRequirement, level - 1);
        if (totalXPNeeded + xpForThisLevel > exp) break;
        totalXPNeeded += xpForThisLevel;
        level++;
      }

      return level;
    };

    const getExperienceRequiredForLevel = (level: number): number => {
      if (level <= 1) return 0;

      const startingXPRequirement =
        experienceConfig.startingXPRequirement as number;
      const nextLevelXPRequirement =
        experienceConfig.nextLevelXPRequirement as number;

      let totalXP = 0;
      for (let i = 1; i < level; i++) {
        totalXP +=
          startingXPRequirement * Math.pow(nextLevelXPRequirement, i - 1);
      }

      return totalXP;
    };

    // Calculate new level
    const newLevel = calculateLevelFromExperience(newExperience);

    // Determine level changes
    const leveledUp = newLevel > previousLevel;
    const leveledDown = newLevel < previousLevel;

    // Update or insert user data
    if (rows.length === 0) {
      await MySQL.query(
        "INSERT INTO user_levels (userID, level, experience) VALUES (?, ?, ?)",
        [targetUser.id, newLevel, newExperience]
      );
    } else {
      await MySQL.query(
        "UPDATE user_levels SET level = ?, experience = ? WHERE userID = ?",
        [newLevel, newExperience, targetUser.id]
      );
    }

    // Send level up notification if enabled and user leveled up
    if (leveledUp && updatableData.sendLevelUpNotification !== false) {
      try {
        await sendLevelUpMessage(client, channelID, targetUser.id, newLevel);
      } catch (error) {
        console.warn("Failed to send level up message:", error);
      }
    }

    return {
      functionName,
      success: true,
      data: {
        userId: targetUser.id,
        username: targetUser.username,
        displayName: targetMember.displayName,
        experienceChange: updatableData.amount,
        previousExperience,
        newExperience,
        previousLevel,
        newLevel,
        leveledUp,
        leveledDown,
        reason: updatableData.reason || "Manual experience adjustment",
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
