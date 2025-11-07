// src/operations/config.js

import { z } from 'zod';
import { daAdminRequest, formatURL } from '../common/utils.js';
import { createMultiSheetJSON, parseMultiSheetJSON, addEntry, entryExists } from '../common/library-cfg-utils.js';

const GetConfigSchema = z.object({
  org: z.string().describe('The organization name'),
  repo: z.string().describe('The repository/site name')
});

const GetLibrarySheetSchema = z.object({
  org: z.string().describe('The organization name'),
  repo: z.string().describe('The repository/site name')
});

const RegisterLibraryTypeSchema = z.object({
  org: z.string().describe('The organization name'),
  repo: z.string().describe('The repository/site name'),
  libraryType: z.string().describe('Type of library entry (e.g., "Blocks", "Templates", "Icons")'),
  configPath: z.string().describe('Full URL to the library config file (e.g., "https://content.da.live/org/repo/library/blocks.json")')
});

const CheckRegistrationSchema = z.object({
  org: z.string().describe('The organization name'),
  repo: z.string().describe('The repository/site name'),
  libraryType: z.string().describe('Type of library entry to check (e.g., "Blocks", "Templates")')
});

function buildConfigUrl(org, repo) {
  return formatURL('config', org, repo, '', '').replace(/\/$/, '');
}

async function uploadConfig(org, repo, configJSON) {
  const url = buildConfigUrl(org, repo);
  const formData = new FormData();
  formData.append('config', JSON.stringify(configJSON));

  return daAdminRequest(url, {
    method: 'PUT',
    body: formData
  });
}

async function getSiteConfig(org, repo) {
  try {
    const url = buildConfigUrl(org, repo);
    return await daAdminRequest(url);
  } catch (error) {
    throw new Error(`Failed to get site config: ${error.message}`);
  }
}

async function getLibrarySheet(org, repo) {
  try {
    const config = await getSiteConfig(org, repo);
    return config?.library || null;
  } catch {
    return null;
  }
}

function ensureLibraryColumns(newEntry, existingEntries) {
  if (existingEntries.length === 0) return newEntry;

  const firstEntry = existingEntries[0];
  const enrichedEntry = { ...newEntry };

  for (const key of Object.keys(firstEntry)) {
    if (!(key in enrichedEntry)) {
      enrichedEntry[key] = '';
    }
  }

  return enrichedEntry;
}

function createLibraryEntry(libraryType, configPath, existingEntries) {
  const baseEntry = {
    title: libraryType,
    path: configPath
  };
  
  return ensureLibraryColumns(baseEntry, existingEntries);
}

function convertToMultiSheet(config) {
  const existingDataSheet = {
    total: config.total || 0,
    data: config.data || []
  };

  if (config[':colWidths']) {
    existingDataSheet[':colWidths'] = config[':colWidths'];
  }

  const librarySheet = {
    total: 0,
    limit: 0,
    offset: 0,
    data: []
  };

  return {
    newConfig: createMultiSheetJSON({
      data: existingDataSheet,
      library: librarySheet
    }),
    librarySheet,
    preservedRows: existingDataSheet.data.length
  };
}

function ensureLibrarySheet(config) {
  const configType = config[':type'];

  if (configType === 'sheet') {
    return convertToMultiSheet(config);
  }

  if (configType === 'multi-sheet') {
    if (config.library) {
      return {
        newConfig: { ...config },
        librarySheet: config.library,
        preservedRows: 0,
        sheetExisted: true
      };
    }

    const sheets = parseMultiSheetJSON(config);
    const librarySheet = {
      total: 0,
      limit: 0,
      offset: 0,
      data: []
    };
    sheets.library = librarySheet;

    return {
      newConfig: createMultiSheetJSON(sheets),
      librarySheet,
      preservedRows: 0
    };
  }

  const librarySheet = {
    total: 0,
    limit: 0,
    offset: 0,
    data: []
  };

  return {
    newConfig: createMultiSheetJSON({ library: librarySheet }),
    librarySheet,
    preservedRows: 0
  };
}

async function checkLibraryRegistration(org, repo, libraryType) {
  try {
    const librarySheet = await getLibrarySheet(org, repo);

    if (!librarySheet?.data) {
      return { 
        registered: false, 
        configPath: null,
        reason: 'Library sheet does not exist or has no data'
      };
    }

    const entry = librarySheet.data.find(item => item.title === libraryType);

    if (entry) {
      return { 
        registered: true, 
        configPath: entry.path,
        totalLibraryEntries: librarySheet.data.length
      };
    }

    return { 
      registered: false, 
      configPath: null,
      reason: `'${libraryType}' not found in library sheet`,
      availableTypes: librarySheet.data.map(item => item.title)
    };
  } catch (error) {
    return { 
      registered: false, 
      configPath: null,
      error: error.message
    };
  }
}

async function registerLibraryType(org, repo, libraryType, configPath) {
  try {
    const config = await getSiteConfig(org, repo);
    const { newConfig, librarySheet, preservedRows, sheetExisted } = ensureLibrarySheet(config);

    const existingIndex = librarySheet.data.findIndex(item => item.title === libraryType);
    const existed = existingIndex >= 0;

    if (existed) {
      librarySheet.data[existingIndex].path = configPath;
    } else {
      const newEntry = createLibraryEntry(libraryType, configPath, librarySheet.data);
      librarySheet.data.push(newEntry);
    }

    librarySheet.total = librarySheet.data.length;
    librarySheet.limit = librarySheet.data.length;

    await uploadConfig(org, repo, newConfig);

    return {
      registered: true,
      existed,
      createdSheet: !sheetExisted,
      convertedToMultiSheet: config[':type'] === 'sheet',
      libraryEntryCount: librarySheet.total,
      error: null
    };
  } catch (error) {
    return {
      registered: false,
      existed: false,
      createdSheet: false,
      error: error.message
    };
  }
}

export { registerLibraryType };

export const tools = [
  {
    name: 'da_config_get',
    description: 'Get site-level configuration from org/repo/config.json',
    schema: GetConfigSchema,
    handler: async (args) => {
      const config = await getSiteConfig(args.org, args.repo);
      return {
        org: args.org,
        repo: args.repo,
        config
      };
    }
  },
  {
    name: 'da_config_get_library_sheet',
    description: 'Get the library sheet from site configuration',
    schema: GetLibrarySheetSchema,
    handler: async (args) => {
      const librarySheet = await getLibrarySheet(args.org, args.repo);
      return {
        org: args.org,
        repo: args.repo,
        exists: !!librarySheet,
        librarySheet
      };
    }
  },
  {
    name: 'da_config_check_registration',
    description: 'Check if a library type (Blocks, Templates, etc.) is registered in site config library sheet',
    schema: CheckRegistrationSchema,
    handler: async (args) => {
      const result = await checkLibraryRegistration(args.org, args.repo, args.libraryType);
      return {
        org: args.org,
        repo: args.repo,
        libraryType: args.libraryType,
        ...result
      };
    }
  },
  {
    name: 'da_config_register_library_type',
    description: 'Register a library type in the site config library sheet. Creates the library sheet if it doesn\'t exist. Uses title/path columns.',
    schema: RegisterLibraryTypeSchema,
    handler: async (args) => {
      const result = await registerLibraryType(args.org, args.repo, args.libraryType, args.configPath);
      return {
        org: args.org,
        repo: args.repo,
        libraryType: args.libraryType,
        configPath: args.configPath,
        ...result
      };
    }
  }
];
