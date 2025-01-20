import Redis from '#libs/Redis.js';
import StringMenuType from '#types/StringMenuType.js';
import createEmbed from '#utils/createEmbed.js';
import {
  ActionRowBuilder,
  Colors,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from 'discord.js';

const stringMenu: StringMenuType = {
  customID: 'nameless-store-products-categories',
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const categoryID = interaction.values[0];

    debugStream.write(`categoryID: ${categoryID}`);

    debugStream.write('Making API request...');

    const redisResult = await Redis.get('namelessmc-store-products');

    let storeProducts: any[] = [];

    if (redisResult) storeProducts = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL + `/store/products`,
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

      storeProducts = responseData.products;

      await Redis.set(
        'namelessmc-store-products',
        JSON.stringify(storeProducts),
        { EX: 60_000 }
      );
    }

    const categoryProducts = storeProducts.filter(
      (product: any) => product.category_id == categoryID //categoryID is a string and product.category_id is a number
    );

    if (!categoryProducts.length) {
      debugStream.write(
        'No products found in category. Sending error message...'
      );

      await interaction.editReply('No products found in this category.');

      debugStream.write('Error message sent!');
      return;
    }

    debugStream.write('Data collected! Creating embed...');

    const embedMessage = createEmbed({
      description:
        'Here are the products in the category. You can use the select menu to view more details of each product.',
      fields: categoryProducts.map((product: any) => ({
        name: product.name,
        value: `ID: \`${product.id}\`\nPrice: \`$${product.price}\`\nHidden: ${
          product.hidden ? '✔' : '❌'
        }\nDisabled: ${product.disabled ? '✔' : '❌'}`,
      })),
      title: 'Store Products',
      color: Colors.DarkGold,
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split('/')[1]
        }&sz=128`,
      },
    });

    debugStream.write('Embed created! Creating products menu...');

    const productsMenu = new StringSelectMenuBuilder({
      customId: `nameless-store-products-menu-${categoryID}`,
      placeholder: 'Select a product to view more details',
      options: categoryProducts.map((product: any) => ({
        label: product.name,
        value: product.id.toString(),
      })),
    });

    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [productsMenu],
    });

    debugStream.write('Products menu created! Sending embed and menu...');

    await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
    });

    debugStream.write('Follow up sent!');
  },
};

export default stringMenu;
