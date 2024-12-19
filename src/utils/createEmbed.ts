import { EmbedBuilder, EmbedData, APIEmbed, Client } from 'discord.js';
import config from '../../config.json' assert { type: 'json' };

//TODO: add icon & remove branding if premium

export default function (data?: EmbedData | APIEmbed, client?: Client) {
  const { botMotto } = config;

  return new EmbedBuilder({
    author: {
      name: 'Powered by BotBuilder',
      url: 'https://github.com/SanukaE/BotBuilder',
      //iconURL: ""
    },

    ...data,

    footer: {
      text: botMotto || 'BotBuilder, the future of Discord Bots.',
      iconURL: botMotto ? client?.user?.avatarURL()! : '',
    },
  });
}
