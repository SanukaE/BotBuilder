import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from 'discord.js';

const command: CommandType = {
  name: 'nameless-store-payments',
  description: 'View all your store payments. (NamelessMC Store Module)',
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Making API request...');

    const redisResult = await Redis.get('namelessmc-store-payments');

    let storePayments: any[] = [];

    if (redisResult) storePayments = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL + `/store/payments`,
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

      storePayments = responseData.payments;

      await Redis.set(
        'namelessmc-store-payments',
        JSON.stringify(storePayments),
        { EX: 60_000 }
      );
    }

    if (!storePayments.length) {
      debugStream.write('No data found! Sending follow up...');
      await interaction.editReply('No store payments found!');
      debugStream.write('Follow up sent!');
      return;
    }

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      title: 'Store Payments',
      description:
        'Use the select menu below to view payments under a specific status or click the "Search for Payment" button to search for a specific payment.',
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split('/')[1]
        }&sz=128`,
      },
      fields: [
        {
          name: 'Pending Payment:',
          value: `\`${
            storePayments.filter((payment: any) => payment.status_id == 0)
              .length
          }\``,
        },
        {
          name: 'Payment Complete:',
          value: `\`${
            storePayments.filter((payment: any) => payment.status_id == 1)
              .length
          }\``,
        },
        {
          name: 'Payment Refunded:',
          value: `\`${
            storePayments.filter((payment: any) => payment.status_id == 2)
              .length
          }\``,
        },
        {
          name: 'Payment Changebacked:',
          value: `\`${
            storePayments.filter((payment: any) => payment.status_id == 3)
              .length
          }\``,
        },
        {
          name: 'Payment Denied:',
          value: `\`${
            storePayments.filter((payment: any) => payment.status_id == 4)
              .length
          }\``,
        },
      ],
    });

    debugStream.write('Embed created! Creating components...');

    const selectMenu = new StringSelectMenuBuilder({
      customId: 'nameless-store-payments',
      placeholder: 'Select a payment status to view',
      options: [
        {
          label: 'Pending Payment',
          value: '0',
          description: 'Payments that are pending.',
          emoji: '⏳',
        },
        {
          label: 'Payment Complete',
          value: '1',
          description: 'Payments that are complete.',
          emoji: '✅',
        },
        {
          label: 'Payment Refunded',
          value: '2',
          description: 'Payments that are refunded.',
          emoji: '🔄',
        },
        {
          label: 'Payment Changebacked',
          value: '3',
          description: 'Payments that are changebacked.',
          emoji: '🔙',
        },
        {
          label: 'Payment Denied',
          value: '4',
          description: 'Payments that are denied.',
          emoji: '❌',
        },
      ],
    });

    const searchBtn = new ButtonBuilder({
      customId: 'nameless-payment-search',
      label: 'Search for Payment',
      style: ButtonStyle.Primary,
      emoji: '🔍',
    });

    const firstActionRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [selectMenu],
    });

    const secondActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [searchBtn],
    });

    debugStream.write('Menu created! Sending follow up...');

    await interaction.followUp({
      embeds: [embedMessage],
      components: [firstActionRow, secondActionRow],
    });

    debugStream.write('Follow up sent!');
  },
};

export default command;
