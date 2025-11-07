// src/operations/gh-blocks.js

import { z } from 'zod';
import {
  createGitHubClient,
  listDirectories,
  getFileContent,
  fileExists
} from '../common/gh-utils.js';
import { validateGitHubAccess } from '../common/validation-utils.js';

const ListBlocksSchema = z.object({
  org: z.string().describe('The GitHub organization/owner name'),
  repo: z.string().describe('The GitHub repository name'),
  branch: z.string().optional().default('main').describe('The branch name (default: main)'),
  blocksPath: z.string().optional().default('blocks').describe('Path to blocks folder (default: blocks, e.g., aemedge/blocks)')
});

const GetBlockFilesSchema = z.object({
  org: z.string().describe('The GitHub organization/owner name'),
  repo: z.string().describe('The GitHub repository name'),
  blockName: z.string().describe('The block name (folder name)'),
  branch: z.string().optional().default('main').describe('The branch name (default: main)'),
  blocksPath: z.string().optional().default('blocks').describe('Path to blocks folder (default: blocks, e.g., aemedge/blocks)')
});

function buildBlockFilePath(blocksPath, blockName, fileName) {
  return `${blocksPath}/${blockName}/${fileName}`;
}

async function tryGetFileContent(octokit, org, repo, path, branch) {
  try {
    return await getFileContent(octokit, org, repo, path, branch);
  } catch {
    return null;
  }
}

async function checkBlockFiles(octokit, org, repo, blocksPath, blockName, branch) {
  const [hasJS, hasCSS] = await Promise.all([
    fileExists(octokit, org, repo, buildBlockFilePath(blocksPath, blockName, `${blockName}.js`), branch),
    fileExists(octokit, org, repo, buildBlockFilePath(blocksPath, blockName, `${blockName}.css`), branch)
  ]);

  return {
    name: blockName,
    path: `${blocksPath}/${blockName}`,
    hasJS,
    hasCSS,
    type: 'dir'
  };
}

async function listBlocks(org, repo, branch = 'main', blocksPath = 'blocks') {
  const octokit = createGitHubClient();

  const validation = await validateGitHubAccess(octokit, org, repo, branch);
  if (!validation.accessible) {
    throw new Error(validation.error);
  }

  const directories = await listDirectories(octokit, org, repo, blocksPath, branch);

  const blockPromises = directories.map(dir => 
    checkBlockFiles(octokit, org, repo, blocksPath, dir.name, branch)
  );

  return Promise.all(blockPromises);
}

async function tryGetReadme(octokit, org, repo, blocksPath, blockName, branch) {
  const readmeVariants = ['README.md', 'readme.md', 'README.MD'];
  
  for (const readme of readmeVariants) {
    const content = await tryGetFileContent(
      octokit,
      org,
      repo,
      buildBlockFilePath(blocksPath, blockName, readme),
      branch
    );
    if (content) {
      return content;
    }
  }
  
  return null;
}

async function getBlockFiles(org, repo, blockName, branch = 'main', blocksPath = 'blocks') {
  const octokit = createGitHubClient();

  const validation = await validateGitHubAccess(octokit, org, repo, branch);
  if (!validation.accessible) {
    throw new Error(validation.error);
  }

  const [jsContent, cssContent, readmeContent] = await Promise.all([
    tryGetFileContent(octokit, org, repo, buildBlockFilePath(blocksPath, blockName, `${blockName}.js`), branch),
    tryGetFileContent(octokit, org, repo, buildBlockFilePath(blocksPath, blockName, `${blockName}.css`), branch),
    tryGetReadme(octokit, org, repo, blocksPath, blockName, branch)
  ]);

  return {
    blockName,
    hasJS: !!jsContent,
    hasCSS: !!cssContent,
    hasReadme: !!readmeContent,
    jsContent,
    cssContent,
    readmeContent
  };
}

export const tools = [
  {
    name: 'da_gh_blocks_list',
    description: 'List all blocks from GitHub repository blocks folder. Supports custom paths like aemedge/blocks. Returns block names and whether they have .js/.css files.',
    schema: ListBlocksSchema,
    handler: async (args) => {
      const blocks = await listBlocks(args.org, args.repo, args.branch, args.blocksPath);
      return {
        org: args.org,
        repo: args.repo,
        branch: args.branch,
        blocksPath: args.blocksPath || 'blocks',
        totalBlocks: blocks.length,
        blocks
      };
    }
  },
  {
    name: 'da_gh_blocks_get_files',
    description: 'Get block source files (.js, .css, README) from GitHub repository. Supports custom block paths.',
    schema: GetBlockFilesSchema,
    handler: async (args) => {
      const files = await getBlockFiles(args.org, args.repo, args.blockName, args.branch, args.blocksPath);
      return {
        org: args.org,
        repo: args.repo,
        branch: args.branch,
        blocksPath: args.blocksPath || 'blocks',
        ...files
      };
    }
  }
];
