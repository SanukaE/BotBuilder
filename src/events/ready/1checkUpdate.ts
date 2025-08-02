import { Client } from 'discord.js';
import localPackage from '../../../package.json' with { type: 'json' };
import fs from "fs";
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';
import { Extract } from 'unzipper';
import { spawn } from 'child_process';
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
    let sourceFilesUpdated = false;

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
              console.log(`[System] BotBuilder has been updated to version ${latestVersion}.`);
              
              // Handle post-update tasks
              if (packageJsonUpdated) {
                console.log('[System] package.json updated. Installing dependencies...');
                try {
                  await runCommand('npm', ['install'], 'Installing dependencies');
                  console.log('[System] Dependencies installed successfully.');
                } catch (error: any) {
                  console.log(`[System] Failed to install dependencies: ${error.message}`);
                  console.log('[System] Please run "npm install" manually.');
                }
              }

              if (sourceFilesUpdated) {
                console.log('[System] Source files updated. Compiling TypeScript...');
                try {
                  await compileTypeScript();
                  console.log('[System] TypeScript compilation completed successfully.');
                  console.log('[System] Update complete! The bot will automatically restart to apply changes.');
                  
                  // Graceful restart
                  setTimeout(() => {
                    console.log('[System] Restarting bot...');
                    process.exit(0); // Exit cleanly, assuming a process manager will restart
                  }, 2000);
                } catch (error: any) {
                  console.log(`[System] TypeScript compilation failed: ${error.message}`);
                  console.log('[System] Please run the build command manually and restart the bot.');
                }
              } else {
                console.log('[System] Please restart the bot to apply changes.');
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
      'backups',
      'temp-update'
    ];

    // Files that should only be updated, never deleted (core application files)
    const coreApplicationFiles = [
      'src',
      'public',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.json',
      'README.md',
      'LICENSE',
      'SECURITY.md',
      'CODE_OF_CONDUCT.md',
      '.env.template',
      'configs.template'
    ];

    const runCommand = (command: string, args: string[], description: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        console.log(`[System] ${description}...`);
        
        const child = spawn(command, args, {
          cwd: process.cwd(),
          stdio: 'pipe'
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (code === 0) {
            console.log(`[System] ${description} completed successfully.`);
            resolve();
          } else {
            console.log(`[System] ${description} failed with exit code ${code}`);
            if (stderr) {
              console.log(`[System] Error output: ${stderr}`);
            }
            reject(new Error(`${description} failed with exit code ${code}`));
          }
        });

        child.on('error', (error) => {
          reject(new Error(`Failed to start ${command}: ${error.message}`));
        });
      });
    };

    const compileTypeScript = async (): Promise<void> => {
      // Check which package manager is being used
      const packageManagers = [
        { name: 'pnpm', lockFile: 'pnpm-lock.yaml', buildCommand: ['pnpm', 'run', 'build'] },
        { name: 'npm', lockFile: 'package-lock.json', buildCommand: ['npm', 'run', 'build'] },
        { name: 'yarn', lockFile: 'yarn.lock', buildCommand: ['yarn', 'build'] }
      ];

      let selectedManager = packageManagers.find(pm => 
        fs.existsSync(path.join(process.cwd(), pm.lockFile))
      );

      if (!selectedManager) {
        // Default to npm if no lock file found
        selectedManager = packageManagers[1];
      }

      console.log(`[System] Using ${selectedManager.name} for build...`);

      // Clean build directory first
      const buildDir = path.join(process.cwd(), 'build');
      if (fs.existsSync(buildDir)) {
        console.log('[System] Cleaning existing build directory...');
        fs.rmSync(buildDir, { recursive: true, force: true });
      }

      // Run the build command
      await runCommand(
        selectedManager.buildCommand[0], 
        selectedManager.buildCommand.slice(1),
        'Building TypeScript'
      );
    };

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
              console.log(`[System] Using fallback directory: ${extractedDirName}`);
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

    const updateFilesFromExtracted = async (extractedDir: string): Promise<void> => {
      const shouldSkipUpdate = (filePath: string): boolean => {
        const normalized = filePath.replace(/\\/g, '/');
        return skipUpdateFiles.some(skipFile => 
          normalized === skipFile || 
          normalized.startsWith(skipFile + '/') ||
          normalized.endsWith('/' + skipFile)
        );
      };

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

      console.log(`[System] Extracted directory: ${extractedDir}`);
      const extractedContents = fs.readdirSync(extractedDir, { withFileTypes: true });
      console.log(`[System] Extracted contents: ${extractedContents.map(e => e.name).join(', ')}`);
      
      const extractedFiles = getAllFiles(extractedDir);
      console.log(`[System] Found ${extractedFiles.length} files to process`);

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
            if (!fs.existsSync(targetPath)) {
              fs.mkdirSync(targetPath, { recursive: true });
              console.log(`[System] Created directory: ${file.relativePath}`);
            }
          } else {
            const parentDir = path.dirname(targetPath);
            if (!fs.existsSync(parentDir)) {
              fs.mkdirSync(parentDir, { recursive: true });
            }

            // Check if file content has changed
            let shouldUpdate = true;
            if (fs.existsSync(targetPath)) {
              try {
                const existingContent = fs.readFileSync(targetPath, 'utf-8');
                const newContent = fs.readFileSync(file.sourcePath, 'utf-8');
                shouldUpdate = existingContent !== newContent;
              } catch (error) {
                // If we can't read as text, compare as binary
                try {
                  const existingContent = fs.readFileSync(targetPath);
                  const newContent = fs.readFileSync(file.sourcePath);
                  shouldUpdate = !existingContent.equals(newContent);
                } catch {
                  shouldUpdate = true; // Default to updating if we can't compare
                }
              }
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

              // Track important file changes
              if (file.relativePath === 'package.json') {
                packageJsonUpdated = true;
              }
              
              if (file.relativePath.startsWith('src/')) {
                sourceFilesUpdated = true;
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
    };

    const cleanupObsoleteFiles = async (extractedDir: string): Promise<void> => {
      const shouldSkipUpdate = (filePath: string): boolean => {
        const normalized = filePath.replace(/\\/g, '/');
        return skipUpdateFiles.some(skipFile => 
          normalized === skipFile || 
          normalized.startsWith(skipFile + '/') ||
          normalized.endsWith('/' + skipFile)
        );
      };

      const isCoreApplicationFile = (filePath: string): boolean => {
        const normalized = filePath.replace(/\\/g, '/');
        return coreApplicationFiles.some(coreFile => 
          normalized === coreFile || 
          normalized.startsWith(coreFile + '/')
        );
      };

      // Get list of files that should exist in the new version
      const getNewReleaseFiles = (dir: string, basePath = ''): Set<string> => {
        const files = new Set<string>();
        
        if (!fs.existsSync(dir)) return files;

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const relPath = path.join(basePath, entry.name).replace(/\\/g, '/');
          
          if (shouldSkipUpdate(relPath)) continue;
          
          files.add(relPath);
          
          if (entry.isDirectory()) {
            const subDir = path.join(dir, entry.name);
            for (const subFile of getNewReleaseFiles(subDir, relPath)) {
              files.add(subFile);
            }
          }
        }
        
        return files;
      };

      // Get files that exist in our current project within core application directories
      const getCurrentCoreFiles = (): Set<string> => {
        const files = new Set<string>();
        
        for (const coreDir of coreApplicationFiles) {
          const fullPath = path.join(process.cwd(), coreDir);
          
          if (fs.existsSync(fullPath)) {
            const stat = fs.lstatSync(fullPath);
            
            if (stat.isDirectory()) {
              // Get all files within this core directory
              const getCoreDirectoryFiles = (dir: string, basePath: string): void => {
                try {
                  const entries = fs.readdirSync(dir, { withFileTypes: true });
                  
                  for (const entry of entries) {
                    const relPath = path.join(basePath, entry.name).replace(/\\/g, '/');
                    
                    if (shouldSkipUpdate(relPath)) continue;
                    
                    files.add(relPath);
                    
                    if (entry.isDirectory()) {
                      getCoreDirectoryFiles(path.join(dir, entry.name), relPath);
                    }
                  }
                } catch (error: any) {
                  console.log(`[System] Error reading core directory ${dir}: ${error.message}`);
                }
              };
              
              getCoreDirectoryFiles(fullPath, coreDir);
            } else {
              // Single file
              if (!shouldSkipUpdate(coreDir)) {
                files.add(coreDir);
              }
            }
          }
        }
        
        return files;
      };

      const newReleaseFiles = getNewReleaseFiles(extractedDir);
      const currentCoreFiles = getCurrentCoreFiles();

      console.log(`[System] Checking for old files to remove...`);
      console.log(`[System] New release contains ${newReleaseFiles.size} files/directories`);
      console.log(`[System] Current core application files: ${currentCoreFiles.size}`);

      // Find core files that exist locally but not in the new release
      const filesToDelete = new Set<string>();
      for (const coreFile of currentCoreFiles) {
        if (!newReleaseFiles.has(coreFile) && isCoreApplicationFile(coreFile)) {
          filesToDelete.add(coreFile);
        }
      }

      console.log(`[System] Found ${filesToDelete.size} files/directories to delete`);

      if (filesToDelete.size === 0) {
        console.log('[System] No obsolete files to remove.');
        return;
      }

      // Sort files by depth (deepest first) to avoid deleting parent directories before children
      const sortedFilesToDelete = Array.from(filesToDelete).sort((a, b) => {
        const depthA = a.split('/').length;
        const depthB = b.split('/').length;
        return depthB - depthA; // Reverse order (deepest first)
      });

      for (const relPath of sortedFilesToDelete) {
        try {
          const absPath = path.join(process.cwd(), relPath);
          
          if (fs.existsSync(absPath)) {
            const stat = fs.lstatSync(absPath);
            
            if (stat.isDirectory()) {
              // Only delete if directory is empty or contains only files that are also being deleted
              try {
                const dirContents = fs.readdirSync(absPath);
                const hasProtectedContents = dirContents.some(item => {
                  const itemPath = path.join(relPath, item).replace(/\\/g, '/');
                  return !filesToDelete.has(itemPath) && !shouldSkipUpdate(itemPath);
                });
                
                if (!hasProtectedContents) {
                  fs.rmSync(absPath, { recursive: true, force: true });
                  console.log(`[System] Deleted old directory: ${relPath}`);
                }
              } catch (error: any) {
                console.log(`[System] Could not check directory contents for ${relPath}: ${error.message}`);
              }
            } else {
              fs.unlinkSync(absPath);
              console.log(`[System] Deleted old file: ${relPath}`);
            }
          }
        } catch (error: any) {
          console.log(`[System] Failed to delete ${relPath}: ${error.message}`);
        }
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