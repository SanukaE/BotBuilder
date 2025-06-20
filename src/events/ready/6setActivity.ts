import { Client, ActivityType } from 'discord.js';
import getConfig from '#utils/getConfig.js';

export default async function (client: Client) {
  const { appActivity } = getConfig("application") as { appActivity: string };

  client.user?.setActivity({
    name: 'BotBuilder',
    type: ActivityType.Custom,
    url: 'https://github.com/SanukaE/BotBuilder',
    state: appActivity || '🤖 Powered by BotBuilder!',
  });
}
