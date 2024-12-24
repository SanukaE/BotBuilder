import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  Client,
} from 'discord.js';
import config from '../../../config.json' assert { type: 'json' };
import { createLogger, LoggerOptions } from '#utils/createLogger.js';
import 'dotenv/config';

export default async function (client: Client) {
  const { productionGuildID } = config;

  if (!productionGuildID) {
    const warningLogger = createLogger(
      `setupAutoMod-readyEvent`,
      LoggerOptions.Warning,
      true
    );

    warningLogger.write('Warning: Missing productionGuildID in config.json');
    warningLogger.write('Result: AutoMod rules will not be set up');
    warningLogger.write('Fix: Add productionGuildID to config.json');

    warningLogger.close();
    return;
  }

  const guildAutoModRules = (await client.guilds.fetch(productionGuildID))
    .autoModerationRules;

  try {
    const autoModRules = await guildAutoModRules.fetch();
    const existingRule = autoModRules.find(
      (rule) => rule.name === 'BotBuilder Env Variables'
    );

    if (!existingRule) {
      await guildAutoModRules.create({
        name: 'BotBuilder Env Variables',
        enabled: true,
        actions: [
          { type: AutoModerationActionType.BlockMessage },
          {
            type: AutoModerationActionType.Timeout,
            metadata: { durationSeconds: 604800 }, //1 week
          },
        ],
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: {
          keywordFilter: [
            `*${process.env.MYSQL_USER}*`,
            `*${process.env.MYSQL_PASSWORD}*`,
            `*${process.env.NAMELESSMC_API_KEY}*`,
            `*${process.env.GEMINI_API_KEY}*`,
          ],
        },
      });
    } else
      await existingRule.setKeywordFilter([
        `*${process.env.MYSQL_USER}*`,
        `*${process.env.MYSQL_PASSWORD}*`,
        `*${process.env.NAMELESSMC_API_KEY}*`,
        `*${process.env.GEMINI_API_KEY}*`,
      ]);
  } catch (error) {
    const errorLogger = createLogger(
      `setupAutoMod-readyEvent`,
      LoggerOptions.Error,
      true
    );
    errorLogger.write(error as string);
    errorLogger.close();
  }
}
