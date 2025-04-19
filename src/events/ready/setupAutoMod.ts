import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  Client,
} from 'discord.js';
import config from '#config' with { type: 'json' };
import { createWarning } from '#utils/createLogger.js';

export default async function (client: Client) {
  const { productionGuildID, autoModEnvProtection } = config;

  if (!productionGuildID) {
    createWarning(
      'Missing productionGuildID in config.json',
      'AutoMod rules will not be set up',
      'Add productionGuildID to config.json',
      'setupAutoMod-readyEvent'
    );
    return;
  }

  const guildAutoModRules = (await client.guilds.fetch(productionGuildID))
    .autoModerationRules;

  try {
    const autoModRules = await guildAutoModRules.fetch();
    const existingRule = autoModRules.find(
      (rule) => rule.name === 'BotBuilder Env Variables'
    );

    if (autoModEnvProtection)
      createWarning(
        'AutoMod Env Protection is enabled in config.json',
        'Your environment variables has a risk of being leaked',
        'Set autoModEnvProtection to false in config.json',
        'setupAutoMod-readyEvent'
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

      console.log('[System] AutoMod Env Protection rule created');
    } else if (autoModEnvProtection) {
      await existingRule?.setKeywordFilter([
        `*${process.env.MYSQL_PASSWORD}*`,
        `*${process.env.NAMELESSMC_API_KEY}*`,
        `*${process.env.REDIS_PASSWORD}*`,
        `*${process.env.GEMINI_API_KEY}*`,
      ]);

      console.log('[System] AutoMod Env Protection rule updated');
    }

    if (!autoModEnvProtection && existingRule) {
      await existingRule.delete(
        'AutoMod Env Protection is disabled in config.'
      );

      console.log('[System] AutoMod Env Protection rule deleted');
    }
  } catch (error: any) {
    console.error(`[Error] ${error.message || error}`);
  }
}
