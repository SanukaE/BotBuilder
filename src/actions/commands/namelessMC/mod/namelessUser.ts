import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  Colors,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from 'discord.js';

const command: CommandType = {
  name: 'nameless-user',
  description:
    'Retrieve information about a specified user. (Must have discord account linked)',
  isGuildOnly: true,
  options: [
    {
      name: 'user',
      description: 'The user you want to view.',
      type: ApplicationCommandOptionType.User,
    },
  ],
  permissions: [PermissionFlagsBits.ModerateMembers],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');
    const username =
      interaction.options.getUser('user')?.username ||
      interaction.user.username;

    debugStream.write(`username: ${username}`);
    debugStream.write('Making request to API...');

    const redisResult = await Redis.get(`namelessmc-user-${username}`);

    let user: any;

    if (redisResult) user = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL +
          `/users/integration_name:discord:${username}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
          },
        }
      );

      debugStream.write(`Response Status: ${response.status}`);

      debugStream.write('Getting JSON data...');
      const responseData = await response.json();

      if (responseData.error)
        throw new Error(
          `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
            responseData.message ? 'Message :' + responseData.message : ''
          }, ${responseData.meta ? 'Meta :' + responseData.meta : ''}`
        );

      if (!responseData.exists) throw new Error('User does not exist.');

      user = responseData;

      await Redis.set(`namelessmc-user-${username}`, JSON.stringify(user), {
        EX: 60_000,
      });
    }

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      thumbnail: {
        url: user.avatar_url || '',
      },
      title: `${user.user_title ? user.user_title + ' ' : ''}${
        user.displayname || 'N/A'
      } (\`${user.username}\`)`,
      description: `\`\`\`Signature:\n${user.signature || 'N/A'}\`\`\``,
      fields: [
        {
          name: '⚖ Is Banned:',
          value: `\`${user.isbanned}\``,
          inline: true,
        },
        {
          name: '🖥 Last IP:',
          value: `\`${user.lastip}\``,
          inline: true,
        },
        {
          name: '👀 Profile Views:',
          value: `\`${user.profile_views}\``,
          inline: true,
        },
        {
          name: '🔒 TFA Enabled:',
          value: `\`${user.tfa_enabled}\``,
          inline: true,
        },
        {
          name: '🕓 Timezone:',
          value: `\`${user.timezone}\``,
          inline: true,
        },
        {
          name: '📁 Register Method:',
          value: `\`${user.register_method}\``,
          inline: true,
        },
        {
          name: '🍰 Joined:',
          value: `<t:${user.registered_timestamp}>`,
          inline: true,
        },
        {
          name: '⌚ Last Online:',
          value: `<t:${user.last_online_timestamp}>`,
          inline: true,
        },
        {
          name: '✔ Validated:',
          value: `\`${user.validated}\``,
          inline: true,
        },
      ],
    });

    debugStream.write('Embed Created! Creating select menu...');

    const selectMenu = new StringSelectMenuBuilder({
      customId: 'nameless-user',
      options: [
        {
          label: 'Profile Fields',
          value: `fields-${username}`,
          description: 'Get a list of all the fields the user has filled.',
          emoji: '📋',
        },
        {
          label: 'Groups',
          value: `groups-${username}`,
          description: 'Get a list of all the groups the user is in.',
          emoji: '📋',
        },
        {
          label: 'Integrations',
          value: `integrations-${username}`,
          description: 'Get a list of all the integrations the user has set.',
          emoji: '🔗',
        },
      ],
      placeholder: 'Select an option',
    });

    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [selectMenu],
    });

    debugStream.write('Menu created! Sending follow up to user...');

    await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
    });

    debugStream.write('Message sent!');
  },
};

export default command;
