
import { Octokit } from '@octokit/rest';
import { USER_AGENT } from './global.js';

export function createGitHubClient() {
  const config = { userAgent: USER_AGENT };

  if (process.env.GITHUB_TOKEN) {
    config.auth = process.env.GITHUB_TOKEN;
  }

  return new Octokit(config);
}

export async function getRateLimit(octokit) {
  try {
    const response = await octokit.rateLimit.get();
    return response.data.rate;
  } catch {
    return null;
  }
}

export async function listContents(octokit, owner, repo, path, ref = 'main') {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref
    });

    return Array.isArray(response.data) ? response.data : [response.data];
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`Path '${path}' not found in ${owner}/${repo} (branch: ${ref})`);
    }
    throw new Error(`Failed to list contents: ${error.message}`);
  }
}

export async function getFileContent(octokit, owner, repo, path, ref = 'main') {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref
    });

    if (!response.data.content) {
      throw new Error('No content in response');
    }

    return Buffer.from(response.data.content, 'base64').toString('utf-8');
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`File '${path}' not found in ${owner}/${repo} (branch: ${ref})`);
    }
    throw new Error(`Failed to get file content: ${error.message}`);
  }
}

export async function fileExists(octokit, owner, repo, path, ref = 'main') {
  try {
    await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref
    });
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    }
    throw new Error(`Failed to check file existence: ${error.message}`);
  }
}

export async function listDirectories(octokit, owner, repo, path, ref = 'main') {
  const contents = await listContents(octokit, owner, repo, path, ref);
  return contents.filter(item => item.type === 'dir');
}

export async function listFiles(octokit, owner, repo, path, ref = 'main') {
  const contents = await listContents(octokit, owner, repo, path, ref);
  return contents.filter(item => item.type === 'file');
}

export async function getRepository(octokit, owner, repo) {
  try {
    const response = await octokit.repos.get({
      owner,
      repo
    });
    return response.data;
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`Repository ${owner}/${repo} not found`);
    }
    if (error.status === 401) {
      throw new Error('GitHub authentication failed. Check GITHUB_TOKEN');
    }
    throw new Error(`Failed to get repository: ${error.message}`);
  }
}

export async function getBranch(octokit, owner, repo, branch) {
  try {
    const response = await octokit.repos.getBranch({
      owner,
      repo,
      branch
    });
    return response.data;
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`Branch '${branch}' not found in ${owner}/${repo}`);
    }
    throw new Error(`Failed to get branch: ${error.message}`);
  }
}
