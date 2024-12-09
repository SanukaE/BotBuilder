import {
  Client,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  MessageReactionEventDetails,
} from 'discord.js';
import { LoggerType } from './createLogger.js';

type ReactionType = {
  name: string;
  isDevOnly?: boolean;
  enableDebug?: boolean;
  script?: (
    client: Client,
    messageReaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    details: MessageReactionEventDetails,
    debugStream: LoggerType
  ) => Promise<void>;
};

export default ReactionType;
