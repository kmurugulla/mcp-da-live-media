// src/common/library-cfg-utils.js

import { LIBRARY_TYPES, LIBRARY_CONFIG } from './global.js';

const CONTENT_DOMAIN = 'https://content.da.live';

function cleanPath(path) {
  return path.startsWith('/') ? path.slice(1) : path;
}

function createSheetStructure(data) {
  return {
    total: data.length,
    limit: data.length,
    offset: 0,
    data
  };
}

export function buildLibraryPath(type, baseFolder, itemName = null) {
  if (!Object.values(LIBRARY_TYPES).includes(type)) {
    throw new Error(`Unknown library type: ${type}`);
  }
  
  const base = `/${cleanPath(baseFolder)}/${type}`;
  return itemName ? `${base}/${itemName}` : base;
}

export function buildContentUrl(org, repo, path) {
  return `${CONTENT_DOMAIN}/${org}/${repo}/${cleanPath(path)}`;
}

export function getDataSheet(jsonData) {
  if (!jsonData) return null;
  
  return jsonData[':type'] === 'multi-sheet' ? (jsonData.data || null) : jsonData;
}

export function getOptionsSheet(jsonData) {
  return jsonData?.options || null;
}

function createSheet(entries) {
  return {
    ...createSheetStructure(entries),
    ':type': 'sheet'
  };
}

export function createMultiSheetJSON(sheets) {
  const out = {};
  const names = Object.keys(sheets);
  
  for (const name of names) {
    const sheet = sheets[name];
    const rows = sheet.data || [];
    out[name] = createSheetStructure(rows);
  }
  
  out[':version'] = 3;
  out[':names'] = names;
  out[':type'] = 'multi-sheet';
  return out;
}

export function parseMultiSheetJSON(config) {
  const sheets = {};
  const names = config[':names'] || [];
  
  for (const name of names) {
    if (config[name]) {
      sheets[name] = config[name];
    }
  }
  
  return sheets;
}

function createDefaultBlockOptions() {
  return {
    data: [
      { 
        key: 'style', 
        blocks: 'section-metadata', 
        values: 'xxs-spacing | xs-spacing | s-spacing | m-spacing | l-spacing | xl-spacing | xxl-spacing | dark | light | quiet' 
      },
      { 
        key: 'gap', 
        blocks: 'ALL', 
        values: '100 | 200 | 300 | 400 | 500 | 600 | 700 | 800' 
      },
      { 
        key: 'background', 
        blocks: 'section-metadata', 
        values: 'dark-grey=#676767 | light-grey=#EFEFEF | adobe-red=#FF0000 | blue=#0077B6 | green=#00A36C' 
      },
      { 
        key: 'spacing', 
        blocks: 'section-metadata', 
        values: '400 | 500 | 600 | 700 | 800' 
      },
      { 
        key: 'template', 
        blocks: 'metadata', 
        values: 'blog-post | product-page | feature-page' 
      }
    ]
  };
}

export function createLibraryJSON(type, entries, optionsSheet = null) {
  if (!Object.values(LIBRARY_TYPES).includes(type)) {
    throw new Error(`Unknown library type: ${type}`);
  }
  
  const config = LIBRARY_CONFIG[type] || {};
  
  if (config.multiSheet) {
    const sheets = {
      data: { data: entries }
    };
    
    if (optionsSheet) {
      sheets.options = optionsSheet;
    } else if (config.hasOptions) {
      sheets.options = createDefaultBlockOptions();
    }
    
    return createMultiSheetJSON(sheets);
  }
  
  return createSheet(entries);
}

export function addEntry(dataSheet, entry, keyField = 'name') {
  const data = dataSheet?.data || [];
  const existingIndex = data.findIndex(item => item[keyField] === entry[keyField]);
  
  if (existingIndex >= 0) {
    data[existingIndex] = entry;
  } else {
    data.push(entry);
  }
  
  return createSheetStructure(data);
}

export function removeEntry(dataSheet, key, keyField = 'name') {
  const data = (dataSheet?.data || []).filter(item => item[keyField] !== key);
  return createSheetStructure(data);
}

export function entryExists(dataSheet, key, keyField = 'name') {
  return (dataSheet?.data || []).some(item => item[keyField] === key);
}

export function createLibraryConfigValue(org, repo, baseFolder) {
  return `${CONTENT_DOMAIN}/${org}/${repo}/${cleanPath(baseFolder)}/blocks.json`;
}
