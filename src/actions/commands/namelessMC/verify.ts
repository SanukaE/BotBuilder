import { ApplicationCommandOptionType } from 'discord.js';
import CommandType from '#types/CommandType.js';
import 'dotenv/config';

const command: CommandType = {
  name: 'verify',
  description: 'Verify your discord account to the website.',
  options: [
    {
      name: 'code',
      description: 'Verification code',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async script(client, interaction, debugStream) {
    debugStream.write('Getting values from command...');
    const verificationCode = interaction.options.getString('code');
    debugStream.write(`verificationCode: ${verificationCode}`);

    debugStream.write('Creating data object...');
    const data = {
      integration: 'Discord',
      code: verificationCode,
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

    if (!response.ok || responseData.error) {
      debugStream.write('Error found!');
      throw new Error(responseData.error || 'Failed to verify.');
    } else debugStream.write('No errors found! Sending follow up message...');

    await interaction.followUp({
      content: 'Successfully verified.',
      ephemeral: true,
    });
    debugStream.write('Message sent!');
  },
};

export default command;
