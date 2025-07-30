import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { ChannelType, Client, PermissionFlagsBits } from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "deleteRole",
  description: "Delete a discord role by ID.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      roleId: {
        type: Type.STRING,
        description: "The ID of the role to delete.",
        example: "1334114656461258784",
      },
      reason: {
        type: Type.STRING,
        description: "The reason for deleting the role (optional).",
        example: "Role no longer needed",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the property requires a value from a different function.",
        example: false,
      },
    },
    required: ["roleId"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          roleId: {
            type: Type.STRING,
            description: "The ID of the deleted role.",
            example: "1334114656461258784",
          },
          roleName: {
            type: Type.STRING,
            description: "The name of the deleted role.",
            example: "Moderator",
          },
          memberCount: {
            type: Type.NUMBER,
            description: "The number of members who had this role.",
            example: 5,
          },
          deletedAt: {
            type: Type.STRING,
            description: "The timestamp when the role was deleted.",
          },
        },
        required: ["roleId", "roleName", "memberCount", "deletedAt"],
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
  const functionName = "deleteRole";

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
        data: "Cannot delete roles in DMs",
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

    // Fetch the role to delete
    const roleToDelete = await currentGuild.roles.fetch(updatableData.roleId);

    if (!roleToDelete) {
      return {
        functionName,
        success: false,
        data: "Role not found",
      };
    }

    // Check if the bot can delete this role (role hierarchy)
    const botMember = await currentGuild.members.fetch(client.user!.id);
    const botHighestRole = botMember.roles.highest;

    if (roleToDelete.position >= botHighestRole.position) {
      return {
        functionName,
        success: false,
        data: "Cannot delete role: Bot's highest role is not high enough in the hierarchy",
      };
    }

    // Check if user can delete this role (role hierarchy)
    const userHighestRole = guildMember.roles.highest;
    if (roleToDelete.position >= userHighestRole.position) {
      return {
        functionName,
        success: false,
        data: "Cannot delete role: Your highest role is not high enough in the hierarchy",
      };
    }

    // Prevent deletion of @everyone role
    if (roleToDelete.id === currentGuild.id) {
      return {
        functionName,
        success: false,
        data: "Cannot delete the @everyone role",
      };
    }

    // Store role information before deletion
    const roleInfo = {
      roleId: roleToDelete.id,
      roleName: roleToDelete.name,
      memberCount: roleToDelete.members.size,
      deletedAt: new Date().toISOString(),
    };

    // Delete the role
    await roleToDelete.delete(updatableData.reason || "No reason provided");

    return {
      functionName,
      success: true,
      data: roleInfo,
    };
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    return {
      functionName,
      success: false,
      data: `Failed to delete role: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
};
