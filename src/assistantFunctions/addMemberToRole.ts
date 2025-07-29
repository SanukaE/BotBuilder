import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { ChannelType, Client, PermissionFlagsBits } from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "addMemberToRole",
  description: "Add a member to a discord role.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      roleId: {
        type: Type.STRING,
        description: "The ID of the role to add the member to.",
        example: "1334114656461258784",
      },
      memberId: {
        type: Type.STRING,
        description: "The ID of the member to add to the role.",
        example: "1234567890123456789",
      },
      reason: {
        type: Type.STRING,
        description: "The reason for adding the member to the role (optional).",
        example: "Promoting user to moderator",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the property requires a value from a different function.",
        example: false,
      },
    },
    required: ["roleId", "memberId"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          roleId: {
            type: Type.STRING,
            description: "The ID of the role.",
            example: "1334114656461258784",
          },
          roleName: {
            type: Type.STRING,
            description: "The name of the role.",
            example: "Moderator",
          },
          memberId: {
            type: Type.STRING,
            description: "The ID of the member.",
            example: "1234567890123456789",
          },
          memberTag: {
            type: Type.STRING,
            description: "The tag (username#discriminator) of the member.",
            example: "user#1234",
          },
          memberDisplayName: {
            type: Type.STRING,
            description: "The display name of the member in the guild.",
            example: "UserDisplayName",
          },
          addedAt: {
            type: Type.STRING,
            description: "The timestamp when the member was added to the role.",
          },
        },
        required: [
          "roleId",
          "roleName",
          "memberId",
          "memberTag",
          "memberDisplayName",
          "addedAt",
        ],
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
  const functionName = "addMemberToRole";

  try {
    const currentChannel = await client.channels.fetch(channelID);
    if (!currentChannel) {
      return { functionName, success: false, data: "Channel not found" };
    }

    if (
      currentChannel.type === ChannelType.DM ||
      currentChannel.type === ChannelType.GroupDM
    ) {
      return {
        functionName,
        success: false,
        data: "Cannot manage roles in DMs",
      };
    }

    const currentGuild = currentChannel.guild;
    const guildMember = await currentGuild.members.fetch(userID);

    // Check if user has MANAGE_ROLES permission
    if (!guildMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return {
        functionName,
        success: false,
        data: "User does not have MANAGE_ROLES permission",
      };
    }

    let updatableData = { ...data };

    // Handle data from previous functions if required
    if (data.requireDataFromPrev)
      updatableData = setAssistantPlaceholders(functionResults, data);

    // Fetch the role
    const role = await currentGuild.roles.fetch(updatableData.roleId);
    if (!role) {
      return {
        functionName,
        success: false,
        data: "Role not found",
      };
    }

    // Check if user can manage this role (role hierarchy)
    if (role.position >= guildMember.roles.highest.position && guildMember.id !== currentGuild.ownerId) {
      return {
        functionName,
        success: false,
        data: "Cannot manage role with equal or higher position",
      };
    }

    // Fetch the member to add to the role
    const memberToAdd = await currentGuild.members.fetch(updatableData.memberId);
    if (!memberToAdd) {
      return {
        functionName,
        success: false,
        data: "Member not found in the guild",
      };
    }

    // Check if member already has the role
    if (memberToAdd.roles.cache.has(role.id)) {
      return {
        functionName,
        success: false,
        data: "Member already has this role",
      };
    }

    // Add the role to the member
    await memberToAdd.roles.add(role, updatableData.reason);

    return {
      functionName,
      success: true,
      data: {
        roleId: role.id,
        roleName: role.name,
        memberId: memberToAdd.id,
        memberTag: memberToAdd.user.tag,
        memberDisplayName: memberToAdd.displayName,
        addedAt: new Date().toISOString(),
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