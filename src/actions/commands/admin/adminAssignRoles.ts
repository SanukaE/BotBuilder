import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import getConfig from "#utils/getConfig.js";

const command: CommandType = {
  name: "admin-assign-roles",
  description: "Assign a role to all users on the server.",
  isGuildOnly: true,
  options: [
    {
      name: "role",
      description: "The role to assign to all users.",
      type: ApplicationCommandOptionType.Role,
      required: true,
    },
    {
      name: "assign",
      description:
        "Whether to assign the role to users. False will remove the role from users.",
      type: ApplicationCommandOptionType.Boolean,
      required: true,
    },
    {
      name: "include-bots",
      description: "Include bots in the role assignment.",
      type: ApplicationCommandOptionType.Boolean,
    },
    {
      name: "include-staff",
      description: "Include staff members in the role assignment.",
      type: ApplicationCommandOptionType.Boolean,
    },
    {
      name: "must-not-have-role",
      description: "Only assign the role to users who do not have the role.",
      type: ApplicationCommandOptionType.Role,
    },
    {
      name: "must-have-role",
      description: "Only assign the role to users who have the role.",
      type: ApplicationCommandOptionType.Role,
    },
  ],
  permissions: [PermissionFlagsBits.ManageRoles],

  async script(client, interaction, debugStream) {
    const { staffRoleIDs } = getConfig("moderation") as {
      staffRoleIDs: string[];
    };

    debugStream.write("Getting data from interaction...");

    const role = interaction.options.getRole("role", true);
    const includeBots = interaction.options.getBoolean("include-bots");
    const includeStaff = interaction.options.getBoolean("include-staff");
    const mustNotHaveRole = interaction.options.getRole("must-not-have-role");
    const mustHaveRole = interaction.options.getRole("must-have-role");
    const assign = interaction.options.getBoolean("assign");

    debugStream.write(`role: ${role.id}`);
    debugStream.write(`includeBots: ${includeBots}`);
    debugStream.write(`includeStaff: ${includeStaff}`);
    debugStream.write(`mustNotHaveRole: ${mustNotHaveRole?.id}`);
    debugStream.write(`mustHaveRole: ${mustHaveRole?.id}`);

    debugStream.write("Fetching members...");

    const members = await interaction.guild!.members.fetch();

    const filteredMembers = members.filter((member: any) => {
      if (!includeBots && member.user.bot) return false;
      if (
        !includeStaff &&
        member.roles.cache.some((role: any) => staffRoleIDs.includes(role.id))
      )
        return false;
      if (mustNotHaveRole && member.roles.cache.has(mustNotHaveRole.id))
        return false;
      if (mustHaveRole && !member.roles.cache.has(mustHaveRole.id))
        return false;
      return true;
    });

    debugStream.write(`Filtered members: ${filteredMembers.size}`);
    debugStream.write("Assigning role to members...");

    for (const member of filteredMembers.values()) {
      if (assign) {
        await member.roles.add(role.id);
      } else {
        await member.roles.remove(role.id);
      }
    }

    await interaction.followUp(
      `${assign ? "Assigned" : "Removed"} role <@&${role.id}> to ${
        members.size
      } members.`
    );
  },
};

export default command;
