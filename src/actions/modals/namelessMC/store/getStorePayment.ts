import Redis from '#libs/Redis.js';
import ModalType from '#types/ModalType.js';
import createEmbed from '#utils/createEmbed.js';
import getNamelessUserAvatar from '#utils/getNamelessUserAvatar.js';
import { Colors, PermissionFlagsBits } from 'discord.js';

const modal: ModalType = {
  customID: 'nameless-store-payments-search-modal',
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const orderID = interaction.fields.getTextInputValue(
      'nameless-store-payments-search-order-id'
    );
    const gatewayID = interaction.fields.getTextInputValue(
      'nameless-store-payments-search-gateway-id'
    );
    const statusID = interaction.fields.getTextInputValue(
      'nameless-store-payments-search-status-id'
    );
    const customerID = interaction.fields.getTextInputValue(
      'nameless-store-payments-search-customer-id'
    );
    const recipientID = interaction.fields.getTextInputValue(
      'nameless-store-payments-search-recipient-id'
    );

    debugStream.write(`orderID: ${orderID}`);
    debugStream.write(`gatewayID: ${gatewayID}`);
    debugStream.write(`statusID: ${statusID}`);
    debugStream.write(`customerID: ${customerID}`);
    debugStream.write(`recipientID: ${recipientID}`);

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
          body: JSON.stringify({
            order: orderID,
            gateway: gatewayID,
            status: statusID,
            customer: customerID,
            recipient: recipientID,
            limit: 1,
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

      storePayments = responseData.payments;

      await Redis.set(
        'namelessmc-store-payments',
        JSON.stringify(storePayments),
        { EX: 60 }
      );
    }

    const storePayment = storePayments[0];

    if (!storePayment) {
      debugStream.write('No payment found! Sending message...');

      await interaction.editReply('No payment found under this criteria.');

      debugStream.write('Message sent!');
      return;
    }

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      title: 'Store Payment',
      fields: [
        {
          name: "🆔 ID's:",
          value: `Payment: ${storePayment.id}\nOrder: ${storePayment.order_id}\nGateway: ${storePayment.gateway_id}\nStatus: ${storePayment.status_id}\nCustomer: ${storePayment.customer_id}\nRecipient: ${storePayment.recipient_id}`,
        },
        {
          name: '💳 Transaction:',
          value: storePayment.transaction || 'N/A',
        },
        {
          name: '💰 Amount:',
          value: `${storePayment.amount} ${storePayment.currency}`,
        },
        {
          name: '💸 Fee:',
          value: storePayment.fee,
        },
        {
          name: '🕒 Created:',
          value: new Date(storePayment.created * 1000).toUTCString(),
        },
        {
          name: '🔄 Last Updated:',
          value: new Date(storePayment.last_updated * 1000).toUTCString(),
        },
        {
          name: '👤 Customer:',
          value: `User ID: ${
            storePayment.customer.user_id || 'N/A'
          }\nUsername: ${
            storePayment.customer.username || 'N/A'
          }\nIdentifier: ${storePayment.customer.identifier || 'N/A'}`,
        },
        {
          name: '🎁 Recipient:',
          value: `User ID: ${
            storePayment.recipient.user_id || 'N/A'
          }\nUsername: ${
            storePayment.recipient.username || 'N/A'
          }\nIdentifier: ${storePayment.recipient.identifier || 'N/A'}`,
        },
        {
          name: '🛍️ Products:',
          value: storePayment.products
            .map(
              (product: any) =>
                `ID: \`${product.id}\`, Name: \`${product.name}\``
            )
            .join('\n'),
        },
      ],
      description:
        'Use the next/previous buttons attached to navigate throw each payment.',
      thumbnail: {
        url: storePayment.customer_id
          ? await getNamelessUserAvatar(storePayment.customer_id)
          : `https://www.google.com/s2/favicons?domain=${
              process.env.NAMELESSMC_API_URL!.split('/')[2]
            }&sz=128`,
      },
    });

    debugStream.write('Embed created! Sending follow up...');

    await interaction.followUp({
      embeds: [embedMessage],
    });

    debugStream.write('Follow up sent!');
  },
};

export default modal;
