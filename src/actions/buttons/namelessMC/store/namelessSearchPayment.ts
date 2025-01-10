import ButtonType from '#types/ButtonType.js';
import {
  ActionRowBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

const button: ButtonType = {
  customID: 'nameless-payment-search',
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Creating modal...');

    const paymentModal = new ModalBuilder({
      customId: 'nameless-store-payments-search-modal',
      title: 'Search for Payment',
    });

    const orderIDInput = new TextInputBuilder({
      customId: 'nameless-store-payments-search-order-id',
      placeholder: 'Enter the order ID',
      label: 'Order ID',
      style: TextInputStyle.Short,
      required: true,
    });

    const gatewayIDInput = new TextInputBuilder({
      customId: 'nameless-store-payments-search-gateway-id',
      placeholder: 'Enter the gateway ID',
      label: 'Gateway ID',
      style: TextInputStyle.Short,
      required: true,
    });

    const statusIDInput = new TextInputBuilder({
      customId: 'nameless-store-payments-search-status-id',
      placeholder: 'Enter the payment status ID',
      label: 'Payment Status ID',
      style: TextInputStyle.Short,
      required: true,
    });

    const customerIDInput = new TextInputBuilder({
      customId: 'nameless-store-payments-search-customer-id',
      placeholder: 'Enter the customer ID',
      label: 'Customer ID',
      style: TextInputStyle.Short,
      required: true,
    });

    const recipientIDInput = new TextInputBuilder({
      customId: 'nameless-store-payments-search-recipient-id',
      placeholder: 'Enter the recipient ID',
      label: 'Recipient ID',
      style: TextInputStyle.Short,
      required: true,
    });

    const firstModalActionRow = new ActionRowBuilder<TextInputBuilder>({
      components: [orderIDInput],
    });
    const secondModalActionRow = new ActionRowBuilder<TextInputBuilder>({
      components: [gatewayIDInput],
    });
    const thirdModalActionRow = new ActionRowBuilder<TextInputBuilder>({
      components: [statusIDInput],
    });
    const fourthModalActionRow = new ActionRowBuilder<TextInputBuilder>({
      components: [customerIDInput],
    });
    const fifthModalActionRow = new ActionRowBuilder<TextInputBuilder>({
      components: [recipientIDInput],
    });

    paymentModal.addComponents(
      firstModalActionRow,
      secondModalActionRow,
      thirdModalActionRow,
      fourthModalActionRow,
      fifthModalActionRow
    );

    debugStream.write('Modal created! Showing modal...');

    await interaction.showModal(paymentModal);

    debugStream.write('Done!');
  },
};

export default button;
