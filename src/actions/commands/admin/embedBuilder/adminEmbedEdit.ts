import MySQL from '#libs/MySQL.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { RowDataPacket } from 'mysql2';

const command: CommandType = {
  name: 'admin-embed-edit',
  description: 'Edit an existing embed.',
  options: [
    {
      name: 'embed-title',
      description: 'The embed you want to edit.',
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.Administrator],

  async handleAutoComplete(client, interaction, focusedOption) {
    const [rows] = await MySQL.query<RowDataPacket[]>(
      'SELECT title FROM embeds'
    );

    const focusedValues = rows.filter((row) =>
      row.title.startWith(focusedOption)
    );
    if (!focusedValues.length) return;

    await interaction.respond(
      focusedValues.map((v) => ({ name: v.title, value: v.title }))
    );
  },

  async script(client, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const embedTitle = interaction.options.getString('embed-title', true);
    debugStream.write(`embedTitle: ${embedTitle}`);

    debugStream.write('Fetching data...');

    const [rows] = await MySQL.query<RowDataPacket[]>(
      'SELECT * FROM embeds WHERE title = ?',
      [embedTitle]
    );

    if (!rows.length)
      throw new Error('No embed was found with the provided title.');

    const embedData = rows[0];

    debugStream.write('Data collected! Creating components...');

    const editMenu = new StringSelectMenuBuilder({
      customId: 'admin-embed-edit-collector',
      options: [
        {
          emoji: '📝',
          label: 'Content',
          description: 'Edits the embed title, description, URL & color.',
          value: 'content',
        },
        {
          emoji: '🖋',
          label: 'Author',
          description: 'Edits the embed author properties.',
          value: 'author',
        },
        {
          emoji: '🖼',
          label: 'Images',
          description: 'Edits the embed thumbnail & image.',
          value: 'images',
        },
        {
          emoji: '🏷',
          label: 'Footer',
          description: 'Edits the embed footer properties.',
          value: 'footer',
        },
      ],
      placeholder: 'Select a field to edit',
    });

    const saveBtn = new ButtonBuilder({
      customId: 'admin-embed-edit-save-collector',
      emoji: '💾',
      label: 'Save Changes',
      style: ButtonStyle.Success,
    });

    const firstRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [editMenu],
    });

    const secondRow = new ActionRowBuilder<ButtonBuilder>({
      components: [saveBtn],
    });

    debugStream.write('Components created! Sending embed...');

    const embedMessage = createEmbed({
      author: embedData.author ? JSON.parse(embedData.author) : undefined,
      color: embedData.color,
      title: embedData.title,
      description: embedData.description,
      url: embedData.url,
      thumbnail: { url: embedData.thumbnail_url || '' },
      image: { url: embedData.image_url || '' },
      fields: embedData.fields
        ? (JSON.parse(embedData.fields) as {
            name: string;
            value: string;
            inline: boolean;
          }[])
        : undefined,
      footer: embedData.footer ? JSON.parse(embedData.footer) : undefined,
    });

    const embedMsg = await interaction.editReply({
      content:
        'Please use the menu below to edit the desired fields of the embed. Once you have finished making your changes, remember to save them by clicking the "Save Changes" button.',
      embeds: [embedMessage],
      components: [firstRow, secondRow],
    });

    debugStream.write('Embed sent! Creating collector...');

    const menuCollector = embedMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === 'admin-embed-edit-collector',
    });

    const buttonCollector = embedMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === 'admin-embed-edit-save-collector',
    });

    menuCollector.on('collect', async (i) => {
      await i.deferUpdate();
      const selectedOption = i.values[0];

      if (selectedOption === 'fields') {
        const fieldsMsg = await i.followUp({
          content: 'Would you like to edit, add, or remove a field?',
          components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('admin-embed-edit-field-action-collector')
                .setPlaceholder('Select an action')
                .addOptions([
                  { label: 'Edit Field', value: 'edit' },
                  { label: 'Add Field', value: 'add' },
                  { label: 'Remove Field', value: 'remove' },
                ])
            ),
          ],
          ephemeral: true,
        });

        const collector = fieldsMsg.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          filter: (i) =>
            i.user.id === interaction.user.id &&
            i.customId === 'admin-embed-edit-field-action-collector',
        });

        collector.on('collect', async (selection) => {
          await selection.deferUpdate();

          const action = selection.values[0];
          const embedFields = embedData.fields
            ? JSON.parse(embedData.fields)
            : [];

          switch (action) {
            case 'edit':
              if (!embedFields.length) {
                await selection.followUp({
                  content: 'There are no fields to edit.',
                  ephemeral: true,
                });
                return;
              }

              const editFieldMenu = new StringSelectMenuBuilder()
                .setCustomId('field-edit-select')
                .setPlaceholder('Select a field to edit')
                .addOptions(
                  embedFields.map((field: any, index: number) => ({
                    label: field.name,
                    value: index.toString(),
                  }))
                );

              const editMsg = await selection.followUp({
                components: [
                  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    editFieldMenu
                  ),
                ],
                ephemeral: true,
              });

              const editSelection = await editMsg.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                filter: (i) => i.user.id === interaction.user.id,
              });

              const fieldIndex = parseInt(editSelection.values[0]);
              const modal = new ModalBuilder()
                .setCustomId('field-edit-modal')
                .setTitle('Edit Field')
                .addComponents(
                  new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                      .setCustomId('name')
                      .setLabel('Name')
                      .setStyle(TextInputStyle.Short)
                      .setValue(embedFields[fieldIndex].name)
                  ),
                  new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                      .setCustomId('value')
                      .setLabel('Value')
                      .setStyle(TextInputStyle.Paragraph)
                      .setValue(embedFields[fieldIndex].value)
                  )
                );

              await editSelection.showModal(modal);
              const modalSubmit = await editSelection.awaitModalSubmit({
                filter: (i) => i.user.id === interaction.user.id,
                time: 0,
              });

              embedFields[fieldIndex].name =
                modalSubmit.fields.getTextInputValue('name');
              embedFields[fieldIndex].value =
                modalSubmit.fields.getTextInputValue('value');
              break;

            case 'add':
              const addModal = new ModalBuilder()
                .setCustomId('field-add-modal')
                .setTitle('Add Field')
                .addComponents(
                  new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                      .setCustomId('name')
                      .setLabel('Name')
                      .setStyle(TextInputStyle.Short)
                  ),
                  new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                      .setCustomId('value')
                      .setLabel('Value')
                      .setStyle(TextInputStyle.Paragraph)
                  )
                );

              await selection.showModal(addModal);
              const addModalSubmit = await selection.awaitModalSubmit({
                filter: (i) => i.user.id === interaction.user.id,
                time: 300000,
              });

              embedFields.push({
                name: addModalSubmit.fields.getTextInputValue('name'),
                value: addModalSubmit.fields.getTextInputValue('value'),
                inline: false,
              });
              break;

            case 'remove':
              if (!embedFields.length) {
                await selection.followUp({
                  content: 'There are no fields to remove.',
                  ephemeral: true,
                });
                return;
              }

              const removeFieldMenu = new StringSelectMenuBuilder()
                .setCustomId('field-remove-select')
                .setPlaceholder('Select a field to remove')
                .addOptions(
                  embedFields.map((field: any, index: number) => ({
                    label: field.name,
                    value: index.toString(),
                  }))
                );

              const removeMsg = await selection.followUp({
                components: [
                  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    removeFieldMenu
                  ),
                ],
                ephemeral: true,
              });

              const removeSelection = await removeMsg.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                filter: (i) => i.user.id === interaction.user.id,
                time: 300000,
              });

              embedFields.splice(parseInt(removeSelection.values[0]), 1);
              await removeSelection.update({
                content: 'Field removed successfully!',
                components: [],
              });
              break;
          }

          embedData.fields = embedFields;
          const updatedEmbed = createEmbed({
            author: embedData.author ? JSON.parse(embedData.author) : undefined,
            color: embedData.color,
            title: embedData.title,
            description: embedData.description,
            url: embedData.url,
            thumbnail: { url: embedData.thumbnail_url || '' },
            image: { url: embedData.image_url || '' },
            fields: embedFields,
            footer: embedData.footer ? JSON.parse(embedData.footer) : undefined,
          });

          await interaction.editReply({ embeds: [updatedEmbed] });
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`admin-embed-edit-modal-${selectedOption}-collector`)
        .setTitle('Edit Embed');

      switch (selectedOption) {
        case 'content':
          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(256)
                .setValue(embedData.title || '')
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(4000)
                .setValue(embedData.description || '')
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('url')
                .setLabel('URL')
                .setStyle(TextInputStyle.Short)
                .setValue(embedData.url || '')
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('color')
                .setLabel('Color (Hex)')
                .setStyle(TextInputStyle.Short)
                .setValue(embedData.color?.toString(16) || '')
            )
          );
          break;

        case 'author':
          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('name')
                .setLabel('Name')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(256)
                .setValue(embedData.author?.name || '')
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('url')
                .setLabel('URL')
                .setStyle(TextInputStyle.Short)
                .setValue(embedData.author?.url || '')
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('icon_url')
                .setLabel('Icon URL')
                .setStyle(TextInputStyle.Short)
                .setValue(embedData.author?.icon_url || '')
            )
          );
          break;

        case 'images':
          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('thumbnail')
                .setLabel('Thumbnail URL')
                .setStyle(TextInputStyle.Short)
                .setValue(embedData.thumbnail_url || '')
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('image')
                .setLabel('Image URL')
                .setStyle(TextInputStyle.Short)
                .setValue(embedData.image_url || '')
            )
          );
          break;

        case 'footer':
          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('text')
                .setLabel('Text')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(2048)
                .setValue(embedData.footer?.text || '')
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('icon_url')
                .setLabel('Icon URL')
                .setStyle(TextInputStyle.Short)
                .setValue(embedData.footer?.icon_url || '')
            )
          );
          break;
      }

      await i.showModal(modal);

      const modalSubmit = await i.awaitModalSubmit({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          i.customId === `admin-embed-edit-modal-${selectedOption}-collector`,
        time: 0,
      });

      await modalSubmit.deferUpdate();

      switch (selectedOption) {
        case 'content':
          embedData.title = modalSubmit.fields.getTextInputValue('title');
          embedData.description =
            modalSubmit.fields.getTextInputValue('description');
          embedData.url = modalSubmit.fields.getTextInputValue('url');
          const color = modalSubmit.fields.getTextInputValue('color');
          embedData.color = color ? parseInt(color, 16) : null;
          break;

        case 'author':
          embedData.author = {
            name: modalSubmit.fields.getTextInputValue('name'),
            url: modalSubmit.fields.getTextInputValue('url'),
            icon_url: modalSubmit.fields.getTextInputValue('icon_url'),
          };
          break;

        case 'images':
          embedData.thumbnail_url =
            modalSubmit.fields.getTextInputValue('thumbnail');
          embedData.image_url = modalSubmit.fields.getTextInputValue('image');
          break;

        case 'footer':
          embedData.footer = {
            text: modalSubmit.fields.getTextInputValue('text'),
            icon_url: modalSubmit.fields.getTextInputValue('icon_url'),
          };
          break;
      }

      const updatedEmbed = createEmbed({
        author: embedData.author ? JSON.parse(embedData.author) : undefined,
        color: embedData.color,
        title: embedData.title,
        description: embedData.description,
        url: embedData.url,
        thumbnail: { url: embedData.thumbnail_url || '' },
        image: { url: embedData.image_url || '' },
        fields: embedData.fields
          ? (JSON.parse(embedData.fields) as {
              name: string;
              value: string;
              inline: boolean;
            }[])
          : undefined,
        footer: embedData.footer ? JSON.parse(embedData.footer) : undefined,
      });

      await interaction.editReply({ embeds: [updatedEmbed] });
    });

    buttonCollector.on('collect', async (i) => {
      await i.deferUpdate();

      try {
        await MySQL.query(
          'UPDATE embeds SET title = ?, description = ?, url = ?, color = ?, footer = ?, image_url = ?, thumbnail_url = ?, author = ?, fields = ? WHERE title = ?',
          [
            embedData.title,
            embedData.description,
            embedData.url,
            embedData.color,
            JSON.stringify(embedData.footer),
            embedData.image_url,
            embedData.thumbnail_url,
            JSON.stringify(embedData.author),
            JSON.stringify(embedData.fields),
            embedTitle,
          ]
        );

        await i.followUp({
          content: 'Changes saved successfully!',
          ephemeral: true,
        });
      } catch (error) {
        await i.followUp({
          content: 'Failed to save changes. Please try again.',
          ephemeral: true,
        });
      }
    });

    debugStream.write('Collectors created!');
  },
};

export default command;
