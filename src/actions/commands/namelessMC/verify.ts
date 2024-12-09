import { ApplicationCommandOptionType } from 'discord.js';
import CommandType from '../../../utils/CommandType.js';
import { Location, makeAPICall } from '../../../utils/makeAPICall.js';
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

  async script(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const verificationCode = interaction.options.getString('code');

    const data = {
      integration: 'Discord',
      code: verificationCode,
      identifier: interaction.user.id,
      username: interaction.user.username,
    };

    const options: RequestInit = {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/JSON',
        Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
      },
    };

    const response = await makeAPICall(
      Location.NamelessMC,
      '/integration/verify',
      options
    );
    const responseData = await response.json();

    if (!response.ok || responseData.error)
      throw new Error(responseData.error || 'Failed to verify.');

    await interaction.editReply('Successfully verified.');
  },
};

export default command;
