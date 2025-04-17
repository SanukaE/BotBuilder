import { Client, ActivityType } from 'discord.js';
import config from '#config' with { type: 'json' };

export default async function (client: Client) {
  const { appActivity } = config;

  client.user?.setActivity({
    name: 'BotBuilder',
    type: ActivityType.Custom,
    url: 'https://github.com/SanukaE/BotBuilder',
    state: appActivity || '🤖 Powered by BotBuilder!',
  });
}
