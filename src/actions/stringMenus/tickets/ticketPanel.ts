import MySQL from "#libs/MySQL.js";
import StringMenuType from "#types/StringMenuType.js";
import getConfig from "#utils/getConfig.js";
import openTicket from "#utils/openTicket.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { RowDataPacket } from "mysql2";

type FormField = {
  name: string;
  value?: string;
  placeholder?: string;
  required: boolean;
  type: TextInputStyle;
};

const stringMenu: StringMenuType = {
  customID: "ticket-panel-select",
  isGuildOnly: true,

  async script(client, interaction, debugStream) {
    const supportConfig = getConfig("support") as any;
    const category = interaction.values[0];
    const [categoryName, supportTeamRoleID, formTitle] = category.split(":");

    if (!supportConfig.allowMultipleTickets) {
      const [existingTickets] = await MySQL.query<RowDataPacket[]>(
        "SELECT * FROM tickets WHERE category = ? AND ownerID = ?",
        [categoryName, interaction.user.id]
      );

      if (existingTickets.length > 0) {
        await interaction.followUp(
          `You already have a ticket open under \`${existingTickets[0].category}\`. Please use that ticket or close it first. (Your existing ticket: <#${existingTickets[0].channelID}>)`
        );
        return;
      }
    }

    let formFields: FormField[] = [];
    if (formTitle) {
      const [row] = await MySQL.query<RowDataPacket[]>(
        "SELECT * FROM forms WHERE title = ?",
        [formTitle]
      );

      if (row.length > 0)
        formFields =
          typeof row[0].fields === "string"
            ? JSON.parse(row[0].fields || "[]")
            : row[0].fields;
    }

    if (formTitle) {
      const formModel = new ModalBuilder({
        customId: `ticket-open-form-${category}`,
        title: formTitle,
      });

      for (const field of formFields) {
        const textInput = new TextInputBuilder({
          customId: field.name,
          label: field.name,
          value: field.value,
          placeholder: field.placeholder,
          required: field.required,
          style: field.type,
        });

        formModel.addComponents(
          new ActionRowBuilder<TextInputBuilder>({ components: [textInput] })
        );
      }

      const fillFormBtn = new ButtonBuilder({
        customId: `ticket-open-form-fill-collector`,
        label: "Fill Form",
        style: ButtonStyle.Primary,
        emoji: "✍️",
      });

      const actionRow = new ActionRowBuilder<ButtonBuilder>({
        components: [fillFormBtn],
      });

      const followUpMsg = await interaction.followUp({
        content: `Click the "Fill Form" button to proceed with your ticket.`,
        components: [actionRow],
      });

      const formCollector = followUpMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
      });

      formCollector.on("collect", async (i) => {
        await i.showModal(formModel);
      });
    } else
      await openTicket(
        client,
        interaction,
        categoryName,
        supportTeamRoleID,
        supportConfig.ticketWelcomeMessage,
        supportConfig.autoCloseTicketsAfter,
        supportConfig.autoSaveTranscripts,
        supportConfig.ticketCategoryID
      );
  },
};

export default stringMenu;
