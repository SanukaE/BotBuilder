import MySQL from "#libs/MySQL.js";
import ModalType from "#types/ModalType.js";
import createEmbed from "#utils/createEmbed.js";
import getConfig from "#utils/getConfig.js";
import openTicket from "#utils/openTicket.js";
import { TextInputStyle } from "discord.js";
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

const modal: ModalType = {
  customID: `ticket-open-form-`, //`ticket-open-form-{category`
  isDisabled: !supportConfig.enableTicketSystem,

  async script(client, interaction, debugStream) {
    const category = interaction.customId.split("-")[3];
    const [categoryName, supportTeamRoleID, formTitle] =
      supportConfig.ticketCategories
        .find((cat) => cat.startsWith(category))!
        .split(":");

    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT fields FROM forms WHERE title = ?",
      [formTitle]
    );

    if (rows.length === 0) {
      await interaction.followUp(
        "Looks like this form doesn't have any fields to answer."
      );
      return;
    }

    const formFields: FormField[] =
      typeof rows[0].fields === "string"
        ? JSON.parse(rows[0].fields || "[]")
        : rows[0].fields;

    let fieldValues: { name: string; value: string }[] = [];
    for (const field of formFields) {
      fieldValues.push({
        name: field.name,
        value: interaction.fields.getTextInputValue(field.name) ?? "No Answer",
      });
    }

    const embed = createEmbed({
      title: formTitle,
      fields: fieldValues,
    });

    const formData = fieldValues.reduce((object: any, field) => {
      object[field.name] = field.value;
      return object;
    }, {});

    const ticketChannel = await openTicket(
      client,
      interaction,
      categoryName,
      supportTeamRoleID,
      supportConfig.ticketWelcomeMessage,
      supportConfig.autoCloseTicketsAfter,
      supportConfig.autoSaveTranscripts,
      supportConfig.ticketCategoryID,
      JSON.stringify(formData)
    );

    await ticketChannel.sendTyping();
    (await ticketChannel.send({ embeds: [embed] })).pin();
  },
};

export default modal;
