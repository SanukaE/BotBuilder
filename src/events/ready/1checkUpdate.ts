import { Client } from 'discord.js';
import localPackage from '../../../package.json' with { type: 'json' };
import fs from "fs";
import path from 'path';
import getConfig from '#utils/getConfig.js';

interface UpdateChecker {
  intervalId?: NodeJS.Timeout;
  isUpdating: boolean;
  lastCheckTime: number;
}

const updateChecker: UpdateChecker = {
  isUpdating: false,
  lastCheckTime: 0
};

export default async function (client: Client) {
  const { autoUpdateEnabled } = getConfig('application') as { autoUpdateEnabled: boolean };

  try {
    let updateFound = false;
    let packageJsonUpdated = false;

    const checkUpdate = async (): Promise<void> => {
      // Prevent multiple simultaneous checks
      if (updateChecker.isUpdating) return;
      
      // Rate limiting: don't check more than once per hour
      const now = Date.now();
      if (now - updateChecker.lastCheckTime < 60 * 60 * 1000) return;
      
      updateChecker.lastCheckTime = now;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const githubResponse = await fetch(
          'https://raw.githubusercontent.com/SanukaE/BotBuilder/main/package.json',
          { 
            signal: controller.signal,
            headers: {
              'User-Agent': 'BotBuilder-UpdateChecker/1.0'
            }
          }
        );
        
        clearTimeout(timeoutId);

        if (!githubResponse.ok) {
          throw new Error(`GitHub API returned ${githubResponse.status}`);
        }

        const { version: latestVersion } = await githubResponse.json();
        const { version: localVersion } = localPackage;

        const [localMajor, localMinor = 0, localPatch = 0] = localVersion
          .split('.')
          .map(v => parseInt(v.replace(/\D/g, ""), 10));
        const [latestMajor, latestMinor = 0, latestPatch = 0] = (latestVersion as string)
          .split('.')
          .map(v => parseInt(v.replace(/\D/g, ""), 10));

        const isOutdated =
          localMajor < latestMajor ||
          (localMajor === latestMajor && localMinor < latestMinor) ||
          (localMajor === latestMajor &&
            localMinor === latestMinor &&
            localPatch < latestPatch);

        if (isOutdated && !updateFound) {
          console.log(
            `[System] A new version of BotBuilder is available: ${latestVersion}. You are currently using version ${localVersion}.` + 
            (autoUpdateEnabled ? ' Auto-updating...' : ' Please consider updating.')
          );
          updateFound = true;

          if (autoUpdateEnabled) {
            try {
              await updateFiles();
              console.log(`[System] BotBuilder has been updated to the latest version. Please restart the bot to apply changes.`);
              
              // Notify about package.json changes
              if (packageJsonUpdated) {
                console.log(
                  '[System] package.json updated. Run "npm install" to install dependencies, then restart the bot.'
                );
              }
              
              // Clear the interval after successful update
              if (updateChecker.intervalId) {
                clearInterval(updateChecker.intervalId);
                updateChecker.intervalId = undefined;
              }
            } catch (error: any) {
              updateFound = false; // Reset to allow retry
              console.log(`[System] Update failed: ${error.message}`);
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('[System] Update check timed out');
        } else {
          console.log(`[System] Failed to check for updates: ${error.message}`);
        }
      }
    };

    // List of files to skip update check (relative to project root)
    const skipUpdateFiles = [
      'faqAnswers.txt',
      '.gitignore',
      '.github',
      '.vscode',
      'node_modules',
      'build',
      'localData',
      '.git',
      '.env',
      'configs',
      'ApplicationLogs',
      'backups'
    ];

    const updateFiles = async (): Promise<void> => {
      if (updateChecker.isUpdating) {
        console.log('[System] Update already in progress, skipping...');
        return;
      }

      updateChecker.isUpdating = true;
      console.log('[System] Updating BotBuilder files to the latest version...');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const mainBranchResponse = await fetch(
          'https://api.github.com/repos/SanukaE/BotBuilder/contents/',
          { 
            signal: controller.signal,
            headers: {
              'User-Agent': 'BotBuilder-UpdateChecker/1.0'
            }
          }
        );
        
        clearTimeout(timeoutId);

        if (!mainBranchResponse.ok) {
          throw new Error(`GitHub API returned ${mainBranchResponse.status}`);
        }

        const mainBranchFiles = await mainBranchResponse.json();

        // Fetch entire directory tree recursively
        const remoteTree = await fetchRemoteTree(mainBranchFiles);

        // Helper to check if a file should be skipped
        const shouldSkipUpdate = (filePath: string): boolean => {
          const normalized = filePath.replace(/\\/g, '/');
          return skipUpdateFiles.some(skipFile => 
            normalized === skipFile || 
            normalized.startsWith(skipFile + '/') ||
            normalized.endsWith('/' + skipFile)
          );
        };

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

        // Helper to recursively fetch all remote files/dirs with retry logic
        async function fetchRemoteTree(files: any[], basePath = ''): Promise<any[]> {
          for (const file of files) {
            if (file.type === 'dir') {
              let retries = 3;
              while (retries > 0) {
                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 15000);

                  const dirFilesResponse = await fetch(
                    `https://api.github.com/repos/SanukaE/BotBuilder/contents/${file.path}`,
                    { 
                      signal: controller.signal,
                      headers: {
                        'User-Agent': 'BotBuilder-UpdateChecker/1.0'
                      }
                    }
                  );
                  
                  clearTimeout(timeoutId);

                  if (!dirFilesResponse.ok) {
                    throw new Error(`Failed to fetch directory: ${dirFilesResponse.status}`);
                  }

                  const dirFiles = await dirFilesResponse.json();
                  file._children = await fetchRemoteTree(dirFiles, file.path);
                  break;
                } catch (error: any) {
                  retries--;
                  if (retries === 0) {
                    console.log(`[System] Failed to fetch directory ${file.path}: ${error.message}`);
                    file._children = [];
                  } else {
                    console.log(`[System] Retrying fetch for ${file.path} (${retries} attempts left)`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                  }
                }
              }
            }
          }
          return files;
        }

        // Recursive update function with better error handling
        async function updateFilesRecursive(files: any[], basePath = ''): Promise<void> {
          for (const file of files) {
            const filePath = path.join(basePath, file.name || file.path);

            if (shouldSkipUpdate(filePath)) continue;

            try {
              if (file.type === 'file') {
                const absFilePath = path.join(process.cwd(), filePath);
                
                // Ensure directory exists
                const dirPath = path.dirname(absFilePath);
                if (!fs.existsSync(dirPath)) {
                  fs.mkdirSync(dirPath, { recursive: true });
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                const fileResponse = await fetch(file.download_url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!fileResponse.ok) {
                  throw new Error(`Failed to download file: ${fileResponse.status}`);
                }

                const newFileContent = await fileResponse.text();

                let localFileContent = '';
                if (fs.existsSync(absFilePath)) {
                  localFileContent = fs.readFileSync(absFilePath, 'utf-8');
                }

                if (newFileContent !== localFileContent) {
                  // Track package.json changes
                  if (filePath === 'package.json') {
                    packageJsonUpdated = true;
                  }

                  // Create backup before overwriting
                  if (fs.existsSync(absFilePath)) {
                    const backupDir = path.join(process.cwd(), 'backups', 'update-backups');
                    if (!fs.existsSync(backupDir)) {
                      fs.mkdirSync(backupDir, { recursive: true });
                    }
                    const timestamp = Date.now();
                    const backupPath = path.join(backupDir, `${path.basename(filePath)}.backup.${timestamp}`);
                    fs.copyFileSync(absFilePath, backupPath);
                  }

                  fs.writeFileSync(absFilePath, newFileContent, 'utf-8');
                  console.log(`[System] Updated file: ${filePath}`);
                }
              } else if (file.type === 'dir') {
                const dirPath = path.join(process.cwd(), filePath);
                if (!fs.existsSync(dirPath)) {
                  fs.mkdirSync(dirPath, { recursive: true });
                }
                
                if (file._children) {
                  await updateFilesRecursive(file._children, file.path);
                }
              }
            } catch (error: any) {
              console.log(`[System] Failed to update ${filePath}: ${error.message}`);
            }
          }
        }

        // Delete local files/dirs that do not exist in remote
        async function deleteOldFiles(remoteFiles: any[]): Promise<void> {
          try {
            const remoteTree = await fetchRemoteTree(remoteFiles);
            const remotePaths = buildRemotePaths(remoteTree);

            function deleteRecursively(localDir: string, basePath = ''): void {
              if (!fs.existsSync(localDir)) return;

              const entries = fs.readdirSync(localDir, { withFileTypes: true });
              for (const entry of entries) {
                const relPath = path.join(basePath, entry.name).replace(/\\/g, '/');
                const absPath = path.join(localDir, entry.name);

                if (shouldSkipUpdate(relPath)) continue;

                if (!remotePaths.has(relPath)) {
                  try {
                    if (entry.isDirectory()) {
                      fs.rmSync(absPath, { recursive: true, force: true });
                      console.log(`[System] Deleted old directory: ${relPath}`);
                    } else {
                      fs.unlinkSync(absPath);
                      console.log(`[System] Deleted old file: ${relPath}`);
                    }
                  } catch (error: any) {
                    console.log(`[System] Failed to delete ${relPath}: ${error.message}`);
                  }
                } else if (entry.isDirectory()) {
                  deleteRecursively(absPath, relPath);
                }
              }
            }

            deleteRecursively(process.cwd());
          } catch (error: any) {
            console.log(`[System] Failed to delete old files: ${error.message}`);
          }
        }

        // Update files and then delete old ones
        await updateFilesRecursive(remoteTree);
        await deleteOldFiles(remoteTree);

      } catch (error: any) {
        console.log(`[System] Update failed: ${error.message}`);
      } finally {
        updateChecker.isUpdating = false;
      }
    };

    // Initial check
    await checkUpdate();

    // Always set up interval for periodic checks (every 2 weeks)
    updateChecker.intervalId = setInterval(
      checkUpdate, 
      14 * 24 * 60 * 60 * 1000 // 2 weeks
    );

    // Cleanup on process exit
    process.on('SIGINT', () => {
      if (updateChecker.intervalId) {
        clearInterval(updateChecker.intervalId);
      }
    });

    process.on('SIGTERM', () => {
      if (updateChecker.intervalId) {
        clearInterval(updateChecker.intervalId);
      }
    });

  } catch (error: any) {
    console.log(
      `[Error] Failed to initialize update checker: ${error.message || error}`
    );
  }
}
