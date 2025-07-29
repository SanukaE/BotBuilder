import { FunctionDeclaration, Type } from "@google/genai";
import { Client } from "discord.js";
import MySQL from "#libs/MySQL.js";
import { RowDataPacket } from "mysql2";
import getConfig from "#utils/getConfig.js";

export const declaration: FunctionDeclaration = {
  name: "getUserLevel",
  description: "Get detailed leveling information for a specific user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: {
        type: Type.STRING,
        description:
          "The ID of the user to get leveling info for. If not provided, uses the requesting user.",
        example: "1234567890123456789",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the properties requires a value from a different function.",
        example: false,
      },
    },
    required: [],
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
          level: {
            type: Type.NUMBER,
            description: "The user's current level.",
            example: 25,
          },
          experience: {
            type: Type.NUMBER,
            description: "The user's current experience points.",
            example: 15420,
          },
          experienceToNextLevel: {
            type: Type.NUMBER,
            description: "Experience needed to reach the next level.",
            example: 2580,
          },
          totalExperienceForNextLevel: {
            type: Type.NUMBER,
            description: "Total experience required for the next level.",
            example: 18000,
          },
          rank: {
            type: Type.NUMBER,
            description: "The user's rank in the server leaderboard.",
            example: 5,
          },
          multiplier: {
            type: Type.NUMBER,
            description: "The user's current experience multiplier.",
            example: 1.5,
          },
        },
        required: [
          "userId",
          "username",
          "displayName",
          "level",
          "experience",
          "experienceToNextLevel",
          "totalExperienceForNextLevel",
          "rank",
          "multiplier",
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
  const functionName = "getUserLevel";

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
    const targetUserId = data.userId || userID;

    // Get user info
    const targetUser = await client.users.fetch(targetUserId);
    const member = await guild.members.fetch(targetUserId);

    // Get all users ordered by level and experience for ranking
    const [allUsers] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM user_levels ORDER BY level DESC, experience DESC"
    );

    // Find user's data and rank
    const userIndex = allUsers.findIndex((row) => row.userID === targetUserId);
    if (userIndex === -1) {
      return {
        functionName,
        success: false,
        data: `${targetUser.username} has no leveling data`,
      };
    }

    const userData = allUsers[userIndex];
    const level = userData.level;
    const experience = userData.experience;
    const rank = userIndex + 1;

    // Calculate experience requirements
    const startingXPRequirement =
      experienceConfig.startingXPRequirement as number;
    const nextLevelXPRequirement =
      experienceConfig.nextLevelXPRequirement as number;

    const totalExperienceForNextLevel =
      startingXPRequirement * Math.pow(nextLevelXPRequirement, level - 1);
    const experienceToNextLevel = totalExperienceForNextLevel - experience;

    // Calculate multiplier
    let multiplier = 1;
    const boosterCategories: string[] = [
      ...experienceConfig.boosterRoles,
      ...experienceConfig.boosterChannels,
      ...experienceConfig.boosterUsers,
    ];

    for (const booster of boosterCategories) {
      const [boosterID, boosterMultiplier] = booster.split(":");

      if (
        member.roles.cache.has(boosterID) ||
        member.user.id === boosterID ||
        channelID === boosterID
      ) {
        multiplier += experienceConfig.addExperienceMultiplier
          ? parseFloat(boosterMultiplier)
          : Math.max(multiplier, parseFloat(boosterMultiplier));
      }
    }

    return {
      functionName,
      success: true,
      data: {
        userId: targetUser.id,
        username: targetUser.username,
        displayName: member.displayName,
        level,
        experience,
        experienceToNextLevel: Math.max(0, experienceToNextLevel),
        totalExperienceForNextLevel,
        rank,
        multiplier,
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
