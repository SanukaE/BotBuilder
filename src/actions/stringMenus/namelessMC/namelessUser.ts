import Redis from '#libs/Redis.js';
import StringMenuType from '#types/StringMenuType.js';
import createEmbed from '#utils/createEmbed.js';
import { Colors, PermissionFlagsBits } from 'discord.js';

const stringMenu: StringMenuType = {
  customID: 'nameless-user',
  permissions: [PermissionFlagsBits.ModerateMembers],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');
    const [choice, username] = interaction.values[0].split('-');

    debugStream.write(`choice: ${choice}`);
    debugStream.write(`username: ${username}`);

    debugStream.write('Making API call...');

    const redisResult = await Redis.get(`namelessmc-user-${username}`);

    let user: any;

    if (redisResult) user = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL +
          `/users/integration_name:discord:${username}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
          },
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

      if (!responseData.exists) throw new Error('User does not exist.');

      user = responseData;

      await Redis.set(`namelessmc-user-${username}`, JSON.stringify(user), {
        EX: 60_000,
      });
    }

    debugStream.write('Data collected! Creating embed...');

    debugStream.write('Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      thumbnail: { url: user.avatar_url },
      title: `${user.user_title ? user.user_title + ' ' : ''}${
        user.displayname || 'N/A'
      } (\`${user.username}\`)`,
    });

    switch (choice) {
      case 'fields':
        const fields: any[] = Object.values(user.profile_fields);

        fields.forEach((data) => {
          embedMessage.addFields({
            name: data.name,
            value: `\`${data.value || 'N/A'}\``,
            inline: true,
          });
        });
        break;

      case 'groups':
        const groups: string[] = user.groups.map((group: any) => group.name);

        embedMessage.addFields({
          name: '🧰 Groups:',
          value: groups.length ? groups.join(', ') : 'N/A',
          inline: true,
        });
        break;

      case 'integrations':
        const integrations: any[] = user.integrations;

        integrations.forEach((data) => {
          embedMessage.addFields({
            name: `${data.verified ? '✔' : '❌'} ${data.integration}`,
            value: `\`${data.username}\``,
            inline: true,
          });
        });
        break;
    }

    debugStream.write('Embed created! Sending follow up...');

    await interaction.followUp({
      embeds: [embedMessage],
    });

    debugStream.write('Follow up sent!');
  },
};

export default stringMenu;
