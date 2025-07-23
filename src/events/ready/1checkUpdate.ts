import { Client } from 'discord.js';
import localPackage from '../../../package.json' with { type: 'json' };
import fs from "fs";
import path from 'path';
import getConfig from '#utils/getConfig.js';

export default async function (_: Client) {
  const { autoUpdateEnabled } = getConfig('application') as { autoUpdateEnabled: boolean };

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

    // List of files to skip update check (relative to project root)
    const skipUpdateFiles = [
      'faqAnswers.txt'
    ];

    const updateFiles = async () => {
      if (!updateFound) return;

      console.log(
      `[System] Updating BotBuilder files to the latest version...`
      );

      const mainBranchResponse = await fetch('https://api.github.com/repos/SanukaE/BotBuilder/contents/');
      const mainBranchFiles = await mainBranchResponse.json();

      // List of config files to protect
      const configDir = path.join(process.cwd(), 'configs');
      // Dynamically fetch all config files in the configs directory
      const protectedConfigs = fs.existsSync(configDir)
      ? fs.readdirSync(configDir).filter(file => file.endsWith('.json'))
      : [];

      // Helper to check if a file is a protected config
      const isProtectedConfig = (filePath: string) => {
      return filePath.startsWith('configs/') && protectedConfigs.includes(path.basename(filePath));
      };

      // Helper to check if a file should be skipped
      const shouldSkipUpdate = (filePath: string) => {
      // Normalize for cross-platform
      const normalized = filePath.replace(/\\/g, '/');
      return skipUpdateFiles.some(skipFile => normalized === skipFile || normalized.endsWith('/' + skipFile));
      };

      // Helper to update config schema (properties) but not values
      async function updateConfigFile(configPath: string, remoteUrl: string) {
      const localConfigPath = path.join(process.cwd(), configPath);
      let localConfig: any[] = [];
      let remoteConfig: any[] = [];

      try {
        localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf-8'));
      } catch {
        localConfig = [];
      }

      const remoteConfigText = await (await fetch(remoteUrl)).text();
      try {
        remoteConfig = JSON.parse(remoteConfigText);
      } catch {
        // If remote config is invalid, skip update
        return;
      }

      // Merge logic:
      // - Section 0: values (preserve local values, add/remove keys as needed, only update value if type changed)
      // - Section 1: meta (name/description, always update)
      // - Section 2: schema (always update)

      // Section 0: values
      const localValues = localConfig[0] || {};
      const remoteValues = remoteConfig[0] || {};
      const remoteSchema = remoteConfig[2] || {};
      const mergedValues: Record<string, any> = {};

      // Add/update properties from remote
      for (const key of Object.keys(remoteSchema)) {
        if (key in localValues) {
        // Only update value if type is different
        const localType = typeof localValues[key];
        const remoteType = remoteSchema[key].type?.replace('[]', 'Array') || typeof remoteValues[key];
        const isArray = remoteSchema[key].type?.endsWith('[]');
        if (
          (isArray && !Array.isArray(localValues[key])) ||
          (!isArray && localType !== remoteType && remoteType !== 'select')
        ) {
          // Type changed, use remote default
          mergedValues[key] = remoteValues[key];
        } else {
          // Keep local value
          mergedValues[key] = localValues[key];
        }
        } else {
        // New property, use remote value
        mergedValues[key] = remoteValues[key];
        }
      }
      // Remove properties not in remote
      for (const key of Object.keys(localValues)) {
        if (!(key in remoteSchema)) {
        // Property removed in remote, skip it
        continue;
        }
      }

      // Section 1: meta (always update)
      const meta = remoteConfig[1] || {};

      // Section 2: schema (always update)
      const schema = remoteConfig[2] || {};

      // Write merged config
      const mergedConfig = [mergedValues, meta, schema];
      fs.writeFileSync(localConfigPath, JSON.stringify(mergedConfig, null, 2), 'utf-8');
      console.log(`[System] Updated config schema: ${configPath}`);
      }

      // Helper to build a set of all remote files/dirs (relative paths)
      function buildRemotePaths(files: any[], basePath = ''): Set<string> {
      const paths = new Set<string>();
      for (const file of files) {
        const filePath = path.join(basePath, file.name || file.path).replace(/\\/g, '/');
        paths.add(filePath);
        if (file.type === 'dir' && file._children) {
        for (const childPath of buildRemotePaths(file._children, file.path)) {
          paths.add(childPath);
        }
        }
      }
      return paths;
      }

      // Helper to recursively fetch all remote files/dirs and attach as _children
      async function fetchRemoteTree(files: any[], basePath = ''): Promise<any[]> {
      for (const file of files) {
        if (file.type === 'dir') {
        const dirFilesResponse = await fetch(`https://api.github.com/repos/SanukaE/BotBuilder/contents/${file.path}`);
        const dirFiles = await dirFilesResponse.json();
        file._children = await fetchRemoteTree(dirFiles, file.path);
        }
      }
      return files;
      }

      // Recursive update function
      async function updateFilesRecursive(files: any[], basePath = '') {
      for (const file of files) {
        const filePath = path.join(basePath, file.name || file.path);

        if (shouldSkipUpdate(filePath)) {
        console.log(`[System] Skipped file (update ignored): ${filePath}`);
        continue;
        }

        if (file.type === 'file') {
        if (isProtectedConfig(filePath)) {
          // Only update schema/properties, not values
          await updateConfigFile(filePath, file.download_url);
          continue;
        }

        const absFilePath = path.join(process.cwd(), filePath);
        fs.mkdirSync(path.dirname(absFilePath), { recursive: true });

        const fileResponse = await fetch(file.download_url);
        const newFileContent = await fileResponse.text();

        let localFileContent = '';
        if (fs.existsSync(absFilePath)) {
          localFileContent = fs.readFileSync(absFilePath, 'utf-8');
        }

        if (newFileContent !== localFileContent) {
          fs.writeFileSync(absFilePath, newFileContent, 'utf-8');
          console.log(`[System] Updated file: ${filePath}`);
        }
        } else if (file.type === 'dir') {
        const dirPath = path.join(process.cwd(), filePath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        const dirFilesResponse = await fetch(`https://api.github.com/repos/SanukaE/BotBuilder/contents/${file.path}`);
        const dirFiles = await dirFilesResponse.json();
        await updateFilesRecursive(dirFiles, file.path);
        }
      }
      }

      // Delete local files/dirs that do not exist in remote
      async function deleteOldFiles(remoteFiles: any[]) {
      // Build remote paths set
      const remoteTree = await fetchRemoteTree(remoteFiles);
      const remotePaths = buildRemotePaths(remoteTree);

      // Helper to recursively delete files/dirs not in remote
      function deleteRecursively(localDir: string, basePath = '') {
        const entries = fs.readdirSync(localDir, { withFileTypes: true });
        for (const entry of entries) {
        const relPath = path.join(basePath, entry.name).replace(/\\/g, '/');
        const absPath = path.join(localDir, entry.name);

        // Never delete node_modules, .git, .env, or protected configs
        if (
          relPath.startsWith('node_modules') ||
          relPath.startsWith('.git') ||
          relPath === '.env' ||
          isProtectedConfig(relPath) ||
          shouldSkipUpdate(relPath)
        ) {
          continue;
        }

        if (!remotePaths.has(relPath)) {
          // Not in remote, delete
          if (entry.isDirectory()) {
          fs.rmSync(absPath, { recursive: true, force: true });
          console.log(`[System] Deleted old directory: ${relPath}`);
          } else {
          fs.unlinkSync(absPath);
          console.log(`[System] Deleted old file: ${relPath}`);
          }
        } else if (entry.isDirectory()) {
          deleteRecursively(absPath, relPath);
        }
        }
      }

      deleteRecursively(process.cwd());
      }

      // Update files and then delete old ones
      await updateFilesRecursive(mainBranchFiles);
      await deleteOldFiles(mainBranchFiles);
    }

    // Initial check
    await checkUpdate();

    // Check every 2 weeks (14 days)
    if (!updateFound) setInterval(checkUpdate, 14 * 24 * 60 * 60 * 1000);
    else if(autoUpdateEnabled) {
      await updateFiles();
      console.log(`[System] BotBuilder has been updated to the latest version. Please restart the bot to apply changes.`);
      updateFound = false; // Reset after update
    }
  } catch (error: any) {
    console.log(
      `[Error] Failed to check for any updates: ${error.message || error}`
    );
  }
}
