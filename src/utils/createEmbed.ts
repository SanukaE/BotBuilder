import { EmbedBuilder, APIEmbed } from 'discord.js';
import config from '#config' assert { type: 'json' };
import { client } from '../index.js';

export default function (data?: APIEmbed) {
  const { appMotto } = config;

  return new EmbedBuilder({
    author: {
      name: 'Powered by BotBuilder',
      url: 'https://builtbybit.com/resources/botbuilder.59151',
      icon_url: 'https://i.postimg.cc/wB6FR8PP/Bot-Builder.webp',
    },

    footer: {
      text: appMotto || 'Your Free, Open-Source, All-In-One Discord Companion',
      icon_url: appMotto
        ? client.user?.displayAvatarURL() ||
          'https://i.postimg.cc/wB6FR8PP/Bot-Builder.webp'
        : 'https://i.postimg.cc/wB6FR8PP/Bot-Builder.webp',
    },

    ...data,
  });
}
