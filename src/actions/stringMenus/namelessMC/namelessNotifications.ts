import Redis from '#libs/Redis.js';
import StringMenuType from '#types/StringMenuType.js';
import createEmbed from '#utils/createEmbed.js';
import formatFieldName from '#utils/formatFieldName.js';
import { createPageButtons, getPageData } from '#utils/getPageData.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
} from 'discord.js';

const stringMenu: StringMenuType = {
  customID: 'nameless-notification',

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const notificationType = interaction.values[0];

    debugStream.write('Fetching data from API...');

    const redisResult = await Redis.get(
      `namelessmc-user-notifications-${interaction.user.username}`
    );

    let notifications: any[] = [];

    if (redisResult) notifications = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL +
          `/users/integration_name:discord:${interaction.user.username}/notifications`,
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

      notifications = responseData.notifications;

      await Redis.set(
        `namelessmc-user-notifications-${interaction.user.username}`,
        JSON.stringify(notifications),
        { EX: 60_000 }
      );
    }

    notifications = notifications.filter(
      (notification: { type: string }) => notification.type === notificationType
    );

    debugStream.write('Data collected! Creating buttons...');

    const buttonIds = [
      'nameless-notification-previous-end-collector',
      'nameless-notification-previous-collector',
      'nameless-notification-pages-collector',
      'nameless-notification-next-collector',
      'nameless-notification-next-end-collector',
    ];

    const urlBtn = new ButtonBuilder({
      label: 'Open URL',
      emoji: '🔗',
      style: ButtonStyle.Link,
      url: notifications[0].url,
    });

    const firstActionRow = createPageButtons(buttonIds, notifications);
    const secondActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [urlBtn],
    });

    debugStream.write('Buttons created! Creating notification embed...');

    const embedMessage = createEmbed({
      title: `[${formatFieldName(notifications[0].type)}] ${
        notifications[0].message_short || ''
      }`,
      description:
        notifications[0].message.length > 2000
          ? notifications[0].message.slice(0, 197) + '...'
          : notifications[0].message,
      color: Colors.DarkGold,
      timestamp: notifications[0].received_at,
    });

    debugStream.write('Embed created! Sending follow up...');

    const followUpMsg = await interaction.followUp({
      embeds: [embedMessage],
      components: [firstActionRow, secondActionRow],
    });

    debugStream.write('Follow up sent! Creating component collector...');

    const componentCollector = followUpMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
    });

    let currentPageIndex = 0;

    componentCollector.on('collect', async (i) => {
      const result = getPageData(
        notifications,
        currentPageIndex,
        i.customId,
        firstActionRow
      );

      currentPageIndex = result.currentPageIndex;
      const data = result.data;

      embedMessage.setTitle(
        `[${formatFieldName(data.type)}] ${data.message_short || ''}`
      );
      embedMessage.setDescription(
        data.message.length > 2000
          ? data.message.slice(0, 197) + '...'
          : data.message
      );
      embedMessage.setTimestamp(data.received_at);

      await i.update({
        embeds: [embedMessage],
        components: [firstActionRow, secondActionRow],
      });
    });

    debugStream.write('Component collector created!');
  },
};

export default stringMenu;
