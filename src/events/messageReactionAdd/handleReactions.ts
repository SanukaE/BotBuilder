import {
  Client,
  MessageReaction,
  User,
  MessageReactionEventDetails,
  PartialMessageReaction,
  PartialUser,
} from 'discord.js';
import config from '../../../config.json' assert { type: 'json' };
import { ActionTypes, getActions } from '../../utils/getActions.js';
import ReactionType from '../../utils/ReactionType.js';
import { LoggerOptions, createLogger } from '../../utils/createLogger.js';

export default async function (
  client: Client,
  messageReaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  details: MessageReactionEventDetails
) {
  const { developmentGuildID, isMaintenanceEnabled } = config;
  const message = messageReaction.message;

  if (messageReaction.count && messageReaction.count > 1) {
    const messageReply = await message.reply({
      content: 'You can only react to a message once.',
      allowedMentions: { repliedUser: false },
    });
    await messageReaction.remove();

    setTimeout(async () => {
      await messageReply.delete();
    }, 60_000);

    return;
  }

  if (isMaintenanceEnabled && message.guildId !== developmentGuildID) {
    const messageReply = await message.reply({
      content: 'The bot is under maintenance.',
      allowedMentions: { repliedUser: false },
    });
    await messageReaction.remove();

    setTimeout(async () => {
      await messageReply.delete();
    }, 60_000);

    return;
  }

  const reactions = (await getActions(ActionTypes.Reactions)) as ReactionType[];
  const reaction = reactions.find(
    (reaction) => reaction.name === messageReaction.emoji.name
  );

  if (
    !reaction ||
    (reaction.isDevOnly && message.guildId !== developmentGuildID)
  )
    return;

  if (reaction.isGuildOnly && !message.inGuild()) {
    const messageReply = await message.reply({
      content: 'This reaction can only be used in a server.',
      allowedMentions: { repliedUser: false },
    });
    await messageReaction.remove();

    setTimeout(async () => {
      await messageReply.delete();
    }, 60_000);

    return;
  }

  const debugLogger = createLogger(
    `${reaction.name}-reaction`,
    LoggerOptions.Debug,
    reaction.enableDebug
  );
  try {
    await reaction.script!(client, messageReaction, user, details, debugLogger);
  } catch (error) {
    const errorMessageReply = await message.reply({
      content: `There was an error while running the command:\`\`\`${error}\`\`\``,
      allowedMentions: { repliedUser: false },
    });
    await messageReaction.remove();

    setTimeout(async () => {
      await errorMessageReply.delete();
    }, 60_000);

    const errorLogger = createLogger(`${reaction}`, LoggerOptions.Error, true);
    errorLogger.write(error as string);
    errorLogger.close();
  } finally {
    debugLogger.close();
  }
}
