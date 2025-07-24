import MySQL from "#libs/MySQL.js";
import {
  ChannelType,
  Client,
  CommandInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import saveTicketTranscript from "./saveTicketTranscript.js";
import getConfig from "./getConfig.js";

export default async function (
  client: Client,
  interaction: CommandInteraction | ModalSubmitInteraction,
  categoryName: string,
  supportTeamRoleID: string,
  ticketWelcomeMessage: string,
  autoCloseTicketsAfter: number,
  autoSaveTranscripts: boolean,
  ticketCategoryID?: string,
  formData?: string
) {
  const supportConfig = getConfig("support") as any;
  const ticketChannel = await interaction.guild!.channels.create({
    name: `${categoryName.toLowerCase().replaceAll(/[- ]/g, "_")}-${
      interaction.user.username
    }`,
    type: ChannelType.GuildText,
    parent: ticketCategoryID,
    permissionOverwrites: [
      {
        id: interaction.guild!.id,
        deny: ["ViewChannel"],
      },
      {
        id: interaction.user.id,
        allow: [
          "ViewChannel",
          "SendMessages",
          "ReadMessageHistory",
          "AttachFiles",
          "SendVoiceMessages",
        ],
      },
      {
        id: supportTeamRoleID,
        allow: [
          "ViewChannel",
          "SendMessages",
          "ReadMessageHistory",
          "AttachFiles",
          "SendVoiceMessages",
        ],
      },
    ],
    reason: `Ticket opened by ${interaction.user.username} (${interaction.user.id})`,
  });

  await MySQL.query(
    "INSERT INTO tickets (category, channelID, ownerID, formData) VALUES (?, ?, ?, ?)",
    [categoryName, ticketChannel.id, interaction.user.id, formData]
  );

  const mentionMsg = await ticketChannel.send(
    `<@${interaction.user.id}> This is your ticket channel.` +
      supportConfig.mentionSupportTeam
      ? `||<@&${supportTeamRoleID}>||`
      : ""
  );
  await mentionMsg.delete();

  if (ticketWelcomeMessage) {
    await ticketChannel.sendTyping();
    await ticketChannel.send(ticketWelcomeMessage);
  }

  await interaction.followUp(
    `A ticket for \`${categoryName}\` has being opened. Your ticket is <#${ticketChannel.id}>`
  );

  if (autoCloseTicketsAfter > 0) {
    const closeDuration = autoCloseTicketsAfter * 24 * 60 * 60 * 1000;

    const intervalID = setInterval(async () => {
      const lastMessage = ticketChannel.lastMessage;

      const closeTicket = async () => {
        await ticketChannel.sendTyping();
        await ticketChannel.send(
          `This ticket is now closing due to inactivity...`
        );

        if (autoSaveTranscripts) {
          await ticketChannel.sendTyping();
          await saveTicketTranscript(
            client,
            ticketChannel.id,
            "Inactive Ticket"
          );
          await ticketChannel.send(
            "A transcript of this ticket has been saved!"
          );
        }

        const ownerDMChannel = await interaction.user.createDM();

        if (ownerDMChannel.isSendable()) {
          await ownerDMChannel.sendTyping();
          await ownerDMChannel.send(
            `Hey ${interaction.user.displayName}, just want to update on your ${categoryName} ticket. It has been deleted due to inactivity. If your problem hasn't been resolved please open a new ticket.`
          );
        }

        await MySQL.query("DELETE FROM tickets WHERE channelID = ?", [
          ticketChannel.id,
        ]);
        await ticketChannel.delete("Inactive Ticket");
        clearInterval(intervalID);
      };

      if (lastMessage) {
        const howOld = Date.now() - lastMessage.createdTimestamp;

        if (howOld >= closeDuration) await closeTicket();
      } else await closeTicket();
    }, closeDuration);
  }

  return ticketChannel;
}
