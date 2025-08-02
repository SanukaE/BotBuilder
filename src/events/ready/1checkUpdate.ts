import { Client } from 'discord.js';
import localPackage from '../../../package.json' with { type: 'json' };
import fs from "fs";
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';
import { Extract } from 'unzipper';
import getConfig from '#utils/getConfig.js';

interface UpdateChecker {
  intervalId?: NodeJS.Timeout;
  isUpdating: boolean;
  lastCheckTime: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  zipball_url: string;
  tarball_url: string;
  prerelease: boolean;
  draft: boolean;
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

        const releasesResponse = await fetch(
          'https://api.github.com/repos/SanukaE/BotBuilder/releases/latest',
          { 
            signal: controller.signal,
            headers: {
              'User-Agent': 'BotBuilder-UpdateChecker/1.0',
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );
        
        clearTimeout(timeoutId);

        if (!releasesResponse.ok) {
          throw new Error(`GitHub API returned ${releasesResponse.status}`);
        }

        const latestRelease: GitHubRelease = await releasesResponse.json();
        
        // Skip prereleases and drafts
        if (latestRelease.prerelease || latestRelease.draft) {
          console.log('[System] Latest release is a prerelease or draft, skipping update check.');
          return;
        }

        const latestVersion = latestRelease.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
        const { version: localVersion } = localPackage;

        const [localMajor, localMinor = 0, localPatch = 0] = localVersion
          .split('.')
          .map(v => parseInt(v.replace(/\D/g, ""), 10));
        const [latestMajor, latestMinor = 0, latestPatch = 0] = latestVersion
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
            `[System] A new version of BotBuilder is available: ${latestVersion} (${latestRelease.name}). You are currently using version ${localVersion}.` + 
            (autoUpdateEnabled ? ' Auto-updating...' : ' Please consider updating.')
          );
          updateFound = true;

          if (autoUpdateEnabled) {
            try {
              await updateFromRelease(latestRelease);
              console.log(`[System] BotBuilder has been updated to version ${latestVersion}. Please restart the bot to apply changes.`);
              
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

    const updateFromRelease = async (release: GitHubRelease): Promise<void> => {
      if (updateChecker.isUpdating) {
        console.log('[System] Update already in progress, skipping...');
        return;
      }

      updateChecker.isUpdating = true;
      console.log(`[System] Updating BotBuilder to version ${release.tag_name}...`);

      const tempDir = path.join(process.cwd(), 'temp-update');
      const zipPath = path.join(tempDir, 'release.zip');

      try {
        // Create temp directory
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Download the release zip
        console.log('[System] Downloading release archive...');
        await downloadRelease(release.zipball_url, zipPath);

        // Extract the zip
        console.log('[System] Extracting release archive...');
        const extractedDir = await extractRelease(zipPath, tempDir);

        // Update files from extracted release
        console.log('[System] Updating files...');
        await updateFilesFromExtracted(extractedDir);

        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });

      } catch (error: any) {
        // Clean up temp directory on error
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        throw error;
      } finally {
        updateChecker.isUpdating = false;
      }
    };

    const downloadRelease = async (downloadUrl: string, outputPath: string): Promise<void> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      try {
        const response = await fetch(downloadUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'BotBuilder-UpdateChecker/1.0'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to download release: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body received');
        }

        const fileStream = createWriteStream(outputPath);
        await pipeline(response.body, fileStream);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const extractRelease = async (zipPath: string, extractDir: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        let extractedDirName = '';
        
        createReadStream(zipPath)
          .pipe(Extract({ path: extractDir }))
          .on('entry', (entry) => {
            // Capture the root directory name from the first entry
            if (!extractedDirName && entry.type === 'Directory') {
              extractedDirName = entry.path;
            }
          })
          .on('close', () => {
            if (extractedDirName) {
              resolve(path.join(extractDir, extractedDirName));
            } else {
              // Fallback: find the extracted directory
              const entries = fs.readdirSync(extractDir, { withFileTypes: true });
              const dir = entries.find(entry => entry.isDirectory());
              if (dir) {
                resolve(path.join(extractDir, dir.name));
              } else {
                reject(new Error('Could not find extracted directory'));
              }
            }
          })
          .on('error', reject);
      });
    };

    const updateFilesFromExtracted = async (extractedDir: string): Promise<void> => {
      // Helper to check if a file should be skipped
      const shouldSkipUpdate = (filePath: string): boolean => {
        const normalized = filePath.replace(/\\/g, '/');
        return skipUpdateFiles.some(skipFile => 
          normalized === skipFile || 
          normalized.startsWith(skipFile + '/') ||
          normalized.endsWith('/' + skipFile)
        );
      };

      // Get all files from extracted directory
      const getAllFiles = (dir: string, basePath = ''): Array<{ sourcePath: string, relativePath: string, isDirectory: boolean }> => {
        const files: Array<{ sourcePath: string, relativePath: string, isDirectory: boolean }> = [];
        
        if (!fs.existsSync(dir)) return files;

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');
          const sourcePath = path.join(dir, entry.name);
          
          if (shouldSkipUpdate(relativePath)) continue;

          if (entry.isDirectory()) {
            files.push({ sourcePath, relativePath, isDirectory: true });
            files.push(...getAllFiles(sourcePath, relativePath));
          } else {
            files.push({ sourcePath, relativePath, isDirectory: false });
          }
        }
        
        return files;
      };

      const extractedFiles = getAllFiles(extractedDir);

      // Create backup directory
      const backupDir = path.join(process.cwd(), 'backups', 'update-backups');
      const timestamp = Date.now();
      const backupPath = path.join(backupDir, `backup-${timestamp}`);

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Update files
      for (const file of extractedFiles) {
        try {
          const targetPath = path.join(process.cwd(), file.relativePath);

          if (file.isDirectory) {
            // Create directory if it doesn't exist
            if (!fs.existsSync(targetPath)) {
              fs.mkdirSync(targetPath, { recursive: true });
              console.log(`[System] Created directory: ${file.relativePath}`);
            }
          } else {
            // Ensure parent directory exists
            const parentDir = path.dirname(targetPath);
            if (!fs.existsSync(parentDir)) {
              fs.mkdirSync(parentDir, { recursive: true });
            }

            // Check if file content has changed
            let shouldUpdate = true;
            if (fs.existsSync(targetPath)) {
              const existingContent = fs.readFileSync(targetPath, 'utf-8');
              const newContent = fs.readFileSync(file.sourcePath, 'utf-8');
              shouldUpdate = existingContent !== newContent;
            }

            if (shouldUpdate) {
              // Create backup of existing file
              if (fs.existsSync(targetPath)) {
                const backupFilePath = path.join(backupPath, file.relativePath);
                const backupFileDir = path.dirname(backupFilePath);
                if (!fs.existsSync(backupFileDir)) {
                  fs.mkdirSync(backupFileDir, { recursive: true });
                }
                fs.copyFileSync(targetPath, backupFilePath);
              }

              // Track package.json changes
              if (file.relativePath === 'package.json') {
                packageJsonUpdated = true;
              }

              // Copy new file
              fs.copyFileSync(file.sourcePath, targetPath);
              console.log(`[System] Updated file: ${file.relativePath}`);
            }
          }
        } catch (error: any) {
          console.log(`[System] Failed to update ${file.relativePath}: ${error.message}`);
        }
      }

      // Delete old files that don't exist in the new release
      await deleteOldFiles(extractedFiles);
    };

    const deleteOldFiles = async (newFiles: Array<{ relativePath: string, isDirectory: boolean }>): Promise<void> => {
      const shouldSkipUpdate = (filePath: string): boolean => {
        const normalized = filePath.replace(/\\/g, '/');
        return skipUpdateFiles.some(skipFile => 
          normalized === skipFile || 
          normalized.startsWith(skipFile + '/') ||
          normalized.endsWith('/' + skipFile)
        );
      };

      const newFilePaths = new Set(newFiles.map(f => f.relativePath));

      const deleteRecursively = (localDir: string, basePath = ''): void => {
        if (!fs.existsSync(localDir)) return;

        const entries = fs.readdirSync(localDir, { withFileTypes: true });
        for (const entry of entries) {
          const relPath = path.join(basePath, entry.name).replace(/\\/g, '/');
          const absPath = path.join(localDir, entry.name);

          if (shouldSkipUpdate(relPath)) continue;

          if (!newFilePaths.has(relPath)) {
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
      };

      try {
        deleteRecursively(process.cwd());
      } catch (error: any) {
        console.log(`[System] Failed to delete old files: ${error.message}`);
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