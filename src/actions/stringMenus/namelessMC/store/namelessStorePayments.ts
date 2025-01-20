import Redis from '#libs/Redis.js';
import StringMenuType from '#types/StringMenuType.js';
import createEmbed from '#utils/createEmbed.js';
import getEmbedPageData from '#utils/getEmbedPageData.js';
import getNamelessUserAvatar from '#utils/getNamelessUserAvatar.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  PermissionFlagsBits,
} from 'discord.js';

const stringMenu: StringMenuType = {
  customID: 'nameless-store-payments',
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const paymentStatusID = interaction.values[0];

    debugStream.write(`paymentStatusID: ${paymentStatusID}`);

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

    storePayments = storePayments.filter(
      (payment: any) => payment.status_id == paymentStatusID
    );

    if (storePayments.length == 0) {
      debugStream.write('No payments found! Sending message...');

      await interaction.followUp({
        content: 'No payments found under this status.',
        ephemeral: true,
      });

      return;
    }

    debugStream.write('Data collected! Creating embed...');

    const paymentData = storePayments[0];

    const embedMessage = await getPaymentEmbed(paymentData);

    debugStream.write('Embed created! Creating buttons...');

    const previousButton = new ButtonBuilder({
      customId: 'nameless-store-payments-previous-collector',
      style: ButtonStyle.Primary,
      disabled: true,
      emoji: '⬅️',
    });

    const pagesButton = new ButtonBuilder({
      customId: 'nameless-store-payments-pages-collector',
      style: ButtonStyle.Secondary,
      disabled: true,
      label: `Pages 1 of ${storePayments.length}`,
    });

    const nextButton = new ButtonBuilder({
      customId: 'nameless-store-payments-next-collector',
      style: ButtonStyle.Primary,
      disabled: storePayments.length == 1,
      emoji: '➡️',
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [previousButton, pagesButton, nextButton],
    });

    debugStream.write('Buttons created! Sending follow up...');

    const followUpMsg = await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
    });

    debugStream.write('Follow up sent! Creating collector...');

    const collector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
    });

    let currentPageIndex = 0;

    collector.on('collect', async (i) => {
      const result = getEmbedPageData(
        storePayments,
        currentPageIndex,
        i.customId.includes('next'),
        actionRow
      );

      currentPageIndex = result.currentPageIndex;

      const newPaymentData = result.pageData;

      const newEmbedMessage = await getPaymentEmbed(newPaymentData);

      await i.update({
        embeds: [newEmbedMessage],
        components: [actionRow],
      });
    });

    debugStream.write('Collector created!');
  },
};

async function getPaymentEmbed(paymentData: any) {
  const embedMessage = createEmbed({
    color: Colors.DarkGold,
    title: 'NamelessMC Store Payment',
    fields: [
      {
        name: "🆔 ID's:",
        value: `Payment: ${paymentData.id}\nOrder: ${paymentData.order_id}\nGateway: ${paymentData.gateway_id}\nStatus: ${paymentData.status_id}\nCustomer: ${paymentData.customer_id}\nRecipient: ${paymentData.recipient_id}`,
      },
      {
        name: '💳 Transaction:',
        value: paymentData.transaction || 'N/A',
      },
      {
        name: '💰 Amount:',
        value: `${paymentData.amount} ${paymentData.currency}`,
      },
      {
        name: '💸 Fee:',
        value: paymentData.fee,
      },
      {
        name: '🕒 Created:',
        value: new Date(paymentData.created * 1000).toUTCString(),
      },
      {
        name: '🔄 Last Updated:',
        value: new Date(paymentData.last_updated * 1000).toUTCString(),
      },
      {
        name: '👤 Customer:',
        value: `User ID: ${paymentData.customer.user_id || 'N/A'}\nUsername: ${
          paymentData.customer.username || 'N/A'
        }\nIdentifier: ${paymentData.customer.identifier || 'N/A'}`,
      },
      {
        name: '🎁 Recipient:',
        value: `User ID: ${paymentData.recipient.user_id || 'N/A'}\nUsername: ${
          paymentData.recipient.username || 'N/A'
        }\nIdentifier: ${paymentData.recipient.identifier || 'N/A'}`,
      },
      {
        name: '🛍️ Products:',
        value: paymentData.products
          .map(
            (product: any) => `ID: \`${product.id}\`, Name: \`${product.name}\``
          )
          .join('\n'),
      },
    ],
    description:
      'Use the next/previous buttons attached to navigate throw each payment.',
    thumbnail: {
      url: paymentData.customer_id
        ? (await getNamelessUserAvatar(paymentData.customer_id)) ||
          'https://i.postimg.cc/Kz6WKb69/Nameless-MC-Logo.png'
        : 'https://i.postimg.cc/Kz6WKb69/Nameless-MC-Logo.png',
    },
  });

  return embedMessage;
}

export default stringMenu;
