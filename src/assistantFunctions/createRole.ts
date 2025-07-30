import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { ChannelType, Client, PermissionFlagsBits } from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "createRole",
  description: "Create a discord role with specified properties.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      roleName: {
        type: Type.STRING,
        description: "The name of the role.",
        example: "Moderator",
      },
      color: {
        type: Type.STRING,
        description: "The color of the role in hex format (optional).",
        example: "#ff0000",
      },
      permissions: {
        type: Type.ARRAY,
        description: "List of permissions to grant to the role (optional).",
        items: {
          type: Type.STRING,
          description: "The permission name.",
          example: "MANAGE_MESSAGES",
        },
      },
      hoist: {
        type: Type.BOOLEAN,
        description: "Whether the role should be displayed separately in the member list (optional).",
        example: true,
      },
      mentionable: {
        type: Type.BOOLEAN,
        description: "Whether the role can be mentioned by everyone (optional).",
        example: false,
      },
      reason: {
        type: Type.STRING,
        description: "The reason for creating the role (optional).",
        example: "Creating moderator role for server management",
      },
      requireDataFromPrev: {
        type: Type.BOOLEAN,
        description:
          "If one of the property requires a value from a different function.",
        example: false,
      },
    },
    required: ["roleName"],
  },
  response: {
    type: Type.OBJECT,
    properties: {
      data: {
        type: Type.OBJECT,
        properties: {
          roleId: {
            type: Type.STRING,
            description: "The ID of the created role.",
            example: "1334114656461258784",
          },
          roleName: {
            type: Type.STRING,
            description: "The name of the created role.",
            example: "Moderator",
          },
          color: {
            type: Type.STRING,
            description: "The color of the created role.",
            example: "#ff0000",
          },
          position: {
            type: Type.NUMBER,
            description: "The position of the created role.",
            example: 5,
          },
          permissions: {
            type: Type.ARRAY,
            description: "The permissions granted to the role.",
            items: { type: Type.STRING },
          },
          hoist: {
            type: Type.BOOLEAN,
            description: "Whether the role is displayed separately.",
            example: true,
          },
          mentionable: {
            type: Type.BOOLEAN,
            description: "Whether the role is mentionable.",
            example: false,
          },
          createdAt: {
            type: Type.STRING,
            description: "The timestamp of the created role.",
          },
        },
        required: [
          "roleId",
          "roleName",
          "color",
          "position",
          "permissions",
          "hoist",
          "mentionable",
          "createdAt",
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
  const functionName = "createRole";

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
        data: "Cannot create roles in DMs",
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

    // Build role permissions
    let rolePermissions: bigint[] = [];
    if (updatableData.permissions && Array.isArray(updatableData.permissions)) {
      rolePermissions = updatableData.permissions
        .map((perm: string) => {
          return PermissionFlagsBits[perm as keyof typeof PermissionFlagsBits];
        })
        .filter(Boolean);
    }

    // Create the role
    const newRole = await currentGuild.roles.create({
      name: updatableData.roleName,
      color: updatableData.color || null,
      permissions: rolePermissions,
      hoist: updatableData.hoist || false,
      mentionable: updatableData.mentionable || false,
      reason: updatableData.reason || undefined,
    });

    return {
      functionName,
      success: true,
      data: {
        roleId: newRole.id,
        roleName: newRole.name,
        color: newRole.hexColor,
        position: newRole.position,
        permissions: newRole.permissions.toArray(),
        hoist: newRole.hoist,
        mentionable: newRole.mentionable,
        createdAt: newRole.createdAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      functionName,
      success: false,
      data: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};