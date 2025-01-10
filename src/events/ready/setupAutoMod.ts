import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  Client,
} from 'discord.js';
import config from '#config' assert { type: 'json' };
import { createLogger, LoggerOptions } from '#utils/createLogger.js';

export default async function (client: Client) {
  const { productionGuildID, autoModEnvProtection } = config;

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

    if (!existingRule && autoModEnvProtection) {
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
            `*${process.env.MYSQL_PASSWORD}*`,
            `*${process.env.NAMELESSMC_API_KEY}*`,
            `*${process.env.REDIS_PASSWORD}*`,
            `*${process.env.GEMINI_API_KEY}*`,
          ],
        },
      });
    } else if (autoModEnvProtection) {
      await existingRule?.setKeywordFilter([
        `*${process.env.MYSQL_PASSWORD}*`,
        `*${process.env.NAMELESSMC_API_KEY}*`,
        `*${process.env.REDIS_PASSWORD}*`,
        `*${process.env.GEMINI_API_KEY}*`,
      ]);
    }

    if (!autoModEnvProtection && existingRule)
      await existingRule.delete(
        'AutoMod Env Protection is disabled in config.'
      );
  } catch (error: any) {
    console.error(`[Error] ${error.message || error}`);
  }
}
