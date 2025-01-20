import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import { Colors, PermissionFlagsBits } from 'discord.js';

const command: CommandType = {
  name: 'nameless-groups',
  description: 'Get a list of all groups.',
  permissions: [PermissionFlagsBits.ManageRoles],

  async script(_, interaction, debugStream) {
    debugStream.write('Fetching data...');

    const redisResult = await Redis.get('namelessmc-groups');

    let groups: any[] = [];

    if (redisResult) groups = JSON.parse(redisResult);
    else {
      const response = await fetch(process.env.NAMELESSMC_API_URL + '/groups', {
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

      groups = responseData.groups;

      await Redis.set('namelessmc-groups', JSON.stringify(groups), {
        EX: 60_000,
      });
    }

    const staffGroups = groups
      .filter((group) => group.staff)
      .map((group) => group.name);
    const memberGroups = groups
      .filter((group) => !group.staff)
      .map((group) => group.name);

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      fields: [
        {
          name: '🛡 Staff Groups:',
          value: staffGroups.join(', '),
          inline: true,
        },
        {
          name: '👨‍🎤 Member Groups:',
          value: memberGroups.length ? memberGroups.join(', ') : 'N/A',
          inline: true,
        },
      ],
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split('/')[1]
        }&sz=128`,
      },
      title: 'Website Groups',
      description:
        'The bellow two fields shows all of the groups your NamelessMC website has.',
    });

    debugStream.write('Embed Created! Sending follow up...');

    await interaction.followUp({ embeds: [embedMessage] });

    debugStream.write('Message sent!');
  },
};

export default command;
