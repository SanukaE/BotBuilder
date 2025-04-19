import CommandType from '#types/CommandType.js';
import { PermissionFlagsBits } from 'discord.js';
import config from '#config' with { type: 'json' };

const command: CommandType = {
  name: 'nameless-update-bot',
  description: "Update's discord bot setting on your website.",
  permissions: [PermissionFlagsBits.Administrator],

  async script(client, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const bot = client.user;

    debugStream.write('Data gotten! Getting config guild id...');

    const { productionGuildID } = config;

    debugStream.write('Making API request...');

    const response = await fetch(
      process.env.NAMELESSMC_API_URL + '/discord/update-bot-settings',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
        },
        body: JSON.stringify({
          url: `https://discord.com/oauth2/authorize?client_id=${bot?.id}&permissions=8&integration_type=0&scope=bot `,
          guild_id: productionGuildID,
          bot_username: bot?.username,
          bot_id: bot?.id,
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

    debugStream.write('No errors! Sending follow up...');

    await interaction.followUp({
      content: 'Bot settings updated!',
    });

    debugStream.write('Message sent!');
  },
};

export default command;
