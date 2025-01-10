import CommandType from '#types/CommandType.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';

const command: CommandType = {
  name: 'nameless-user-add-credits',
  description: 'Add store credits to a user. (NamelessMC Store Module)',
  isGuildOnly: true,
  options: [
    {
      name: 'user',
      description: 'The user to add credits to (must have discord linked)',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'credits',
      description: 'The amount of credits to add',
      type: ApplicationCommandOptionType.Integer,
      min_value: 1,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const username = interaction.options.getUser('user', true).username;
    const credits = interaction.options.getInteger('credits', true);

    debugStream.write(`username: ${username}`);
    debugStream.write(`credits: ${credits}`);

    if (username === interaction.user.username) {
      debugStream.write(
        'User cannot add credits to themselves! Sending message...'
      );
      await interaction.followUp(
        'You cannot add credits to yourself! Please ask a different admin to do it for you.'
      );
      debugStream.write('Sent!');
      return;
    }

    debugStream.write('Making API request...');
    const response = await fetch(
      process.env.NAMELESSMC_API_URL +
        `/users/integration_name:discord:${username}/add-credits`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
        },
        body: JSON.stringify({ credits }),
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
      content: `$${credits} was added to ${username}'s account!`,
    });

    debugStream.write('Reply sent!');
  },
};

export default command;
