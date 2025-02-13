import { Client } from 'discord.js';
import localPackage from '../../../package.json' assert { type: 'json' };

export default async function (_: Client) {
  try {
    let updateFound = false;

    const checkUpdate = async () => {
      if (updateFound) return;

      const githubResponse = await fetch(
        'https://raw.githubusercontent.com/SanukaE/BotBuilder/main/package.json'
      );
      const { version: latestVersion } = await githubResponse.json();
      const { version: localVersion } = localPackage;

      const [localMajor, localMinor = 0, localPatch = 0] = localVersion
        .split('.')
        .map(Number);
      const [latestMajor, latestMinor = 0, latestPatch = 0] = latestVersion
        .split('.')
        .map(Number);

      const isOutdated =
        localMajor < latestMajor ||
        (localMajor === latestMajor && localMinor < latestMinor) ||
        (localMajor === latestMajor &&
          localMinor === latestMinor &&
          localPatch < latestPatch);

      if (isOutdated) {
        console.log(
          `[System] A new version of BotBuilder is available: ${latestVersion}. You are currently using version ${localVersion}. Please consider updating.`
        );
        updateFound = true;
      }
    };

    // Initial check
    await checkUpdate();

    // Check every 2 weeks (14 days)
    if (!updateFound) setInterval(checkUpdate, 14 * 24 * 60 * 60 * 1000);
  } catch (error: any) {
    console.log(
      `[Error] Failed to check for any updates: ${error.message || error}`
    );
  }
}
