import { ApplicationCommandOptionType } from 'discord.js';
import CommandType from '../../../utils/CommandType.js';
import { Location, makeAPICall } from '../../../utils/makeAPICall.js';
import 'dotenv/config';

const command: CommandType = {
  name: 'register',
  description:
    'Register for an account on the website linked with your discord account.',
  options: [
    {
      name: 'email',
      description: 'The email address you want to register with.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'username',
      description: 'The username you want to register with.',
      type: ApplicationCommandOptionType.String,
    },
  ],

  async script(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const emailAddress = interaction.options.getString('email');
    const username =
      interaction.options.getString('username') || interaction.user.username;

    const data = {
      username,
      email: emailAddress,
      integrations: {
        Discord: {
          identifier: interaction.user.id,
          username: interaction.user.username,
        },
      },
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
      '/users/register',
      options
    );
    const responseData = await response.json();

    if (!response.ok || responseData.error)
      throw new Error(responseData.error || 'Failed to register.');

    if (responseData.link) {
      await interaction.editReply(
        `Almost done. Please set a password using this link: ${responseData.link}.`
      );
    } else {
      await interaction.editReply(
        `Almost done. Please check your email (\`${emailAddress}\`) for a link to set your password.`
      );
    }
  },
};

export default command;
