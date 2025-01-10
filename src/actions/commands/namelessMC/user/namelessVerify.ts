import { ApplicationCommandOptionType } from 'discord.js';
import CommandType from '#types/CommandType.js';

const command: CommandType = {
  name: 'nameless-verify',
  description: 'Verify your discord account to the website.',
  options: [
    {
      name: 'token',
      description: 'Verification code',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting values from command...');
    const verificationToken = interaction.options.getString('token');
    debugStream.write(`verificationToken: ${verificationToken}`);

    debugStream.write('Creating data object...');
    const data = {
      integration: 'Discord',
      code: verificationToken,
      identifier: interaction.user.id,
      username: interaction.user.username,
    };
    debugStream.write('Data object created! Making request...');

    const response = await fetch(
      process.env.NAMELESSMC_API_URL + '/integration/verify',
      {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/JSON',
          Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
        },
      }
    );
    debugStream.write('Response received! Getting JSON data...');
    const responseData = await response.json();
    debugStream.write('responseData received! Checking for any errors...');

    if (responseData.error) {
      debugStream.write('Error found!');
      throw new Error(
        `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
          responseData.message ? 'Message :' + responseData.message : ''
        }, ${responseData.meta ? 'Meta :' + responseData.meta : ''}`
      );
    } else debugStream.write('No errors found! Sending follow up message...');

    await interaction.followUp({
      content: 'Successfully verified.',
    });
    debugStream.write('Message sent!');
  },
};

export default command;
