import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { ChannelType, Client } from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "fetchUser",
  description:
    "Fetch detailed information about a Discord user by ID, username, or display name.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      userId: {
        type: Type.STRING,
        description:
          "The ID of the user to fetch (optional if username or displayName is provided).",
        example: "1234567890123456789",
      },
      username: {
        type: Type.STRING,
        description:
          "The username of the user to fetch (optional if userId or displayName is provided).",
        example: "john_doe",
      },
      displayName: {
        type: Type.STRING,
        description:
          "The display name of the user to fetch (optional if userId or username is provided).",
        example: "John Doe",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the property requires a value from a different function.",
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
            description: "The ID of the user.",
            example: "1234567890123456789",
          },
          username: {
            type: Type.STRING,
            description: "The username of the user.",
            example: "john_doe",
          },
          globalName: {
            type: Type.STRING,
            description: "The global display name of the user.",
            example: "John Doe",
          },
          discriminator: {
            type: Type.STRING,
            description: "The discriminator of the user (legacy).",
            example: "1234",
          },
          tag: {
            type: Type.STRING,
            description:
              "The full tag of the user (username#discriminator or @username).",
            example: "john_doe#1234",
          },
          bot: {
            type: Type.BOOLEAN,
            description: "Whether the user is a bot.",
            example: false,
          },
          system: {
            type: Type.BOOLEAN,
            description: "Whether the user is a system user.",
            example: false,
          },
          createdAt: {
            type: Type.STRING,
            description: "The timestamp when the user's account was created.",
          },
          avatarURL: {
            type: Type.STRING,
            description: "The URL of the user's avatar.",
            example:
              "https://cdn.discordapp.com/avatars/1234567890123456789/avatar_hash.png",
          },
          bannerURL: {
            type: Type.STRING,
            description: "The URL of the user's banner.",
            example:
              "https://cdn.discordapp.com/banners/1234567890123456789/banner_hash.png",
          },
          accentColor: {
            type: Type.NUMBER,
            description: "The accent color of the user's profile.",
            example: 16711680,
          },
          flags: {
            type: Type.ARRAY,
            description: "The public flags of the user.",
            items: { type: Type.STRING },
            example: ["Staff", "HypesquadOnlineHouse1"],
          },
          guildMember: {
            type: Type.OBJECT,
            description:
              "Guild-specific information about the user (if in the same guild).",
            properties: {
              nickname: {
                type: Type.STRING,
                description: "The nickname of the user in the guild.",
                example: "Johnny",
              },
              displayName: {
                type: Type.STRING,
                description: "The display name of the user in the guild.",
                example: "Johnny",
              },
              joinedAt: {
                type: Type.STRING,
                description: "The timestamp when the user joined the guild.",
              },
              premiumSince: {
                type: Type.STRING,
                description:
                  "The timestamp when the user started boosting the guild.",
              },
              roles: {
                type: Type.ARRAY,
                description: "The roles of the user in the guild.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    roleId: {
                      type: Type.STRING,
                      description: "The ID of the role.",
                    },
                    roleName: {
                      type: Type.STRING,
                      description: "The name of the role.",
                    },
                    color: {
                      type: Type.NUMBER,
                      description: "The color of the role.",
                    },
                    position: {
                      type: Type.NUMBER,
                      description: "The position of the role.",
                    },
                    permissions: {
                      type: Type.ARRAY,
                      description: "The permissions of the role.",
                      items: { type: Type.STRING },
                    },
                  },
                },
              },
              permissions: {
                type: Type.ARRAY,
                description: "The permissions of the user in the guild.",
                items: { type: Type.STRING },
              },
              manageable: {
                type: Type.BOOLEAN,
                description: "Whether the bot can manage this user.",
                example: true,
              },
              kickable: {
                type: Type.BOOLEAN,
                description: "Whether the bot can kick this user.",
                example: true,
              },
              bannable: {
                type: Type.BOOLEAN,
                description: "Whether the bot can ban this user.",
                example: true,
              },
              moderatable: {
                type: Type.BOOLEAN,
                description: "Whether the bot can moderate this user.",
                example: true,
              },
              voice: {
                type: Type.OBJECT,
                description: "Voice state information of the user.",
                properties: {
                  channelId: {
                    type: Type.STRING,
                    description: "The ID of the voice channel the user is in.",
                  },
                  channelName: {
                    type: Type.STRING,
                    description:
                      "The name of the voice channel the user is in.",
                  },
                  muted: {
                    type: Type.BOOLEAN,
                    description: "Whether the user is server muted.",
                  },
                  deafened: {
                    type: Type.BOOLEAN,
                    description: "Whether the user is server deafened.",
                  },
                  selfMuted: {
                    type: Type.BOOLEAN,
                    description: "Whether the user is self muted.",
                  },
                  selfDeafened: {
                    type: Type.BOOLEAN,
                    description: "Whether the user is self deafened.",
                  },
                  streaming: {
                    type: Type.BOOLEAN,
                    description: "Whether the user is streaming.",
                  },
                  videoEnabled: {
                    type: Type.BOOLEAN,
                    description: "Whether the user has video enabled.",
                  },
                },
              },
            },
          },
        },
        required: ["userId", "username", "tag", "bot", "system", "createdAt"],
      },
    },
  },
};

export const script = async (
  client: Client,
  channelID: string,
  userID: string,
  functionResults: { functionName: string; success: boolean; data: any }[],
  data: any
) => {
  const functionName = "fetchUser";

  try {
    const currentChannel = await client.channels.fetch(channelID);
    if (!currentChannel) {
      return {
        functionName,
        success: false,
        data: "Current channel not found",
      };
    }

    let updatableData = { ...data };

    // Handle data from previous functions if required
    if (data.requireDataFromPrev)
      updatableData = setAssistantPlaceholders(functionResults, data);

    let targetUser;
    let guildMember = null;

    if (updatableData.userId) {
      // Fetch by ID
      try {
        targetUser = await client.users.fetch(updatableData.userId);
      } catch (error) {
        return {
          functionName,
          success: false,
          data: `User with ID ${updatableData.userId} not found`,
        };
      }
    } else if (updatableData.username || updatableData.displayName) {
      // For username/displayName search, we need to be in a guild
      if (
        currentChannel.type === ChannelType.DM ||
        currentChannel.type === ChannelType.GroupDM
      ) {
        return {
          functionName,
          success: false,
          data: "Cannot search by username/displayName in DMs",
        };
      }

      const currentGuild = currentChannel.guild;
      const guildMembers = await currentGuild.members.fetch();

      let foundMember;
      if (updatableData.username) {
        foundMember = guildMembers.find(
          (member) =>
            member.user.username.toLowerCase() ===
            updatableData.username.toLowerCase()
        );
      } else if (updatableData.displayName) {
        foundMember = guildMembers.find(
          (member) =>
            member.displayName.toLowerCase() ===
              updatableData.displayName.toLowerCase() ||
            (member.user.globalName &&
              member.user.globalName.toLowerCase() ===
                updatableData.displayName.toLowerCase())
        );
      }

      if (!foundMember) {
        const searchTerm = updatableData.username || updatableData.displayName;
        return {
          functionName,
          success: false,
          data: `User with ${
            updatableData.username ? "username" : "display name"
          } "${searchTerm}" not found in this guild`,
        };
      }

      targetUser = foundMember.user;
      guildMember = foundMember;
    } else {
      return {
        functionName,
        success: false,
        data: "Either userId, username, or displayName must be provided",
      };
    }

    // If we don't have guild member info yet and we're in a guild, try to fetch it
    if (
      !guildMember &&
      currentChannel.type !== ChannelType.DM &&
      currentChannel.type !== ChannelType.GroupDM
    ) {
      try {
        const currentGuild = currentChannel.guild;
        guildMember = await currentGuild.members.fetch(targetUser.id);
      } catch (error) {
        // User might not be in the guild, that's okay
        guildMember = null;
      }
    }

    // Build user flags array
    const userFlags = targetUser.flags?.toArray() || [];

    // Build response data
    const responseData: any = {
      userId: targetUser.id,
      username: targetUser.username,
      globalName: targetUser.globalName || null,
      discriminator: targetUser.discriminator,
      tag: targetUser.tag,
      bot: targetUser.bot,
      system: targetUser.system || false,
      createdAt: targetUser.createdAt.toISOString(),
      avatarURL: targetUser.displayAvatarURL({ size: 1024 }) || null,
      bannerURL: targetUser.bannerURL({ size: 1024 }) || null,
      accentColor: targetUser.accentColor || null,
      flags: userFlags,
      guildMember: null,
    };

    // Add guild member information if available
    if (guildMember) {
      // Get voice channel info if user is in voice
      let voiceInfo = null;
      if (guildMember.voice.channel) {
        voiceInfo = {
          channelId: guildMember.voice.channel.id,
          channelName: guildMember.voice.channel.name,
          muted: guildMember.voice.serverMute,
          deafened: guildMember.voice.serverDeaf,
          selfMuted: guildMember.voice.selfMute,
          selfDeafened: guildMember.voice.selfDeaf,
          streaming: guildMember.voice.streaming,
          videoEnabled: guildMember.voice.selfVideo,
        };
      }

      // Get roles information
      const roleData = guildMember.roles.cache
        .filter((role) => role.id !== guildMember.guild.id) // Exclude @everyone role
        .map((role) => ({
          roleId: role.id,
          roleName: role.name,
          color: role.color,
          position: role.position,
          permissions: role.permissions.toArray(),
        }))
        .sort((a, b) => b.position - a.position);

      responseData.guildMember = {
        nickname: guildMember.nickname || null,
        displayName: guildMember.displayName,
        joinedAt: guildMember.joinedAt?.toISOString() || null,
        premiumSince: guildMember.premiumSince?.toISOString() || null,
        roles: roleData,
        permissions: guildMember.permissions.toArray(),
        manageable: guildMember.manageable,
        kickable: guildMember.kickable,
        bannable: guildMember.bannable,
        moderatable: guildMember.moderatable,
        voice: voiceInfo,
      };
    }

    return {
      functionName,
      success: true,
      data: responseData,
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
