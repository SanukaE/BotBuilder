import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  Colors,
} from 'discord.js';
import CommandType from '../../../utils/CommandType.js';
import { Location, makeAPICall } from '../../../utils/makeAPICall.js';
import createEmbed from '../../../utils/createEmbed.js';
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

    const embedMessage = createEmbed({
      image: { url: 'https://i.postimg.cc/VLbtcT8L/Nameless-MC-Banner.png' },
      thumbnail: { url: 'https://i.postimg.cc/Kz6WKb69/Nameless-MC-Logo.png' },
      title: 'Almost Done!',
      fields: [{ name: 'NamelessMC Support:', value: 'discord.gg/nameless' }],
      color: Colors.DarkGold,
    });

    if (responseData.link) {
      embedMessage.setURL(`${responseData.link}`);
      embedMessage.setDescription(
        'Your now a member of the community! To login to your brand new account you must set a password. If your facing any deficiencies please contact namelessmc support.'
      );

      const setPasswordBtn = new ButtonBuilder({
        emoji: '🔑',
        label: 'Set Password',
        style: ButtonStyle.Link,
        url: `${responseData.link}`,
      });
      const passwordBtnActionRow = new ActionRowBuilder<ButtonBuilder>({
        components: [setPasswordBtn],
      });

      await interaction.followUp({
        embeds: [embedMessage],
        components: [passwordBtnActionRow],
        ephemeral: true,
      });
    } else {
      embedMessage.setDescription(
        `Your now a member of the community! To login please check your email (\`${emailAddress}\`) for a link to set your password. If your facing any deficiencies please contact namelessmc support.`
      );

      await interaction.followUp({
        embeds: [embedMessage],
        ephemeral: true,
      });
    }
  },
};

export default command;
