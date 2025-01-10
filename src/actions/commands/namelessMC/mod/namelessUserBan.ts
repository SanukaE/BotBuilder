import CommandType from '#types/CommandType.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';

const command: CommandType = {
  name: 'nameless-user-ban',
  description:
    'Ban a specified user from your website. (Must have discord account linked)',
  isGuildOnly: true,
  isDisabled: true, //API Doesn't work properly
  options: [
    {
      name: 'user',
      description: 'The user you want to view.',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'reason',
      description: 'The reason for the ban.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.BanMembers],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const username = interaction.options.getUser('user', true).username;
    const reason = interaction.options.getString('reason', true);

    debugStream.write(`username: ${username}`);
    debugStream.write(
      `reason: ${reason.length > 10 ? reason.slice(0, 10) + '...' : reason}`
    );

    if (username === interaction.user.username) {
      debugStream.write('User is the same as the executor. Cancelling...');
      await interaction.editReply('You cannot ban yourself.');
      debugStream.write('Message sent! Cancelling...');
      return;
    }

    debugStream.write('Making request to API...');

    const response = await fetch(
      process.env.NAMELESSMC_API_URL +
        `/users/integration_name:discord:${username}/ban`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
        },
        body: JSON.stringify({
          reason,
        }),
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

    debugStream.write('No errors found! Sending follow up...');

    await interaction.followUp({
      content: `User ${username} has been banned from the website. For reason: \`${reason}\``,
    });

    debugStream.write('Message sent!');
  },
};

export default command;
