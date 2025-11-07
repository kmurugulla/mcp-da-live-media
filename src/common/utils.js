import { USER_AGENT, ADMIN_API_URL } from "./global.js";

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    try {
      return await response.json();
    } catch (error) {
      // empty body or invalid JSON
      return {};
    }
  }
  return response.text();
}

export async function daAdminRequest(
  url,
  options = {}
) {
  const headers = {
    "User-Agent": USER_AGENT,
    ...options.headers,
  };

  if (process.env.DA_ADMIN_API_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.DA_ADMIN_API_TOKEN}`;
  }

  const init = {
    method: options.method || "GET",
    body: options.body || undefined,
  };

  if (options.body instanceof FormData) {
    delete headers["User-Agent"];
    init.headers = {
      "Authorization": headers["Authorization"]
    };
  } else {
    init.headers = headers;
  }

  const response = await fetch(url, init);

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    const errorMessage = typeof responseBody === 'string' 
      ? responseBody 
      : JSON.stringify(responseBody);
    
    const errorDetails = {
      status: response.status,
      statusText: response.statusText,
      url,
      method: init.method,
      responseBody
    };
    
    throw new Error(`API ${response.status} ${response.statusText}: ${errorMessage} | Details: ${JSON.stringify(errorDetails)}`);
  }

  return responseBody;
}

export function daAdminResponseFormat(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function formatURL(api, org, repo, path, ext) {
  return `${ADMIN_API_URL}/${api}/${org}/${repo}/${path.startsWith("/") ? path.slice(1) : path}${ext ? `.${ext}` : ""  }`;
}

export async function uploadHTML(url, htmlContent) {
  const body = new FormData();
  const blob = new Blob([htmlContent], { type: 'text/html' });
  body.set('data', blob);
  return daAdminRequest(url, { method: 'POST', body });
}

export async function uploadJSON(url, jsonData) {
  const body = new FormData();
  const blob = new Blob([JSON.stringify(jsonData)], { type: 'application/json' });
  body.set('data', blob);
  return daAdminRequest(url, { method: 'POST', body });
}
