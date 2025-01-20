import Redis from '#libs/Redis.js';
import StringMenuType from '#types/StringMenuType.js';
import createEmbed from '#utils/createEmbed.js';
import getNamelessGroups from '#utils/getNamelessGroups.js';
import { Colors, PermissionFlagsBits } from 'discord.js';

const stringMenu: StringMenuType = {
  customID: 'nameless-store-products-menu', //nameless-store-products-menu-${categoryID}
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const productID = interaction.values[0];
    const categoryID = interaction.customId.split('-')[4];

    debugStream.write(`productID: ${productID}`);
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

    const product = categoryProducts.find(
      (product: any) => product.id == productID
    );

    const groups = await getNamelessGroups();

    const productEmbed = createEmbed({
      title: product.name,
      description: `🆔 ID: \`${product.id}\`\n💰 Price: \`$${
        product.price
      }\`\n👁 Hidden: ${product.hidden ? '✔' : '❌'}\n📴 Disabled: ${
        product.disabled ? '✔' : '❌'
      }`,
      fields: [
        {
          name: '🌐 Global Limit:',
          value: `Limit: \`${product.global_limit.limit}\`\nInterval: \`${product.global_limit.interval}\`\nPeriod: \`${product.global_limit.period}\``,
        },
        {
          name: '👤 User Limit:',
          value: `Limit: \`${product.user_limit.limit}\`\nInterval: \`${product.user_limit.interval}\`\nPeriod: \`${product.user_limit.period}\``,
        },
        {
          name: '📦 Required Products:',
          value: product.required_products.join(', ') || 'None',
        },
        {
          name: '🧰 Required Groups:',
          value:
            product.required_groups
              .map(
                (groupID: any) =>
                  groups.find((group) => group.value == groupID)?.name
              )
              .join(', ') || 'None',
        },
        {
          name: '🔗 Required Integrations:',
          value: product.required_integrations.join(', ') || 'None',
        },
      ],
      color: Colors.DarkGold,
      thumbnail: {
        url: `https://www.google.com/s2/favicons?domain=${
          process.env.NAMELESSMC_API_URL!.split('/')[1]
        }&sz=128`,
      },
    });

    debugStream.write('Embed created! Sending follow up...');

    await interaction.followUp({
      embeds: [productEmbed],
    });

    debugStream.write('Follow up sent!');
  },
};

export default stringMenu;
