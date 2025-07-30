import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import getConfig from "#utils/getConfig.js";
import openTicket from "#utils/openTicket.js";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { RowDataPacket } from "mysql2";

type SupportConfig = {
  supportChannelID: string;
  enableTicketSystem: boolean;
  ticketCategoryID: string;
  ticketCategories: string[];
  ticketWelcomeMessage: string;
  autoCloseTicketsAfter: number;
  mentionSupportTeam: boolean;
  autoSaveTranscripts: boolean;
  helpUserWithTicket: boolean;
  allowMultipleTickets: boolean;
};

type FormField = {
  name: string;
  value?: string;
  placeholder?: string;
  required: boolean;
  type: TextInputStyle;
};

const supportConfig = getConfig("support") as SupportConfig;

const command: CommandType = {
  name: "ticket-open",
  description: "Open a ticket for support or assistance.",
  options: [
    {
      name: "category",
      description: "The category of the ticket.",
      type: ApplicationCommandOptionType.String,
      required: supportConfig.ticketCategories.length > 0,
      choices: supportConfig.ticketCategories.map((category) => ({
        name: category.split(":")[0],
        value: category.split(":")[0],
      })),
    },
  ],
  isGuildOnly: true,
  isDisabled: !supportConfig.enableTicketSystem,

  async script(client, interaction, debugStream) {
    const category = interaction.options.getString("category", true);
    const [categoryName, supportTeamRoleID, formTitle] =
      supportConfig.ticketCategories
        .find((cat) => cat.startsWith(category))!
        .split(":");

    if (!supportConfig.allowMultipleTickets) {
      const [existingTickets] = await MySQL.query<RowDataPacket[]>(
        "SELECT * FROM tickets WHERE category = ? AND ownerID = ?",
        [categoryName, interaction.user.id]
      );

      if (existingTickets.length > 0) {
        await interaction.followUp(
          `You already have a ticket open under \`${existingTickets[0].category}\`. Please you that ticket or close it first. (Your existing ticket: <#${existingTickets[0].channelID}>)`
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

export default command;
