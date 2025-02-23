import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import { ApplicationCommandOptionType, Colors } from 'discord.js';

const command: CommandType = {
  name: 'misc-user-info',
  description: 'Get information about a user.',
  isGuildOnly: true,
  options: [
    {
      name: 'user',
      description: 'The user to get information about.',
      type: ApplicationCommandOptionType.User,
    },
  ],

  async script(client, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const user = interaction.options.getUser('user') || interaction.user;
    debugStream.write(`user: ${user.id}`);

    debugStream.write('Sending information message...');

    const userInfoEmbed = createEmbed({
      title: 'User Information',
      description: `Information about ${user.displayName}`,
      color: user.accentColor || Colors.Default,
      fields: [
        {
          name: '👤 Username',
          value: `\`${user.username}\``,
          inline: true,
        },
        {
          name: '🆔 User ID',
          value: `\`${user.id}\``,
          inline: true,
        },
        {
          name: '🤖 Bot',
          value: `\`${user.bot ? 'Yes' : 'No'}\``,
          inline: true,
        },
        {
          name: '📅 Account Created',
          value: `<t:${user.createdTimestamp}>`,
          inline: true,
        },
        {
          name: '🏷️ Display Name',
          value: `\`${user.displayName}\``,
          inline: true,
        },
        {
          name: '🎯 Global Name',
          value: `\`${user.globalName || 'None'}\``,
          inline: true,
        },
        {
          name: '🎭 Roles',
          value:
            interaction
              .guild!.members.cache.get(user.id)
              ?.roles.cache.filter((role) => role.id !== interaction.guild?.id)
              .map((role) => `<@&${role.id}>`)
              .join(', ') || 'None',
          inline: false,
        },
        {
          name: '🏅 Badges',
          value: user.flags?.toArray().length
            ? user.flags
                .toArray()
                .map((flag) => `\`${flag}\``)
                .join(', ')
            : 'None',
          inline: false,
        },
      ],
      thumbnail: {
        url: user.displayAvatarURL(),
      },
      image: { url: user.bannerURL() || '' },
    });

    await interaction.followUp({
      embeds: [userInfoEmbed],
      ephemeral: true,
    });

    debugStream.write('Message sent!');
  },
};

export default command;
