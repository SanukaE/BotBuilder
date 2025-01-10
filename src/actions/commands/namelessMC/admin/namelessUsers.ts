import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from 'discord.js';

const command: CommandType = {
  name: 'nameless-users',
  description: 'Get a list of all the users registered in your website.',
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Fetching data...');

    const redisResult = await Redis.get('namelessmc-users');

    let users: any[] = [];

    if (redisResult) users = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL + '/users&limit=0',
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

      users = responseData.users;

      await Redis.set('namelessmc-users', JSON.stringify(users), {
        EX: 60_000,
      });
    }

    let pages = Math.round(users.length / 10);

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      title: 'NamelessMC Users',
      color: Colors.DarkGold,
      thumbnail: { url: 'https://i.postimg.cc/Kz6WKb69/Nameless-MC-Logo.png' },
      fields: getFields(users.slice(0, 10)),
    });

    debugStream.write('Embed created! Creating components...');

    const previousButton = new ButtonBuilder({
      customId: 'nameless-users-previous-collector',
      style: ButtonStyle.Primary,
      disabled: true,
      emoji: '⬅️',
    });

    const pagesButton = new ButtonBuilder({
      customId: 'nameless-users-pages-collector',
      disabled: true,
      label: `Pages 1 of ${pages}`,
      style: ButtonStyle.Secondary,
    });

    const nextButton = new ButtonBuilder({
      customId: 'nameless-users-next-collector',
      style: ButtonStyle.Primary,
      emoji: '➡️',
      disabled: pages === 1,
    });

    const selectMenu = new StringSelectMenuBuilder({
      customId: 'nameless-users-filter-collector',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Banned', value: 'banned' },
        { label: 'Verified', value: 'verified' },
        { label: 'Discord Linked', value: 'discord_linked' },
      ],
      placeholder: 'Filter users by...',
    });

    const firstActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [previousButton, pagesButton, nextButton],
    });

    const secondActionRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [selectMenu],
    });

    debugStream.write('Components created! Sending message...');

    const followUpMsg = await interaction.followUp({
      embeds: [embedMessage],
      components: [firstActionRow, secondActionRow],
    });

    debugStream.write('Message sent! Creating collectors...');

    let userData = users;
    let pageIndex = 0;

    const buttonCollector = followUpMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
    });

    const selectMenuCollector = followUpMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.StringSelect,
    });

    buttonCollector.on('collect', async (i) => {
      if (i.customId === 'nameless-users-previous') {
        if (pageIndex === 0) return;
        pageIndex--;
      }

      if (i.customId === 'nameless-users-next') {
        if (pageIndex === pages) return;
        pageIndex++;
      }

      if (pageIndex === pages) nextButton.setDisabled(true);
      else nextButton.setDisabled(false);

      if (pageIndex === 0) previousButton.setDisabled(true);
      else previousButton.setDisabled(false);

      const start = pageIndex * 10;
      const end = start + 10;

      embedMessage.setFields(getFields(userData.slice(start, end)));

      pagesButton.setLabel(`Page ${pageIndex + 1} of ${pages}`);

      await i.update({
        embeds: [embedMessage],
        components: [firstActionRow, secondActionRow],
      });
    });

    selectMenuCollector.on('collect', async (i) => {
      const filter = i.values[0];

      switch (filter) {
        case 'all':
          userData = users;
          break;
        case 'banned':
          userData = users.filter((user: any) => user.banned);
          break;
        case 'verified':
          userData = users.filter((user: any) => user.verified);
          break;
        case 'discord_linked':
          userData = users.filter((user: any) =>
            user.integrations.find(
              ({ integration, verified }: any) =>
                integration === 'Discord' && verified
            )
          );
          break;
      }

      pageIndex = 0;
      pages = Math.round(userData.length / 10);

      if (pages === 0) {
        nextButton.setDisabled(true);
        previousButton.setDisabled(true);
      } else {
        nextButton.setDisabled(false);
        previousButton.setDisabled(true);
      }

      embedMessage.setFields(getFields(userData.slice(0, 10)));

      if (pages >= 1) pagesButton.setLabel(`Pages 1 of ${pages}`);
      else pagesButton.setLabel(`No Data`);

      await i.update({
        embeds: [embedMessage],
        components: [firstActionRow, secondActionRow],
      });
    });

    debugStream.write('Collectors created!');
  },
};

function getFields(dataArray: any[]) {
  return dataArray.map((user: any) => ({
    name: user.username,
    value: `ID: \`${user.id}\`\nBanned: ${
      user.banned ? '✔' : '❌'
    }\nVerified: ${user.verified ? '✔' : '❌'}\nIntegrations: ${
      user.integrations
        .filter((integration: any) => integration.verified)
        .map(
          ({ integration, username }: any) => `${integration}: \`${username}\``
        )
        .join('\n') || 'N/A'
    }`,
  }));
}

export default command;
