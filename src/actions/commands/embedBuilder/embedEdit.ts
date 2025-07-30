import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
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
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  MessageFlags,
} from "discord.js";
import { RowDataPacket } from "mysql2";

interface EmbedData {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  footer?: string;
  image_url?: string;
  thumbnail_url?: string;
  author?: string;
  fields?: string;
}

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

interface EmbedAuthor {
  name?: string;
  url?: string;
  icon_url?: string;
}

interface EmbedFooter {
  text?: string;
  icon_url?: string;
}

class EmbedEditor {
  private embedData: EmbedData;
  private originalTitle: string;
  private interaction: ChatInputCommandInteraction;

  constructor(
    embedData: EmbedData,
    originalTitle: string,
    interaction: ChatInputCommandInteraction
  ) {
    this.embedData = { ...embedData };
    this.originalTitle = originalTitle;
    this.interaction = interaction;
  }

  private parseJSON<T>(jsonString: string | null | undefined, fallback: T): T {
    if (!jsonString) return fallback;
    try {
      return JSON.parse(jsonString) as T;
    } catch {
      return fallback;
    }
  }

  private createUpdatedEmbed() {
    const author = this.parseJSON<EmbedAuthor>(this.embedData.author, {});
    const footer = this.parseJSON<EmbedFooter>(this.embedData.footer, {});
    const fields = this.parseJSON<EmbedField[]>(this.embedData.fields, []);

    return createEmbed({
      author:
        Object.keys(author).length > 0 &&
        typeof author.name === "string" &&
        author.name
          ? {
              name: author.name,
              url: author.url,
              icon_url: author.icon_url,
            }
          : undefined,
      color: this.embedData.color,
      title: this.embedData.title,
      description: this.embedData.description,
      url: this.embedData.url,
      thumbnail: { url: this.embedData.thumbnail_url || "" },
      image: { url: this.embedData.image_url || "" },
      fields: fields.length > 0 ? fields : undefined,
      footer:
        Object.keys(footer).length > 0 &&
        typeof footer.text === "string" &&
        footer.text
          ? {
              text: footer.text,
              icon_url: footer.icon_url,
            }
          : undefined,
    });
  }

  private createEditSelectMenu() {
    return new StringSelectMenuBuilder({
      customId: "admin-embed-edit-collector",
      options: [
        {
          emoji: "📝",
          label: "Content",
          description: "Edit title, description, URL & color",
          value: "content",
        },
        {
          emoji: "🖋",
          label: "Author",
          description: "Edit author properties",
          value: "author",
        },
        {
          emoji: "🖼",
          label: "Images",
          description: "Edit thumbnail & image",
          value: "images",
        },
        {
          emoji: "🏷",
          label: "Footer",
          description: "Edit footer properties",
          value: "footer",
        },
        {
          emoji: "📑",
          label: "Fields",
          description: "Manage embed fields",
          value: "fields",
        },
      ],
      placeholder: "Select a field to edit",
    });
  }

  private createSaveButton() {
    return new ButtonBuilder({
      customId: "admin-embed-edit-save-collector",
      emoji: "💾",
      label: "Save Changes",
      style: ButtonStyle.Success,
    });
  }

  private async handleFieldManagement(
    interaction: MessageComponentInteraction
  ) {
    const fieldsActionMenu = new StringSelectMenuBuilder()
      .setCustomId("admin-embed-edit-field-action-collector")
      .setPlaceholder("Select an action")
      .addOptions([
        { label: "Edit Field", value: "edit", emoji: "✏️" },
        { label: "Add Field", value: "add", emoji: "➕" },
        { label: "Remove Field", value: "remove", emoji: "🗑️" },
      ]);

    const fieldsMsg = await interaction.followUp({
      content: "What would you like to do with the fields?",
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          fieldsActionMenu
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });

    try {
      const actionSelection = await fieldsMsg.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === this.interaction.user.id,
      });

      const action = actionSelection.values[0];
      const fields = this.parseJSON<EmbedField[]>(this.embedData.fields, []);

      switch (action) {
        case "edit":
          await this.handleFieldEdit(actionSelection, fields);
          break;
        case "add":
          await this.handleFieldAdd(actionSelection, fields);
          break;
        case "remove":
          await this.handleFieldRemove(actionSelection, fields);
          break;
      }
    } catch (error) {
      await interaction.followUp({
        content: "Field management was cancelled.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async handleFieldEdit(
    interaction: MessageComponentInteraction,
    fields: EmbedField[]
  ) {
    if (fields.length === 0) {
      await interaction.update({
        content: "No fields available to edit.",
        components: [],
      });
      return;
    }

    const fieldSelectMenu = new StringSelectMenuBuilder()
      .setCustomId("admin-embed-edit-field-select-collector")
      .setPlaceholder("Select a field to edit")
      .addOptions(
        fields.map((field, index) => ({
          label:
            field.name.length > 100
              ? field.name.slice(0, 97) + "..."
              : field.name,
          value: index.toString(),
          description:
            field.value.length > 100
              ? field.value.slice(0, 97) + "..."
              : field.value,
        }))
      );

    await interaction.update({
      content: "Select a field to edit:",
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          fieldSelectMenu
        ),
      ],
    });

    try {
      const fieldSelection = await interaction.message.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === this.interaction.user.id,
      });

      const fieldIndex = parseInt(fieldSelection.values[0]);
      const field = fields[fieldIndex];

      const editModal = new ModalBuilder()
        .setCustomId("admin-embed-field-edit-modal-collector")
        .setTitle("Edit Field")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("name")
              .setLabel("Field Name")
              .setStyle(TextInputStyle.Short)
              .setMaxLength(256)
              .setValue(field.name)
              .setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("value")
              .setLabel("Field Value")
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(1024)
              .setValue(field.value)
              .setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("inline")
              .setLabel("Inline (true/false)")
              .setStyle(TextInputStyle.Short)
              .setValue(field.inline.toString())
              .setRequired(false)
          )
        );

      await fieldSelection.showModal(editModal);

      const modalSubmit = await fieldSelection.awaitModalSubmit({
        filter: (i) => i.user.id === this.interaction.user.id,
        time: 0,
      });

      const newName = modalSubmit.fields.getTextInputValue("name");
      const newValue = modalSubmit.fields.getTextInputValue("value");
      const inlineValue = modalSubmit.fields.getTextInputValue("inline");
      const newInline = inlineValue.toLowerCase() === "true";

      fields[fieldIndex] = {
        name: newName,
        value: newValue,
        inline: newInline,
      };
      this.embedData.fields = JSON.stringify(fields);

      await modalSubmit.reply({
        content: "Field updated successfully!",
        flags: MessageFlags.Ephemeral,
      });

      await this.updateEmbedDisplay();
    } catch (error) {
      await interaction.followUp({
        content: "Field edit was cancelled.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async handleFieldAdd(
    interaction: MessageComponentInteraction,
    fields: EmbedField[]
  ) {
    if (fields.length >= 25) {
      await interaction.update({
        content: "Maximum of 25 fields allowed.",
        components: [],
      });
      return;
    }

    const addModal = new ModalBuilder()
      .setCustomId("admin-embed-field-add-modal-collector")
      .setTitle("Add Field")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Field Name")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("value")
            .setLabel("Field Value")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1024)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("inline")
            .setLabel("Inline (true/false)")
            .setStyle(TextInputStyle.Short)
            .setValue("false")
            .setRequired(false)
        )
      );

    await interaction.showModal(addModal);

    try {
      const modalSubmit = await interaction.awaitModalSubmit({
        filter: (i) => i.user.id === this.interaction.user.id,
        time: 0,
      });

      const name = modalSubmit.fields.getTextInputValue("name");
      const value = modalSubmit.fields.getTextInputValue("value");
      const inlineValue = modalSubmit.fields.getTextInputValue("inline");
      const inline = inlineValue.toLowerCase() === "true";

      fields.push({ name, value, inline });
      this.embedData.fields = JSON.stringify(fields);

      await modalSubmit.reply({
        content: "Field added successfully!",
        flags: MessageFlags.Ephemeral,
      });

      await this.updateEmbedDisplay();
    } catch (error) {
      await interaction.followUp({
        content: "Field add was cancelled.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async handleFieldRemove(
    interaction: MessageComponentInteraction,
    fields: EmbedField[]
  ) {
    if (fields.length === 0) {
      await interaction.update({
        content: "No fields available to remove.",
        components: [],
      });
      return;
    }

    const removeSelectMenu = new StringSelectMenuBuilder()
      .setCustomId("admin-embed-field-remove-collector")
      .setPlaceholder("Select a field to remove")
      .addOptions(
        fields.map((field, index) => ({
          label:
            field.name.length > 100
              ? field.name.slice(0, 97) + "..."
              : field.name,
          value: index.toString(),
          description:
            field.value.length > 100
              ? field.value.slice(0, 97) + "..."
              : field.value,
        }))
      );

    await interaction.update({
      content: "Select a field to remove:",
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          removeSelectMenu
        ),
      ],
    });

    try {
      const removeSelection = await interaction.message.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === this.interaction.user.id,
      });

      const fieldIndex = parseInt(removeSelection.values[0]);
      const removedField = fields[fieldIndex];

      fields.splice(fieldIndex, 1);
      this.embedData.fields = JSON.stringify(fields);

      await removeSelection.update({
        content: `Field "${removedField.name}" removed successfully!`,
        components: [],
      });

      await this.updateEmbedDisplay();
    } catch (error) {
      await interaction.followUp({
        content: "Field removal was cancelled.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private createModal(selectedOption: string) {
    const modal = new ModalBuilder()
      .setCustomId(`admin-embed-edit-modal-${selectedOption}-collector`)
      .setTitle(
        `Edit ${
          selectedOption.charAt(0).toUpperCase() + selectedOption.slice(1)
        }`
      );

    const author = this.parseJSON<EmbedAuthor>(this.embedData.author, {});
    const footer = this.parseJSON<EmbedFooter>(this.embedData.footer, {});

    switch (selectedOption) {
      case "content":
        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("title")
              .setLabel("Title")
              .setStyle(TextInputStyle.Short)
              .setMaxLength(256)
              .setValue(this.embedData.title || "")
              .setRequired(false)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("description")
              .setLabel("Description")
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(4000)
              .setValue(this.embedData.description || "")
              .setRequired(false)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("url")
              .setLabel("URL")
              .setStyle(TextInputStyle.Short)
              .setValue(this.embedData.url || "")
              .setRequired(false)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("color")
              .setLabel("Color (Hex without #)")
              .setStyle(TextInputStyle.Short)
              .setValue(
                this.embedData.color
                  ? this.embedData.color.toString(16).padStart(6, "0")
                  : ""
              )
              .setRequired(false)
          )
        );
        break;

      case "author":
        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("name")
              .setLabel("Author Name")
              .setStyle(TextInputStyle.Short)
              .setMaxLength(256)
              .setValue(author.name || "")
              .setRequired(false)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("url")
              .setLabel("Author URL")
              .setStyle(TextInputStyle.Short)
              .setValue(author.url || "")
              .setRequired(false)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("icon_url")
              .setLabel("Author Icon URL")
              .setStyle(TextInputStyle.Short)
              .setValue(author.icon_url || "")
              .setRequired(false)
          )
        );
        break;

      case "images":
        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("thumbnail")
              .setLabel("Thumbnail URL")
              .setStyle(TextInputStyle.Short)
              .setValue(this.embedData.thumbnail_url || "")
              .setRequired(false)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("image")
              .setLabel("Image URL")
              .setStyle(TextInputStyle.Short)
              .setValue(this.embedData.image_url || "")
              .setRequired(false)
          )
        );
        break;

      case "footer":
        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("text")
              .setLabel("Footer Text")
              .setStyle(TextInputStyle.Short)
              .setMaxLength(2048)
              .setValue(footer.text || "")
              .setRequired(false)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("icon_url")
              .setLabel("Footer Icon URL")
              .setStyle(TextInputStyle.Short)
              .setValue(footer.icon_url || "")
              .setRequired(false)
          )
        );
        break;
    }

    return modal;
  }

  private async processModalSubmit(
    modalSubmit: ModalSubmitInteraction,
    selectedOption: string
  ) {
    switch (selectedOption) {
      case "content":
        this.embedData.title =
          modalSubmit.fields.getTextInputValue("title") || this.embedData.title;
        this.embedData.description =
          modalSubmit.fields.getTextInputValue("description") || undefined;
        this.embedData.url =
          modalSubmit.fields.getTextInputValue("url") || undefined;

        const colorInput = modalSubmit.fields.getTextInputValue("color");
        if (colorInput) {
          const colorValue = parseInt(colorInput.replace("#", ""), 16);
          this.embedData.color = isNaN(colorValue) ? undefined : colorValue;
        } else {
          this.embedData.color = undefined;
        }
        break;

      case "author":
        const authorData = {
          name: modalSubmit.fields.getTextInputValue("name") || undefined,
          url: modalSubmit.fields.getTextInputValue("url") || undefined,
          icon_url:
            modalSubmit.fields.getTextInputValue("icon_url") || undefined,
        };

        // Only save if at least one field has content
        const hasAuthorContent = Object.values(authorData).some((val) => val);
        this.embedData.author = hasAuthorContent
          ? JSON.stringify(authorData)
          : undefined;
        break;

      case "images":
        this.embedData.thumbnail_url =
          modalSubmit.fields.getTextInputValue("thumbnail") || undefined;
        this.embedData.image_url =
          modalSubmit.fields.getTextInputValue("image") || undefined;
        break;

      case "footer":
        const footerData = {
          text: modalSubmit.fields.getTextInputValue("text") || undefined,
          icon_url:
            modalSubmit.fields.getTextInputValue("icon_url") || undefined,
        };

        // Only save if at least one field has content
        const hasFooterContent = Object.values(footerData).some((val) => val);
        this.embedData.footer = hasFooterContent
          ? JSON.stringify(footerData)
          : undefined;
        break;
    }

    await this.updateEmbedDisplay();
  }

  private async updateEmbedDisplay() {
    const updatedEmbed = this.createUpdatedEmbed();
    await this.interaction.editReply({ embeds: [updatedEmbed] });
  }

  async saveChanges() {
    try {
      await MySQL.query(
        `UPDATE embeds SET 
         title = ?, description = ?, url = ?, color = ?, 
         footer = ?, image_url = ?, thumbnail_url = ?, 
         author = ?, fields = ? 
         WHERE title = ?`,
        [
          this.embedData.title,
          this.embedData.description,
          this.embedData.url,
          this.embedData.color,
          this.embedData.footer,
          this.embedData.image_url,
          this.embedData.thumbnail_url,
          this.embedData.author,
          this.embedData.fields,
          this.originalTitle,
        ]
      );
      return true;
    } catch (error) {
      console.error("Failed to save embed changes:", error);
      return false;
    }
  }

  async startEditing() {
    const editMenu = this.createEditSelectMenu();
    const saveBtn = this.createSaveButton();

    const firstRow = new ActionRowBuilder<StringSelectMenuBuilder>({
      components: [editMenu],
    });

    const secondRow = new ActionRowBuilder<ButtonBuilder>({
      components: [saveBtn],
    });

    const embed = this.createUpdatedEmbed();

    const embedMsg = await this.interaction.editReply({
      content:
        'Use the menu below to edit different sections of the embed. Click "Save Changes" when you\'re done.',
      embeds: [embed],
      components: [firstRow, secondRow],
    });

    // Create collectors without timeout
    const menuCollector = embedMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) =>
        i.user.id === this.interaction.user.id &&
        i.customId === "admin-embed-edit-collector",
    });

    const buttonCollector = embedMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === this.interaction.user.id &&
        i.customId === "admin-embed-edit-save-collector",
    });

    menuCollector.on("collect", async (i) => {
      const selectedOption = i.values[0];

      if (selectedOption === "fields") {
        await i.deferUpdate();
        await this.handleFieldManagement(i);
      } else {
        const modal = this.createModal(selectedOption);
        await i.showModal(modal);

        try {
          const modalSubmit = await i.awaitModalSubmit({
            filter: (modalI) => modalI.user.id === this.interaction.user.id,
            time: 0,
          });

          await modalSubmit.deferUpdate();
          await this.processModalSubmit(modalSubmit, selectedOption);
        } catch (error) {
          // Modal submission was cancelled
          await i.followUp({
            content: "Modal submission was cancelled.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    });

    buttonCollector.on("collect", async (i) => {
      await i.deferUpdate();

      const success = await this.saveChanges();

      if (success) {
        await i.followUp({
          content: "✅ Changes saved successfully!",
          flags: MessageFlags.Ephemeral,
        });

        // Disable components after saving
        await i.editReply({
          components: [],
        });

        menuCollector.stop();
        buttonCollector.stop();
      } else {
        await i.followUp({
          content: "❌ Failed to save changes. Please try again.",
          flags: MessageFlags.Ephemeral,
        });
      }
    });
  }
}

const command: CommandType = {
  name: "embed-edit",
  description:
    "Edit an existing embed with improved interface and error handling.",
  options: [
    {
      name: "embed-title",
      description: "The embed you want to edit.",
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.Administrator],

  async handleAutoComplete(client, interaction, focusedOption) {
    try {
      const [rows] = await MySQL.query<RowDataPacket[]>(
        "SELECT title FROM embeds WHERE title LIKE ? LIMIT 25",
        [`%${focusedOption}%`]
      );

      if (!rows.length) {
        await interaction.respond([]);
        return;
      }

      await interaction.respond(
        rows.map((row) => ({ name: row.title, value: row.title }))
      );
    } catch (error) {
      console.error("Autocomplete error:", error);
      await interaction.respond([]);
    }
  },

  async script(client, interaction, debugStream) {
    try {
      debugStream.write("Starting embed edit process...");

      const embedTitle = interaction.options.getString("embed-title", true);
      debugStream.write(`Target embed: ${embedTitle}`);

      const [rows] = await MySQL.query<RowDataPacket[]>(
        "SELECT * FROM embeds WHERE title = ?",
        [embedTitle]
      );

      if (!rows.length) {
        throw new Error(`No embed found with title: "${embedTitle}"`);
      }

      const embedData = rows[0] as EmbedData;
      debugStream.write("Embed data retrieved successfully");

      const editor = new EmbedEditor(embedData, embedTitle, interaction);
      await editor.startEditing();

      debugStream.write("Edit session started successfully");
    } catch (error: any) {
      debugStream.write(`Error: ${error.message}`);
      throw error;
    }
  },
};

export default command;
