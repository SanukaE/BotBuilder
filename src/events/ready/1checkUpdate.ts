import { Client } from 'discord.js';
import localPackage from '../../../package.json' with { type: 'json' };
import fs, { readFileSync, rmSync, unlinkSync, writeFileSync } from "fs";
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';
import { Extract } from 'unzipper';
import getConfig from '#utils/getConfig.js';
import getAllFiles from '#utils/getAllFiles.js';

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

    const checkUpdate = async (): Promise<void> => {
      // Prevent multiple simultaneous checks
      if (updateChecker.isUpdating) return;
      
      // Rate limiting: don't check more than once per hour
      const now = Date.now();
      if (now - updateChecker.lastCheckTime < 60 * 60 * 1000) return;
      
      updateChecker.lastCheckTime = now;

      try {
        const releasesResponse = await fetch(
          'https://api.github.com/repos/SanukaE/BotBuilder/releases/latest'
        );
        
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
              console.log(`[System] BotBuilder has been updated to version ${latestVersion}.`);
              console.log('[System] Please restart the bot to apply changes.');
              
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
        console.log(`[System] Failed to check for updates: ${error.message}`);
      }
    };

    // List of files/directories to skip during updates (preserve user data and build artifacts)
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
      'temp-update'
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
        // Clean up any existing temp directory
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }

        // Create temp directory
        fs.mkdirSync(tempDir, { recursive: true });

        // Download the release zip
        console.log('[System] Downloading release archive...');
        await downloadRelease(release.zipball_url, zipPath);

        // Extract the zip
        console.log('[System] Extracting release archive...');
        const extractedDir = await extractRelease(zipPath, tempDir);

        // Update files from extracted release
        console.log('[System] Updating files...');
        await updateFilesFromExtracted(extractedDir);

        // Clean up old files that are no longer needed
        console.log('[System] Cleaning up obsolete files...');
        await cleanupObsoleteFiles(extractedDir);

        console.log('[System] Deleting temp-update...');
        rmSync(tempDir, { recursive: true, force: true });
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
      try {
        const response = await fetch(downloadUrl);

        if (!response.ok) {
          throw new Error(`Failed to download release: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body received');
        }

        const fileStream = createWriteStream(outputPath);
        
        // Convert ReadableStream to Node.js stream for pipeline
        const nodeStream = response.body as any;
        await pipeline(nodeStream, fileStream);
      } catch(err: any) {
        throw new Error(`Failed to download release: ${err.message}`);
      }
    };

    const extractRelease = async (zipPath: string, extractDir: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        let rootDirFound = false;
        let extractedDirName = '';
        
        createReadStream(zipPath)
          .pipe(Extract({ path: extractDir }))
          .on('entry', (entry) => {
            // GitHub releases create a root directory like "SanukaE-BotBuilder-abc1234/"
            if (!rootDirFound && entry.type === 'Directory' && entry.path.includes('-')) {
              extractedDirName = entry.path.replace(/\/$/, '');
              rootDirFound = true;
            }
          })
          .on('close', () => {
            if (extractedDirName) {
              const fullPath = path.join(extractDir, extractedDirName);
              console.log(`[System] Extracted to directory: ${extractedDirName}`);
              resolve(fullPath);
            } else {
              // Fallback: find any directory in the extract location
              try {
                const entries = fs.readdirSync(extractDir, { withFileTypes: true });
                const dir = entries.find(entry => entry.isDirectory());
                if (dir) {
                  console.log(`[System] Using fallback directory: ${dir.name}`);
                  resolve(path.join(extractDir, dir.name));
                } else {
                  reject(new Error('Could not find extracted directory'));
                }
              } catch (error) {
                reject(new Error('Could not find extracted directory'));
              }
            }
          })
          .on('error', reject);
      });
    };

    const shouldSkipUpdate = (filePath: string): boolean => {
      const normalized = path.normalize(filePath).replace(/\\/g, '/');
      return skipUpdateFiles.some(skipFile => {
        const skipNormalized = skipFile.replace(/\\/g, '/');
        return normalized === skipNormalized || 
               normalized.startsWith(skipNormalized + '/') ||
               normalized.includes('/' + skipNormalized + '/') ||
               normalized.endsWith('/' + skipNormalized);
      });
    };

    const updateFilesFromExtracted = async (extractedDir: string): Promise<void> => {
      const extractedDirParts = extractedDir.split(path.sep);
      const extractedDirIndex = extractedDirParts.findIndex(dir => dir.startsWith('SanukaE-BotBuilder'));
      
      if (extractedDirIndex === -1) {
        throw new Error('Could not find BotBuilder directory in extracted files');
      }

      const copyFile = (sourcePath: string, targetPath: string) => {
        try {
          // Ensure target directory exists
          const targetDir = path.dirname(targetPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const releaseFile = readFileSync(sourcePath, 'utf-8');
          console.log(`Updating ${targetPath}`);
          writeFileSync(targetPath, releaseFile);
        } catch (error: any) {
          console.log(`Failed to copy ${sourcePath} to ${targetPath}: ${error.message}`);
        }
      };

      const processDirectory = (dir: string) => {
        try {
          const files = getAllFiles(dir);
          const directories = getAllFiles(dir, true);

          // Process files in current directory
          for (const file of files) {
            const relativePath = path.relative(extractedDir, file);
            const targetPath = path.join(process.cwd(), relativePath);

            if (!shouldSkipUpdate(relativePath) && !shouldSkipUpdate(targetPath)) {
              copyFile(file, targetPath);
            }
          }

          // Process subdirectories
          for (const subDir of directories) {
            const relativePath = path.relative(extractedDir, subDir);
            if (!shouldSkipUpdate(relativePath)) {
              processDirectory(subDir);
            }
          }
        } catch (error: any) {
          console.log(`Error processing directory ${dir}: ${error.message}`);
        }
      };

      processDirectory(extractedDir);
    };

    const cleanupObsoleteFiles = async (extractedDir: string): Promise<void> => {
      const getRelativeFiles = (dirPath: string): string[] => {
        const files: string[] = [];
        
        const traverse = (currentPath: string) => {
          try {
            const items = fs.readdirSync(currentPath, { withFileTypes: true });
            
            for (const item of items) {
              const fullPath = path.join(currentPath, item.name);
              const relativePath = path.relative(dirPath, fullPath);
              
              if (shouldSkipUpdate(relativePath)) continue;
              
              if (item.isFile()) {
                files.push(relativePath);
              } else if (item.isDirectory()) {
                traverse(fullPath);
              }
            }
          } catch (error: any) {
            console.log(`Error reading directory ${currentPath}: ${error.message}`);
          }
        };
        
        traverse(dirPath);
        return files;
      };

      try {
        const extractedFiles = getRelativeFiles(extractedDir);
        const currentFiles = getRelativeFiles(process.cwd());

        // Find files that exist locally but not in the new release
        const obsoleteFiles = currentFiles.filter(file => !extractedFiles.includes(file));

        for (const file of obsoleteFiles) {
          const fullPath = path.join(process.cwd(), file);
          try {
            if (fs.existsSync(fullPath) && !shouldSkipUpdate(file)) {
              console.log(`Deleting obsolete file: ${file}`);
              unlinkSync(fullPath);
            }
          } catch (error: any) {
            console.log(`Failed to delete ${file}: ${error.message}`);
          }
        }
      } catch (error: any) {
        console.log(`Error during cleanup: ${error.message}`);
      }
    };

    // Initial check
    await checkUpdate();

    // Set up interval for periodic checks (every 2 weeks)
    updateChecker.intervalId = setInterval(
      checkUpdate, 
      14 * 24 * 60 * 60 * 1000 // 2 weeks
    );

    // Cleanup on process exit
    const cleanup = () => {
      if (updateChecker.intervalId) {
        clearInterval(updateChecker.intervalId);
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

  } catch (error: any) {
    console.log(
      `[Error] Failed to initialize update checker: ${error.message || error}`
    );
  }
}