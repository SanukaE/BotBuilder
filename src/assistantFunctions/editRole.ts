import setAssistantPlaceholders from "#utils/setAssistantPlaceholders.js";
import { FunctionDeclaration, Type } from "@google/genai";
import { ChannelType, Client, PermissionFlagsBits } from "discord.js";

export const declaration: FunctionDeclaration = {
  name: "editRole",
  description:
    "Edit a discord role's properties such as name, color, permissions, etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      roleId: {
        type: Type.STRING,
        description: "The ID of the role to edit.",
        example: "1334114656461258784",
      },
      roleName: {
        type: Type.STRING,
        description: "The new name of the role (optional).",
        example: "Senior Moderator",
      },
      color: {
        type: Type.STRING,
        description: "The new color of the role in hex format (optional).",
        example: "#00ff00",
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
        description:
          "Whether the role should be displayed separately in the member list (optional).",
        example: true,
      },
      mentionable: {
        type: Type.BOOLEAN,
        description:
          "Whether the role can be mentioned by everyone (optional).",
        example: false,
      },
      position: {
        type: Type.NUMBER,
        description: "The new position of the role (optional).",
        example: 10,
      },
      reason: {
        type: Type.STRING,
        description: "The reason for editing the role (optional).",
        example: "Updating moderator permissions",
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
            description: "The ID of the edited role.",
            example: "1334114656461258784",
          },
          roleName: {
            type: Type.STRING,
            description: "The name of the edited role.",
            example: "Senior Moderator",
          },
          color: {
            type: Type.STRING,
            description: "The color of the edited role.",
            example: "#00ff00",
          },
          position: {
            type: Type.NUMBER,
            description: "The position of the edited role.",
            example: 10,
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
          updatedAt: {
            type: Type.STRING,
            description: "The timestamp when the role was updated.",
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
  functionResults: { functionName: string; success: boolean; data: any }[],
  data: any
) => {
  const functionName = "editRole";

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
        data: "Cannot edit roles in DMs",
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

    // Fetch the role to edit
    const roleToEdit = await currentGuild.roles.fetch(updatableData.roleId);
    if (!roleToEdit) {
      return {
        functionName,
        success: false,
        data: "Role to edit not found",
      };
    }

    // Check if user can manage this role (role hierarchy)
    if (
      roleToEdit.position >= guildMember.roles.highest.position &&
      guildMember.id !== currentGuild.ownerId
    ) {
      return {
        functionName,
        success: false,
        data: "Cannot edit role with equal or higher position",
      };
    }

    // Build edit options
    const editOptions: any = {};

    if (updatableData.roleName !== undefined) {
      editOptions.name = updatableData.roleName;
    }

    if (updatableData.color !== undefined) {
      editOptions.color = updatableData.color;
    }

    if (updatableData.hoist !== undefined) {
      editOptions.hoist = updatableData.hoist;
    }

    if (updatableData.mentionable !== undefined) {
      editOptions.mentionable = updatableData.mentionable;
    }

    if (updatableData.permissions && Array.isArray(updatableData.permissions)) {
      const rolePermissions = updatableData.permissions
        .map((perm: string) => {
          return PermissionFlagsBits[perm as keyof typeof PermissionFlagsBits];
        })
        .filter(Boolean);

      editOptions.permissions = rolePermissions;
    }

    if (updatableData.reason) {
      editOptions.reason = updatableData.reason;
    }

    // Edit the role
    const editedRole = await roleToEdit.edit(editOptions);

    // Handle position change separately if needed
    if (
      updatableData.position !== undefined &&
      updatableData.position !== editedRole.position
    )
      await editedRole.setPosition(
        updatableData.position,
        updatableData.reason
      );

    return {
      functionName,
      success: true,
      data: {
        roleId: editedRole.id,
        roleName: editedRole.name,
        color: editedRole.hexColor,
        position: editedRole.position,
        permissions: editedRole.permissions.toArray(),
        hoist: editedRole.hoist,
        mentionable: editedRole.mentionable,
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
