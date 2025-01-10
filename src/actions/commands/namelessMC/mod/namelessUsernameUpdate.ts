import CommandType from '#types/CommandType.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';

const command: CommandType = {
  name: 'nameless-username-update',
  description: "Update a user's username on NamelessMC",
  isGuildOnly: true,
  options: [
    {
      name: 'username',
      description: 'The new username of the user',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'user',
      description: 'The user to update (Must have discord account linked)',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.ManageNicknames],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const newUsername = interaction.options.getString('username', true);
    const targetsUsername = interaction.options.getUser('user', true).username;

    debugStream.write(`newUsername: ${newUsername}`);
    debugStream.write(`username: ${targetsUsername}`);

    debugStream.write('Making API request...');

    const response = await fetch(
      process.env.NAMELESSMC_API_URL +
        `/users/integration_name:discord:${targetsUsername}/update-username`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
        },
        body: JSON.stringify({
          username: newUsername,
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

    debugStream.write('Data collected! Sending follow up...');

    await interaction.followUp({
      content: `Successfully updated ${targetsUsername}'s website username to ${newUsername}.`,
    });

    debugStream.write('Follow up sent!');
  },
};

export default command;
