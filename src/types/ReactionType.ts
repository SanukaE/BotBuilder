import {
  Client,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  MessageReactionEventDetails,
} from 'discord.js';
import { LoggerType } from '#utils/createLogger.js';

/**
 * Represents a reaction type configuration for Discord bot reactions.
 * @interface ReactionType
 * @property {string} name - The name of the reaction.
 * @property {boolean} [isDevOnly] - Whether the reaction is only available to developers.
 * @property {boolean} [isGuildOnly] - Whether the reaction can only be used in guilds.
 * @property {boolean} [enableDebug] - Whether debug mode is enabled for this reaction.
 * @property {boolean} [isDisabled] - Whether the reaction is currently disabled.
 * @property {function} script - The function to execute when the reaction is triggered.
 */
type ReactionType = {
  name: string;
  isDevOnly?: boolean;
  isGuildOnly?: boolean;
  enableDebug?: boolean;
  isDisabled?: boolean;
  script: (
    client: Client,
    messageReaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    details: MessageReactionEventDetails,
    debugStream: LoggerType
  ) => Promise<void>;
};

export default ReactionType;
