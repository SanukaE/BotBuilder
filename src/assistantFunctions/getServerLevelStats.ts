import { FunctionDeclaration, Type } from "@google/genai";
import { Client } from "discord.js";
import MySQL from "#libs/MySQL.js";
import { RowDataPacket } from "mysql2";
import getConfig from "#utils/getConfig.js";

export const declaration: FunctionDeclaration = {
  name: "getServerLevelStats",
  description: "Get comprehensive leveling statistics for the server.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      includeInactiveUsers: {
        type: Type.BOOLEAN,
        description:
          "Whether to include users who have left the server in statistics (default: false).",
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
          totalUsers: {
            type: Type.NUMBER,
            description: "Total number of users with leveling data.",
            example: 150,
          },
          activeUsers: {
            type: Type.NUMBER,
            description: "Number of users still in the server.",
            example: 142,
          },
          averageLevel: {
            type: Type.NUMBER,
            description: "Average level across all users.",
            example: 12.5,
          },
          averageExperience: {
            type: Type.NUMBER,
            description: "Average experience across all users.",
            example: 8750,
          },
          highestLevel: {
            type: Type.NUMBER,
            description: "Highest level achieved.",
            example: 50,
          },
          highestExperience: {
            type: Type.NUMBER,
            description: "Highest experience points.",
            example: 125000,
          },
          levelDistribution: {
            type: Type.ARRAY,
            description: "Distribution of users by level ranges.",
            items: {
              type: Type.OBJECT,
              properties: {
                range: {
                  type: Type.STRING,
                  description: "Level range (e.g., '1-10').",
                  example: "1-10",
                },
                count: {
                  type: Type.NUMBER,
                  description: "Number of users in this range.",
                  example: 45,
                },
                percentage: {
                  type: Type.NUMBER,
                  description: "Percentage of total users.",
                  example: 30.0,
                },
              },
              required: ["range", "count", "percentage"],
            },
          },
          topUser: {
            type: Type.OBJECT,
            description: "Information about the highest-level user.",
            properties: {
              userId: {
                type: Type.STRING,
                description: "User ID.",
                example: "1234567890123456789",
              },
              username: {
                type: Type.STRING,
                description: "Username.",
                example: "top_player",
              },
              level: {
                type: Type.NUMBER,
                description: "User's level.",
                example: 50,
              },
              experience: {
                type: Type.NUMBER,
                description: "User's experience.",
                example: 125000,
              },
            },
            required: ["userId", "username", "level", "experience"],
          },
        },
        required: [
          "totalUsers",
          "activeUsers",
          "averageLevel",
          "averageExperience",
          "highestLevel",
          "highestExperience",
          "levelDistribution",
          "topUser",
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
  const functionName = "getServerLevelStats";

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

    // Get all user level data
    const [allUsers] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM user_levels ORDER BY level DESC, experience DESC"
    );

    if (!allUsers.length) {
      return {
        functionName,
        success: true,
        data: {
          totalUsers: 0,
          activeUsers: 0,
          averageLevel: 0,
          averageExperience: 0,
          highestLevel: 0,
          highestExperience: 0,
          levelDistribution: [],
          topUser: null,
        },
      };
    }

    // Filter active users if requested
    let activeUsers = allUsers;
    let activeUserCount = 0;

    if (!data.includeInactiveUsers) {
      const activeUserPromises = allUsers.map(async (userData) => {
        try {
          await guild.members.fetch(userData.userID);
          return userData;
        } catch {
          return null;
        }
      });

      const resolvedUsers = await Promise.all(activeUserPromises);
      activeUsers = resolvedUsers.filter((user) => user !== null);
      activeUserCount = activeUsers.length;
    } else {
      activeUserCount = allUsers.length;
    }

    // Calculate statistics
    const totalUsers = allUsers.length;
    const levels = activeUsers.map((user) => user.level);
    const experiences = activeUsers.map((user) => user.experience);

    const averageLevel =
      levels.reduce((sum, level) => sum + level, 0) / levels.length;
    const averageExperience =
      experiences.reduce((sum, exp) => sum + exp, 0) / experiences.length;
    const highestLevel = Math.max(...levels);
    const highestExperience = Math.max(...experiences);

    // Level distribution
    const levelRanges = [
      { range: "1-10", min: 1, max: 10 },
      { range: "11-20", min: 11, max: 20 },
      { range: "21-30", min: 21, max: 30 },
      { range: "31-40", min: 31, max: 40 },
      { range: "41-50", min: 41, max: 50 },
      { range: "51+", min: 51, max: Infinity },
    ];

    const levelDistribution = levelRanges
      .map((range) => {
        const count = levels.filter(
          (level) => level >= range.min && level <= range.max
        ).length;
        const percentage = (count / levels.length) * 100;
        return {
          range: range.range,
          count,
          percentage: Math.round(percentage * 10) / 10,
        };
      })
      .filter((dist) => dist.count > 0);

    // Top user
    const topUserData = activeUsers[0];
    let topUser = null;

    if (topUserData) {
      try {
        const member = await guild.members.fetch(topUserData.userID);
        topUser = {
          userId: topUserData.userID,
          username: member.user.username,
          level: topUserData.level,
          experience: topUserData.experience,
        };
      } catch {
        topUser = {
          userId: topUserData.userID,
          username: "Unknown User",
          level: topUserData.level,
          experience: topUserData.experience,
        };
      }
    }

    return {
      functionName,
      success: true,
      data: {
        totalUsers,
        activeUsers: activeUserCount,
        averageLevel: Math.round(averageLevel * 10) / 10,
        averageExperience: Math.round(averageExperience),
        highestLevel,
        highestExperience,
        levelDistribution,
        topUser,
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
