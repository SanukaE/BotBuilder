import { Client } from "discord.js";
import getConfig from "./getConfig.js";

export default async function (
  client: Client,
  currentChannelID: string,
  displayName: string,
  level: number
) {
  const experienceConfig = getConfig("experience") as any;
  if (!experienceConfig.enableLevelUpMessage) return;

  const levelUpMessage = (experienceConfig.levelUpMessage as string)
    .replaceAll("{user}", displayName)
    .replaceAll("{level}", level.toString());
  const levelUpMessageChannel =
    (experienceConfig.levelUpMessageChannel as string) || currentChannelID;

  const channel = await client.channels.fetch(levelUpMessageChannel);
  if (!channel || !channel.isSendable())
    throw new Error("Level up message channel is not valid or not sendable.");

  await channel.send(levelUpMessage);
}
