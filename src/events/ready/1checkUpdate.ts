import { Client } from 'discord.js';
import localPackage from '../../../package.json' with { type: 'json' };
import fs from "fs";
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import unzipper from 'unzipper';
import getConfig from '#utils/getConfig.js';

export default async function (_: Client) {
  const { autoUpdateEnabled } = getConfig('application') as { autoUpdateEnabled: boolean };

  try {
    let updateFound = false;

    const checkUpdate = async () => {
      if (updateFound) return;

      // Get latest release information from GitHub API
      const releaseResponse = await fetch(
        'https://api.github.com/repos/SanukaE/BotBuilder/releases/latest'
      );
      const releaseData = await releaseResponse.json();

      if(releaseData.draft || releaseData.prerelease) return;

      const latestVersion = releaseData.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
      const { version: localVersion } = localPackage;

      const [localMajor, localMinor = 0, localPatch = 0] = localVersion.replace(/^v/, '')
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
          `[System] A new version of BotBuilder is available: ${latestVersion}. You are currently using version ${localVersion}.${autoUpdateEnabled ? ' Updating now...' : ' Please consider updating.'}`
        );
        updateFound = true;
      }
    };

    const updateFiles = async () => {
      if(!autoUpdateEnabled) return;
      if (!updateFound) return;

      console.log(`[System] Downloading and installing the latest version of BotBuilder...`);

      try {
        // Get latest release information
        const releaseResponse = await fetch(
          'https://api.github.com/repos/SanukaE/BotBuilder/releases/latest'
        );
        const releaseData = await releaseResponse.json();
        const latestVersionData = releaseData.assets.find((a: { name: string }) => a.name.startsWith('BotBuilder') && a.name.endsWith('.zip'));
        
        const downloadUrl = latestVersionData.browser_download_url;

        const zipPath = path.join(process.cwd(), 'update.zip');

        console.log(`[System] Downloading update...`);
        const downloadResponse = await fetch(downloadUrl);
        
        if (!downloadResponse.ok) {
          throw new Error(`Failed to download release: ${downloadResponse.statusText}`);
        }

        // Save zip file
        const fileStream = createWriteStream(zipPath);
        await pipeline(downloadResponse.body!, fileStream);

        // Files and directories to preserve during update
        const preserveItems = [
          'node_modules',
          'localData',
          '.env',
          'configs',
          'faqAnswers.txt',
          'update.zip',
          'build'
        ];

        // Remove old files (except preserved items)
        console.log(`[System] Removing old files...`);
        const rootItems = fs.readdirSync(process.cwd());
        
        for (const item of rootItems) {
          if (!preserveItems.includes(item)) {
            const itemPath = path.join(process.cwd(), item);
            if (fs.statSync(itemPath).isDirectory()) {
              fs.rmSync(itemPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(itemPath);
            }
          }
        }

        console.log(`[System] Extracting files...`);
        const directory = await unzipper.Open.file(zipPath);
        await directory.extract({ path: process.cwd() });

        console.log(`[System] BotBuilder has been successfully updated! Please restart the bot to apply changes.`);
        updateFound = false; // Reset after update

      } catch (error: any) {
        console.error(`[Error] Failed to update BotBuilder: ${error.message || error}`);
      }
    };

    await checkUpdate(); // Initial check
    setInterval(checkUpdate, 14 * 24 * 60 * 60 * 1000); // Check every 2 weeks (14 days)

    if(autoUpdateEnabled)
      setInterval(updateFiles, 14 * 24 * 60 * 60 * 1000);

  } catch (error: any) {
    console.log(
      `[Error] Failed to check for updates: ${error.message || error}`
    );
  }
}