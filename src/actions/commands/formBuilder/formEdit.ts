import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import { RowDataPacket } from "mysql2";

interface FormField {
  name: string;
  value?: string;
  placeholder?: string;
  required: boolean;
  type: TextInputStyle;
}

interface FormData {
  id?: number;
  title: string;
  fields: FormField[];
}

interface FormRow extends RowDataPacket {
  id: number;
  title: string;
  fields: string | FormField[];
}

const MAX_FIELDS = 5;

const command: CommandType = {
  name: "form-edit",
  description: "Edit an existing form.",
  options: [
    {
      name: "form-title",
      description: "The title of the form you want to edit",
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: true,
    },
    {
      name: "new-title",
      description: "The new title of the form",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  permissions: [PermissionFlagsBits.Administrator],

  async handleAutoComplete(client, interaction, focusedOption) {
    try {
      const [rows] = await MySQL.query<FormRow[]>(
        "SELECT title FROM forms WHERE title LIKE ? LIMIT 25",
        [`${focusedOption}%`]
      );

      if (!rows.length) {
        await interaction.respond([]);
        return;
      }

      await interaction.respond(
        rows.map((row) => ({ name: row.title, value: row.title }))
      );
    } catch (error) {
      console.error("Error in autocomplete:", error);
      await interaction.respond([]);
    }
  },

  async script(client, interaction, _) {
    const formTitle = interaction.options.getString("form-title", true);
    const newTitle = interaction.options.getString("new-title");

    // Validate new title if provided
    if (newTitle && (newTitle.length < 1 || newTitle.length > 100)) {
      await interaction.editReply(
        "Form title must be between 1 and 100 characters."
      );
      return;
    }

    const [existingForm] = await MySQL.query<FormRow[]>(
      "SELECT * FROM forms WHERE title = ?",
      [formTitle]
    );

    if (!existingForm.length) {
      await interaction.editReply("No form found with that title.");
      return;
    }

    const formData: FormData = {
      id: existingForm[0].id,
      title: newTitle || existingForm[0].title,
      fields: parseFormFields(existingForm[0].fields),
    };

    await handleFormEditor(interaction, formData, formTitle);
  },
};

function parseFormFields(fieldsData: string | FormField[]): FormField[] {
  if (!fieldsData) return [];

  if (Array.isArray(fieldsData)) return fieldsData;

  if (typeof fieldsData === "string") {
    try {
      const parsed = JSON.parse(fieldsData);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function createFormEmbed(formData: FormData) {
  return createEmbed({
    title: formData.title,
    fields:
      formData.fields.length > 0
        ? formData.fields.map((field, index) => ({
            name: `${index + 1}. ${field.name}`,
            value: [
              field.value ? `**Value:** ${field.value}` : null,
              field.placeholder
                ? `**Placeholder:** ${field.placeholder}`
                : null,
              `**Required:** ${field.required ? "Yes" : "No"}`,
              `**Type:** ${
                field.type === TextInputStyle.Short ? "Short" : "Paragraph"
              }`,
            ]
              .filter(Boolean)
              .join("\n"),
            inline: false,
          }))
        : [
            {
              name: "No fields",
              value: "This form has no fields.",
              inline: false,
            },
          ],
  });
}

function createActionRow() {
  return new ActionRowBuilder<ButtonBuilder>({
    components: [
      new ButtonBuilder({
        customId: "form-create-field-collector",
        label: "Create Field",
        style: ButtonStyle.Primary,
      }),
      new ButtonBuilder({
        customId: "form-edit-field-collector",
        label: "Edit Field",
        style: ButtonStyle.Secondary,
      }),
      new ButtonBuilder({
        customId: "form-delete-field-collector",
        label: "Delete Field",
        style: ButtonStyle.Danger,
      }),
      new ButtonBuilder({
        customId: "form-save-changes-collector",
        label: "Save Changes",
        style: ButtonStyle.Success,
      }),
    ],
  });
}

async function handleFormEditor(
  interaction: any,
  formData: FormData,
  originalTitle: string
) {
  const followUpMsg = await interaction.followUp({
    embeds: [createFormEmbed(formData)],
    components: [createActionRow()],
  });

  const collector = followUpMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i: ButtonInteraction) => i.user.id === interaction.user.id,
    time: 0,
  });

  collector.on("collect", async (i: ButtonInteraction) => {
    switch (i.customId) {
      case "form-create-field-collector":
        await handleCreateField(i, formData, interaction);
        break;
      case "form-edit-field-collector":
        await handleEditField(i, formData, interaction);
        break;
      case "form-delete-field-collector":
        await handleDeleteField(i, formData, interaction);
        break;
      case "form-save-changes-collector":
        await handleSaveChanges(i, formData, originalTitle, collector);
        break;
    }
  });
}

async function handleCreateField(
  interaction: ButtonInteraction,
  formData: FormData,
  followUpMsg: any
) {
  if (formData.fields.length >= MAX_FIELDS) {
    await interaction.reply({
      content: `You can only have a maximum of ${MAX_FIELDS} fields in a form.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = createFieldModal(
    "Create Form Field",
    "form-create-field-modal-collector"
  );
  await interaction.showModal(modal);

  const modalInteraction = await interaction.awaitModalSubmit({
    filter: (m: ModalSubmitInteraction) => m.user.id === interaction.user.id,
    time: 0,
  });
  await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

  const fieldData = extractFieldDataFromModal(modalInteraction);
  if (!fieldData) {
    await modalInteraction.followUp("Invalid field data provided.");
    return;
  }

  formData.fields.push(fieldData);

  await followUpMsg.editReply({
    embeds: [createFormEmbed(formData)],
    components: [createActionRow()],
  });

  await modalInteraction.followUp("Field created successfully!");
}

async function handleEditField(
  interaction: ButtonInteraction,
  formData: FormData,
  followUpMsg: any
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (formData.fields.length === 0) {
    await interaction.followUp({
      content: "This form has no fields to edit.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectMenu = new StringSelectMenuBuilder({
    customId: "form-edit-field-select-collector",
    placeholder: "Select a field to edit",
    options: formData.fields.map((field, index) => ({
      label: field.name.substring(0, 100) || `Field ${index + 1}`,
      value: index.toString(),
      description: `${field.required ? "Required" : "Optional"} | ${
        field.type === TextInputStyle.Short ? "Short" : "Paragraph"
      }`,
    })),
  });

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>({
    components: [selectMenu],
  });

  const editFieldMsg = await interaction.followUp({
    content: "Select a field to edit:",
    components: [selectRow],
    flags: MessageFlags.Ephemeral,
  });

  const selectCollector = editFieldMsg.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: (m: StringSelectMenuInteraction) =>
      m.user.id === interaction.user.id,
    time: 0,
  });

  selectCollector.on(
    "collect",
    async (selectInteraction: StringSelectMenuInteraction) => {
      const selectedFieldIndex = parseInt(selectInteraction.values[0]);
      const selectedField = formData.fields[selectedFieldIndex];

      const modal = createFieldModal(
        `Edit Field: ${selectedField.name}`,
        "form-edit-field-modal-collector",
        selectedField
      );

      await selectInteraction.showModal(modal);

      const modalInteraction = await selectInteraction.awaitModalSubmit({
        filter: (m: ModalSubmitInteraction) =>
          m.user.id === selectInteraction.user.id,
        time: 0,
      });

      await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

      const fieldData = extractFieldDataFromModal(modalInteraction);
      if (!fieldData) {
        await modalInteraction.followUp("Invalid field data provided.");
        return;
      }

      formData.fields[selectedFieldIndex] = fieldData;

      await followUpMsg.editReply({
        embeds: [createFormEmbed(formData)],
        components: [createActionRow()],
      });

      await modalInteraction.followUp({
        content: "Field updated successfully!",
        flags: MessageFlags.Ephemeral,
      });
      selectCollector.stop();
    }
  );
}

async function handleDeleteField(
  interaction: ButtonInteraction,
  formData: FormData,
  followUpMsg: any
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (formData.fields.length === 0) {
    await interaction.followUp({
      content: "This form has no fields to delete.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectMenu = new StringSelectMenuBuilder({
    customId: "form-delete-field-select-collector",
    placeholder: "Select a field to delete",
    options: formData.fields.map((field, index) => ({
      label: field.name.substring(0, 100) || `Field ${index + 1}`,
      value: index.toString(),
      description: `${field.required ? "Required" : "Optional"} | ${
        field.type === TextInputStyle.Short ? "Short" : "Paragraph"
      }`,
    })),
  });

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>({
    components: [selectMenu],
  });

  const deleteFieldMsg = await interaction.followUp({
    content: "⚠️ Select a field to delete (this action cannot be undone):",
    components: [selectRow],
    flags: MessageFlags.Ephemeral,
  });

  const selectCollector = deleteFieldMsg.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: (m: StringSelectMenuInteraction) =>
      m.user.id === interaction.user.id,
    time: 0,
  });

  selectCollector.on(
    "collect",
    async (selectInteraction: StringSelectMenuInteraction) => {
      const selectedFieldIndex = parseInt(selectInteraction.values[0]);
      const deletedField = formData.fields.splice(selectedFieldIndex, 1)[0];

      await followUpMsg.editReply({
        embeds: [createFormEmbed(formData)],
        components: [createActionRow()],
      });

      await selectInteraction.update({
        content: `Field "${deletedField.name}" has been deleted.`,
        components: [],
      });

      selectCollector.stop();
    }
  );
}

async function handleSaveChanges(
  interaction: ButtonInteraction,
  formData: FormData,
  originalTitle: string,
  collector: any
) {
  await MySQL.query("UPDATE forms SET title = ?, fields = ? WHERE title = ?", [
    formData.title,
    JSON.stringify(formData.fields),
    originalTitle,
  ]);

  await interaction.update({
    content: `✅ Form "${formData.title}" has been updated successfully.`,
    embeds: [],
    components: [],
  });

  collector.stop();
}

function createFieldModal(
  title: string,
  customId: string,
  existingField?: FormField
) {
  const modal = new ModalBuilder({
    customId,
    title,
  });

  const components = [
    new TextInputBuilder({
      customId: "field-name",
      label: "Field Name (max 45 characters)",
      style: TextInputStyle.Short,
      maxLength: 45,
      value: existingField?.name || "",
      required: true,
    }),
    new TextInputBuilder({
      customId: "field-value",
      label: "Default Value (optional)",
      style: TextInputStyle.Paragraph,
      maxLength: 4000,
      value: existingField?.value || "",
      required: false,
    }),
    new TextInputBuilder({
      customId: "field-placeholder",
      label: "Placeholder Text (optional)",
      style: TextInputStyle.Short,
      maxLength: 100,
      value: existingField?.placeholder || "",
      required: false,
    }),
    new TextInputBuilder({
      customId: "field-required",
      label: "Required? (yes/no)",
      style: TextInputStyle.Short,
      maxLength: 3,
      value: existingField ? (existingField.required ? "yes" : "no") : "no",
      required: true,
    }),
    new TextInputBuilder({
      customId: "field-type",
      label: "Input Type (short/paragraph)",
      style: TextInputStyle.Short,
      maxLength: 9,
      value: existingField
        ? existingField.type === TextInputStyle.Short
          ? "short"
          : "paragraph"
        : "short",
      required: true,
    }),
  ];

  components.forEach((component) => {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>({ components: [component] })
    );
  });

  return modal;
}

function extractFieldDataFromModal(
  modalInteraction: ModalSubmitInteraction
): FormField | null {
  const fieldName = modalInteraction.fields
    .getTextInputValue("field-name")
    .trim();
  const fieldValue =
    modalInteraction.fields.getTextInputValue("field-value").trim() ||
    undefined;
  const fieldPlaceholder =
    modalInteraction.fields.getTextInputValue("field-placeholder").trim() ||
    undefined;
  const fieldRequiredText = modalInteraction.fields
    .getTextInputValue("field-required")
    .toLowerCase()
    .trim();
  const fieldTypeText = modalInteraction.fields
    .getTextInputValue("field-type")
    .toLowerCase()
    .trim();

  if (!fieldName) return null;

  const fieldRequired = ["yes", "y", "true", "1"].includes(fieldRequiredText);
  const fieldType =
    fieldTypeText === "paragraph"
      ? TextInputStyle.Paragraph
      : TextInputStyle.Short;

  return {
    name: fieldName,
    value: fieldValue,
    placeholder: fieldPlaceholder,
    required: fieldRequired,
    type: fieldType,
  };
}

export default command;
