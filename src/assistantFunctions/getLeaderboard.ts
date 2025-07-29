import { FunctionDeclaration, Type } from "@google/genai";
import { Client } from "discord.js";
import MySQL from "#libs/MySQL.js";
import { RowDataPacket } from "mysql2";
import getConfig from "#utils/getConfig.js";

export const declaration: FunctionDeclaration = {
  name: "getLeaderboard",
  description:
    "Get the leveling leaderboard for the server with specified limit and optional user focus.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: {
        type: Type.NUMBER,
        description:
          "Number of users to include in the leaderboard (default: 10, max: 25).",
        example: 10,
      },
      focusUserId: {
        type: Type.STRING,
        description:
          "If provided, ensures this user is included in the results even if they're outside the top limit.",
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
          leaderboard: {
            type: Type.ARRAY,
            description: "Array of user leveling data ordered by rank.",
            items: {
              type: Type.OBJECT,
              properties: {
                rank: {
                  type: Type.NUMBER,
                  description: "User's rank position.",
                  example: 1,
                },
                userId: {
                  type: Type.STRING,
                  description: "User's ID.",
                  example: "1234567890123456789",
                },
                username: {
                  type: Type.STRING,
                  description: "User's username.",
                  example: "john_doe",
                },
                displayName: {
                  type: Type.STRING,
                  description: "User's display name.",
                  example: "John Doe",
                },
                level: {
                  type: Type.NUMBER,
                  description: "User's current level.",
                  example: 25,
                },
                experience: {
                  type: Type.NUMBER,
                  description: "User's current experience.",
                  example: 15420,
                },
                avatar: {
                  type: Type.STRING,
                  description: "User's avatar URL.",
                  example: "https://cdn.discordapp.com/avatars/123/abc.png",
                },
              },
              required: [
                "rank",
                "userId",
                "username",
                "displayName",
                "level",
                "experience",
                "avatar",
              ],
            },
          },
          totalUsers: {
            type: Type.NUMBER,
            description: "Total number of users in the leveling system.",
            example: 150,
          },
          requestedLimit: {
            type: Type.NUMBER,
            description: "The limit that was requested.",
            example: 10,
          },
          focusedUser: {
            type: Type.OBJECT,
            description:
              "Information about the focused user if one was specified.",
            properties: {
              rank: {
                type: Type.NUMBER,
                description: "The focused user's rank.",
                example: 15,
              },
              inTopResults: {
                type: Type.BOOLEAN,
                description:
                  "Whether the focused user was already in the top results.",
                example: false,
              },
            },
            required: ["rank", "inTopResults"],
          },
        },
        required: ["leaderboard", "totalUsers", "requestedLimit"],
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
  const functionName = "getLeaderboard";

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

    // Validate and set defaults
    const limit = Math.min(Math.max(data.limit || 10, 1), 25);
    const focusUserId = data.focusUserId;

    // Get all users ordered by level and experience
    const [allUsers] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM user_levels ORDER BY level DESC, experience DESC"
    );

    if (!allUsers.length) {
      return {
        functionName,
        success: true,
        data: {
          leaderboard: [],
          totalUsers: 0,
          requestedLimit: limit,
        },
      };
    }

    // Get top users
    const topUsers = allUsers.slice(0, limit);
    let leaderboardUsers = [...topUsers];
    let focusedUserInfo = null;

    // Handle focused user if specified
    if (focusUserId) {
      const focusedUserIndex = allUsers.findIndex(
        (user) => user.userID === focusUserId
      );

      if (focusedUserIndex !== -1) {
        const focusedUserRank = focusedUserIndex + 1;
        const isInTopResults = focusedUserIndex < limit;

        focusedUserInfo = {
          rank: focusedUserRank,
          inTopResults: isInTopResults,
        };

        // If focused user is not in top results, add them
        if (!isInTopResults) {
          leaderboardUsers.push(allUsers[focusedUserIndex]);
        }
      }
    }

    // Build leaderboard data with user information
    const leaderboard = await Promise.all(
      leaderboardUsers.map(async (userData, index) => {
        const actualRank =
          allUsers.findIndex((user) => user.userID === userData.userID) + 1;

        try {
          const member = await guild.members.fetch(userData.userID);
          return {
            rank: actualRank,
            userId: userData.userID,
            username: member.user.username,
            displayName: member.displayName,
            level: userData.level,
            experience: userData.experience,
            avatar: member.user.displayAvatarURL({
              extension: "png",
              size: 128,
            }),
          };
        } catch {
          // Handle case where user left the server
          return {
            rank: actualRank,
            userId: userData.userID,
            username: "Unknown User",
            displayName: "Unknown User",
            level: userData.level,
            experience: userData.experience,
            avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
          };
        }
      })
    );

    // Sort leaderboard by rank to ensure proper order
    leaderboard.sort((a, b) => a.rank - b.rank);

    const result: any = {
      leaderboard,
      totalUsers: allUsers.length,
      requestedLimit: limit,
    };

    if (focusedUserInfo) {
      result.focusedUser = focusedUserInfo;
    }

    return {
      functionName,
      success: true,
      data: result,
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
