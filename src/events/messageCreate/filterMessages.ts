import { Client, Message, OmitPartialGroupDMChannel } from 'discord.js';

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  //TODO: Use automod to prevent users from sending env variables in chat.
}
