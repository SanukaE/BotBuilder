import { Client, Message, OmitPartialGroupDMChannel } from "discord.js";
import MySQL from "#libs/MySQL.js";
import { RowDataPacket } from "mysql2";
import getConfig from "#utils/getConfig.js";

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!message.inGuild()) return;

  if (!message.deletable) return;
  if (message.author.bot) return;

  const { channelID } = getConfig("counting") as {
    channelID: string;
  };
  if (message.channelId !== channelID) return;

  const mentionMembers = Array.from(message.mentions.members.values()).filter(
    (member) => !member.user.bot
  );
  if (!mentionMembers.length) return;

  let afkMessages = [];

  try {
    for (const member of mentionMembers) {
      const [rows] = await MySQL.query<RowDataPacket[]>(
        "SELECT * FROM afk_users WHERE userID = ?",
        [member.id]
      );

      if (!rows.length) continue;
      else
        afkMessages.push({
          userID: rows[0].userID,
          afkMessage: rows[0].afkMessage,
        });
    }

    if (!afkMessages.length) return;

    await message.channel.sendTyping();

    await message.reply({
      content:
        `> AFK Notice\n` +
        afkMessages.reduce((preValue, currValue) => {
          const mentionedMember = mentionMembers.find(
            (member) => member.id === currValue.userID
          )!;

          return (
            preValue +
            `\n${mentionedMember.displayName}: ${currValue.afkMessage}`
          );
        }, ""),
    });
  } catch (error) {
    console.error("[Error] Failed checking AFK status:", error);
  }
}
