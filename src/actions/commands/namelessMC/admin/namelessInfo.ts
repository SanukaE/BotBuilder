import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import { Colors, PermissionFlagsBits } from 'discord.js';

const command: CommandType = {
  name: 'nameless-info',
  description: 'Get some general information about NamelessMC.',
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Fetching data...');
    const response = await fetch(process.env.NAMELESSMC_API_URL + '/info', {
      headers: {
        Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
      },
    });

    debugStream.write(`Response Status: ${response.status}`);

    debugStream.write('Getting JSON data...');
    const responseData = await response.json();

    if (responseData.error)
      throw new Error(
        `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
          responseData.message ? 'Message :' + responseData.message : ''
        }, ${responseData.meta ? 'Meta :' + responseData.meta : ''}`
      );

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      fields: [{ name: 'Support Server:', value: 'discord.gg/nameless' }],
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=namelessmc.com&sz=128`,
      },
      title: 'Information on NamelessMC',
      description: `💾 Version: \`${
        responseData.nameless_version
      }\`\n🌎 Default Language: \`${
        responseData.locale
      }\`\n\n⚙ Enabled Modules: ${responseData.modules.join(', ')}`,
    });

    if (responseData.version_update?.update) {
      embedMessage.setDescription(
        embedMessage.data.description +
          `\n\n📥 Update Available (\`v${
            responseData.version_update.version || 'N/A'
          }\`): This update is ${
            responseData.version_update.urgent ? 'urgent' : 'not urgent'
          }.`
      );
    }

    debugStream.write('Embed created! Sending to user...');
    await interaction.followUp({ embeds: [embedMessage] });
    debugStream.write('Reply sent!');
  },
};

export default command;
