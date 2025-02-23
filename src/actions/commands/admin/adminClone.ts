import CommandType from '#types/CommandType.js';
import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  PermissionsBitField,
  TextChannel,
} from 'discord.js';

const command: CommandType = {
  name: 'admin-clone',
  description: 'Clone the current channel or a role.',
  isGuildOnly: true,
  options: [
    {
      name: 'role',
      description: 'The role to clone.',
      type: ApplicationCommandOptionType.Role,
    },
  ],
  permissions: [
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
  ],

  async script(client, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const role = interaction.options.getRole('role');
    debugStream.write(`role: ${role?.id}`);

    debugStream.write(`Cloning ${role ? 'role' : 'channel'}...`);

    if (role) {
      const newRole = await interaction.guild!.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        icon: role.icon,
        mentionable: role.mentionable,
        position: role.position + 1,
        reason: 'Cloning role.',
        permissions: role.permissions as PermissionsBitField,
      });

      debugStream.write(`newRole: ${newRole.id}`);
    } else {
      const newChannel = await (interaction.channel as TextChannel).clone();
      debugStream.write(`newChannel: ${newChannel.id}`);
    }

    debugStream.write('Done! Sending response...');

    await interaction.followUp({
      content: `${role ? 'Role' : 'Channel'} cloned!`,
      ephemeral: true,
    });

    debugStream.write('Response sent!');
  },
};

export default command;
