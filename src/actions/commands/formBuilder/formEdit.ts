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
} from "discord.js";
import { RowDataPacket } from "mysql2";

type FormData = {
  title: string;
  fields: {
    name: string;
    value?: string;
    placeholder?: string;
    required: boolean;
    type: TextInputStyle;
    maxValue?: number;
    minValue?: number;
  }[];
};

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
    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT title FROM forms"
    );

    const focusedValues = rows.filter((row) =>
      row.title.startsWith(focusedOption)
    );
    if (!focusedValues.length) return;

    await interaction.respond(
      focusedValues.map((v) => ({ name: v.title, value: v.title }))
    );
  },

  async script(client, interaction, debugStream) {
    debugStream.write("Getting data from interaction...");

    const formTitle = interaction.options.getString("form-title", true);
    const newTitle = interaction.options.getString("new-title");
    debugStream.write(`formTitle: ${formTitle}`);
    debugStream.write(`newTitle: ${newTitle}`);

    debugStream.write("Checking if form exists...");

    const [existingForm] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM forms WHERE title = ?",
      [formTitle]
    );

    if (!existingForm.length) {
      debugStream.write("Form doesn't exist! Sending reply...");
      await interaction.editReply("No form found with that title.");
      debugStream.write("Reply sent!");
      return;
    }

    debugStream.write("Form exists! Proceeding to edit...");

    let formData = existingForm[0] as FormData;

    if (newTitle) formData.title = newTitle;

    const formEmbed = createEmbed({
      title: formData.title,
      fields: formData.fields.map((field: any) => ({
        name: field.name,
        value: field.value,
      })) ?? [{ name: "No fields", value: "This form has no fields." }],
    });

    const createInput = new ButtonBuilder({
      customId: "form-create-field-collector",
      label: "Create Field",
      style: ButtonStyle.Primary,
    });

    const editInput = new ButtonBuilder({
      customId: "form-edit-field-collector",
      label: "Edit Field",
      style: ButtonStyle.Secondary,
    });

    const saveChanges = new ButtonBuilder({
      customId: "form-save-changes-collector",
      label: "Save Changes",
      style: ButtonStyle.Success,
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [createInput, editInput, saveChanges],
    });

    const followUpMsg = await interaction.followUp({
      embeds: [formEmbed],
      components: [actionRow],
    });

    const collector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "form-create-field-collector") {
        if (formData.fields.length >= 25) {
          await i.reply({
            content: "You can only have a maximum of 25 fields in a form.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const fieldModal = new ModalBuilder({
          customId: "form-create-field-modal-collector",
          title: "Create Form Field",
        });

        const fieldNameInput = new TextInputBuilder({
          customId: "field-name",
          label: "Field Name",
          style: TextInputStyle.Short,
          required: true,
        });

        const fieldValueInput = new TextInputBuilder({
          customId: "field-value",
          label: "Field Value",
          style: TextInputStyle.Paragraph,
          required: false,
        });

        const fieldPlaceholderInput = new TextInputBuilder({
          customId: "field-placeholder",
          label: "Field Placeholder",
          style: TextInputStyle.Short,
          required: false,
        });

        const fieldRequiredInput = new TextInputBuilder({
          customId: "field-required",
          label: "Is this field required? (Yes or No)",
          style: TextInputStyle.Short,
          required: true,
        });

        const fieldTypeInput = new TextInputBuilder({
          customId: "field-type",
          label: "Field Type (Short or Paragraph)",
          style: TextInputStyle.Short,
          required: true,
        });

        const fieldMaxValueInput = new TextInputBuilder({
          customId: "field-max-value",
          label: "Field Max Value (Number)",
          style: TextInputStyle.Short,
          required: false,
        });

        const fieldMinValueInput = new TextInputBuilder({
          customId: "field-min-value",
          label: "Field Min Value (Number)",
          style: TextInputStyle.Short,
          required: false,
        });

        fieldModal.addComponents(
          new ActionRowBuilder<TextInputBuilder>({
            components: [fieldNameInput],
          }),
          new ActionRowBuilder<TextInputBuilder>({
            components: [fieldValueInput],
          }),
          new ActionRowBuilder<TextInputBuilder>({
            components: [fieldPlaceholderInput],
          }),
          new ActionRowBuilder<TextInputBuilder>({
            components: [fieldRequiredInput],
          }),
          new ActionRowBuilder<TextInputBuilder>({
            components: [fieldTypeInput],
          }),
          new ActionRowBuilder<TextInputBuilder>({
            components: [fieldMaxValueInput],
          }),
          new ActionRowBuilder<TextInputBuilder>({
            components: [fieldMinValueInput],
          })
        );

        await i.showModal(fieldModal);

        const modalInteraction = await i.awaitModalSubmit({
          filter: (m) => m.user.id === i.user.id,
          time: 0,
        });
        await modalInteraction.deferReply();

        const fieldName =
          modalInteraction.fields.getTextInputValue("field-name");
        const fieldValue =
          modalInteraction.fields.getTextInputValue("field-value");
        const fieldPlaceholder =
          modalInteraction.fields.getTextInputValue("field-placeholder");
        const fieldRequired =
          modalInteraction.fields
            .getTextInputValue("field-required")
            .toLowerCase() === "yes"
            ? true
            : false;
        const fieldType =
          modalInteraction.fields
            .getTextInputValue("field-type")
            .toLowerCase() === "short"
            ? TextInputStyle.Short
            : TextInputStyle.Paragraph;
        const fieldMaxValue =
          modalInteraction.fields.getTextInputValue("field-max-value");
        const fieldMinValue =
          modalInteraction.fields.getTextInputValue("field-min-value");

        formData.fields.push({
          name: fieldName,
          value: fieldValue,
          placeholder: fieldPlaceholder,
          required: fieldRequired,
          type: fieldType,
          maxValue: fieldMaxValue ? parseInt(fieldMaxValue) : undefined,
          minValue: fieldMinValue ? parseInt(fieldMinValue) : undefined,
        });

        await modalInteraction.followUp("Field created successfully!");
      } else if (i.customId === "form-edit-field-collector") {
        if (formData.fields.length === 0) {
          await i.reply({
            content: "This form has no fields to edit.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const selectMenu = new StringSelectMenuBuilder({
          customId: "form-edit-field-select-collector",
          placeholder: "Select a field to edit",
          options: formData.fields.map((field, index) => ({
            label: field.name || `Field ${index + 1}`,
            value: index.toString(),
          })),
        });
        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>({
          components: [selectMenu],
        });

        const editFieldMsg = await i.reply({
          content: "Select a field to edit:",
          components: [selectRow],
          flags: MessageFlags.Ephemeral,
        });

        const selectCollector = editFieldMsg.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          filter: (m) => m.user.id === i.user.id,
        });

        selectCollector.on("collect", async (selectInteraction) => {
          const selectedFieldIndex = parseInt(selectInteraction.values[0]);
          const selectedField = formData.fields[selectedFieldIndex];

          const fieldModal = new ModalBuilder({
            customId: "form-edit-field-modal-collector",
            title: `Edit Field: ${selectedField.name}`,
          });

          const fieldNameInput = new TextInputBuilder({
            customId: "field-name",
            label: "Field Name",
            value: selectedField.name,
            style: TextInputStyle.Short,
            required: true,
          });

          const fieldValueInput = new TextInputBuilder({
            customId: "field-value",
            label: "Field Value",
            value: selectedField.value || "",
            style: TextInputStyle.Paragraph,
            required: false,
          });

          const fieldPlaceholderInput = new TextInputBuilder({
            customId: "field-placeholder",
            label: "Field Placeholder",
            value: selectedField.placeholder || "",
            style: TextInputStyle.Short,
            required: false,
          });

          const fieldRequiredInput = new TextInputBuilder({
            customId: "field-required",
            label: "Is this field required? (Yes or No)",
            value: selectedField.required ? "Yes" : "No",
            style: TextInputStyle.Short,
            required: true,
          });

          const fieldTypeInput = new TextInputBuilder({
            customId: "field-type",
            label: "Field Type (Short or Paragraph)",
            value:
              selectedField.type === TextInputStyle.Short
                ? "Short"
                : "Paragraph",
            style: TextInputStyle.Short,
            required: true,
          });

          const fieldMaxValueInput = new TextInputBuilder({
            customId: "field-max-value",
            label: "Field Max Value (Number)",
            value: selectedField.maxValue
              ? selectedField.maxValue.toString()
              : "",
            style: TextInputStyle.Short,
            required: false,
          });

          const fieldMinValueInput = new TextInputBuilder({
            customId: "field-min-value",
            label: "Field Min Value (Number)",
            value: selectedField.minValue
              ? selectedField.minValue.toString()
              : "",
            style: TextInputStyle.Short,
            required: false,
          });

          fieldModal.addComponents(
            new ActionRowBuilder<TextInputBuilder>({
              components: [fieldNameInput],
            }),
            new ActionRowBuilder<TextInputBuilder>({
              components: [fieldValueInput],
            }),
            new ActionRowBuilder<TextInputBuilder>({
              components: [fieldPlaceholderInput],
            }),
            new ActionRowBuilder<TextInputBuilder>({
              components: [fieldRequiredInput],
            }),
            new ActionRowBuilder<TextInputBuilder>({
              components: [fieldTypeInput],
            }),
            new ActionRowBuilder<TextInputBuilder>({
              components: [fieldMaxValueInput],
            }),
            new ActionRowBuilder<TextInputBuilder>({
              components: [fieldMinValueInput],
            })
          );

          await selectInteraction.showModal(fieldModal);
          const modalInteraction = await selectInteraction.awaitModalSubmit({
            filter: (m) => m.user.id === selectInteraction.user.id,
            time: 0,
          });

          await modalInteraction.deferReply({ flags: MessageFlags.Ephemeral });

          const fieldName =
            modalInteraction.fields.getTextInputValue("field-name");
          const fieldValue =
            modalInteraction.fields.getTextInputValue("field-value");
          const fieldPlaceholder =
            modalInteraction.fields.getTextInputValue("field-placeholder");
          const fieldRequired =
            modalInteraction.fields
              .getTextInputValue("field-required")
              .toLowerCase() === "yes"
              ? true
              : false;
          const fieldType =
            modalInteraction.fields
              .getTextInputValue("field-type")
              .toLowerCase() === "short"
              ? TextInputStyle.Short
              : TextInputStyle.Paragraph;
          const fieldMaxValue =
            modalInteraction.fields.getTextInputValue("field-max-value");
          const fieldMinValue =
            modalInteraction.fields.getTextInputValue("field-min-value");

          formData.fields[selectedFieldIndex] = {
            name: fieldName,
            value: fieldValue,
            placeholder: fieldPlaceholder,
            required: fieldRequired,
            type: fieldType,
            maxValue: fieldMaxValue ? parseInt(fieldMaxValue) : undefined,
            minValue: fieldMinValue ? parseInt(fieldMinValue) : undefined,
          };

          await modalInteraction.followUp("Field edited successfully!");
          selectCollector.stop();
        });
      } else if (i.customId === "form-save-changes-collector") {
        await MySQL.query(
          "UPDATE forms SET title = ?, fields = ? WHERE title = ?",
          [formData.title, JSON.stringify(formData.fields), formTitle]
        );
        await i.update({
          content: `Form "${formData.title}" has been updated successfully.`,
          embeds: [],
          components: [],
        });
      }
    });
  },
};

export default command;
