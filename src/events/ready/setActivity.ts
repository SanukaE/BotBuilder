import { Client, ActivityType } from 'discord.js';

export default async function (client: Client) {
  client.user?.setActivity({
    name: 'on BotBuilder!',
    type: ActivityType.Streaming,
    url: 'https://github.com/SanukaE/BotBuilder',
    state: 'The future of Discord Bots',
  });
}
