// src/operations/library.js

import { z } from 'zod';
import { getSheetJSON, listSheetItems, uploadSheetJSON } from '../common/sheet-utils.js';
import {
  buildLibraryPath,
  buildContentUrl,
  getDataSheet,
  getOptionsSheet,
  createLibraryJSON,
  addEntry,
  removeEntry,
  entryExists
} from '../common/library-cfg-utils.js';
import { LIBRARY_TYPES } from '../common/global.js';

const ListBlocksSchema = z.object({
  org: z.string().describe('The organization name'),
  repo: z.string().describe('The repository name'),
  baseFolder: z.string().optional().default('library').describe('Base folder for library (default: library)')
});

const AddBlockSchema = z.object({
  org: z.string().describe('The organization name'),
  repo: z.string().describe('The repository name'),
  blockName: z.string().describe('The block name'),
  displayName: z.string().optional().describe('Optional display name (defaults to blockName)'),
  baseFolder: z.string().optional().default('library').describe('Base folder for library (default: library)')
});

const RemoveBlockSchema = z.object({
  org: z.string().describe('The organization name'),
  repo: z.string().describe('The repository name'),
  blockName: z.string().describe('The block name to remove'),
  baseFolder: z.string().optional().default('library').describe('Base folder for library (default: library)')
});

const CreateBlocksJSONSchema = z.object({
  org: z.string().describe('The organization name'),
  repo: z.string().describe('The repository name'),
  blocks: z.array(z.object({
    name: z.string(),
    path: z.string()
  })).describe('Array of block entries'),
  baseFolder: z.string().optional().default('library').describe('Base folder for library (default: library)')
});

function getBlocksPath(baseFolder) {
  return buildLibraryPath(LIBRARY_TYPES.BLOCKS, baseFolder);
}

function createBlockEntry(blockName, displayName, baseFolder, org, repo) {
  const blockPath = buildContentUrl(org, repo, `${baseFolder}/blocks/${blockName}`);
  return {
    name: displayName || blockName.charAt(0).toUpperCase() + blockName.slice(1),
    path: blockPath
  };
}

function buildResponse(args, additional = {}) {
  return {
    org: args.org,
    repo: args.repo,
    baseFolder: args.baseFolder,
    ...additional
  };
}

async function addBlock(org, repo, blockName, displayName = null, baseFolder = 'library') {
  const path = getBlocksPath(baseFolder);
  const blocksJSON = await getSheetJSON(org, repo, path);

  const dataSheet = blocksJSON ? getDataSheet(blocksJSON) : null;
  const optionsSheet = blocksJSON ? getOptionsSheet(blocksJSON) : null;

  const entry = createBlockEntry(blockName, displayName, baseFolder, org, repo);
  const existed = dataSheet ? entryExists(dataSheet, entry.name) : false;
  const updatedDataSheet = addEntry(dataSheet, entry);

  const newBlocksJSON = createLibraryJSON(LIBRARY_TYPES.BLOCKS, updatedDataSheet.data, optionsSheet);
  await uploadSheetJSON(org, repo, path, newBlocksJSON);

  return {
    added: true,
    existed,
    optionsPreserved: !!optionsSheet,
    path,
    entry
  };
}

async function removeBlock(org, repo, blockName, baseFolder = 'library') {
  const path = getBlocksPath(baseFolder);
  const blocksJSON = await getSheetJSON(org, repo, path);

  if (!blocksJSON) {
    return {
      removed: false,
      error: 'blocks.json not found'
    };
  }

  const dataSheet = getDataSheet(blocksJSON);
  const optionsSheet = getOptionsSheet(blocksJSON);

  if (!dataSheet) {
    return {
      removed: false,
      error: 'Data sheet not found in blocks.json'
    };
  }

  const updatedDataSheet = removeEntry(dataSheet, blockName);
  const newBlocksJSON = createLibraryJSON(LIBRARY_TYPES.BLOCKS, updatedDataSheet.data, optionsSheet);
  await uploadSheetJSON(org, repo, path, newBlocksJSON);

  return {
    removed: true,
    optionsPreserved: !!optionsSheet,
    path
  };
}

async function createBlocksJSONFile(org, repo, blocks, baseFolder = 'library') {
  const path = getBlocksPath(baseFolder);
  const blocksJSON = createLibraryJSON(LIBRARY_TYPES.BLOCKS, blocks, null);

  await uploadSheetJSON(org, repo, path, blocksJSON);

  return {
    created: true,
    path,
    totalBlocks: blocks.length
  };
}

export const tools = [
  {
    name: 'da_library_blocks_list',
    description: 'List all blocks from blocks.json in the library',
    schema: ListBlocksSchema,
    handler: async (args) => {
      const blocks = await listSheetItems(args.org, args.repo, getBlocksPath(args.baseFolder));
      return buildResponse(args, {
        totalBlocks: blocks.length,
        blocks
      });
    }
  },
  {
    name: 'da_library_blocks_add',
    description: 'Add or update a block entry in blocks.json. Preserves the options sheet.',
    schema: AddBlockSchema,
    handler: async (args) => {
      const result = await addBlock(
        args.org,
        args.repo,
        args.blockName,
        args.displayName,
        args.baseFolder
      );
      return buildResponse(args, { blockName: args.blockName, ...result });
    }
  },
  {
    name: 'da_library_blocks_remove',
    description: 'Remove a block entry from blocks.json. Preserves the options sheet.',
    schema: RemoveBlockSchema,
    handler: async (args) => {
      const result = await removeBlock(
        args.org,
        args.repo,
        args.blockName,
        args.baseFolder
      );
      return buildResponse(args, { blockName: args.blockName, ...result });
    }
  },
  {
    name: 'da_library_blocks_create',
    description: 'Create a new blocks.json file with the provided block entries',
    schema: CreateBlocksJSONSchema,
    handler: async (args) => {
      const result = await createBlocksJSONFile(
        args.org,
        args.repo,
        args.blocks,
        args.baseFolder
      );
      return buildResponse(args, result);
    }
  }
];
