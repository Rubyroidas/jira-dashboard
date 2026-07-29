import { JiraError, type Config, type CurrentUser } from '../types';

const REQUEST_TIMEOUT_MS = 20_000;

/** Thin authenticated wrapper around the Jira Cloud REST API v3. */
export class JiraClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(config: Config) {
    this.baseUrl = config.baseUrl;
    this.authHeader = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`;
  }

  /** Browser URL for an issue, for display in the preview panel. */
  issueUrl(key: string): string {
    return `${this.baseUrl}/browse/${key}`;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }
    return this.request<T>('GET', url.toString());
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', `${this.baseUrl}${path}`, body);
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: this.authHeader,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw asNetworkError(cause, this.baseUrl);
    }

    if (!response.ok) {
      throw await asHttpError(response, url);
    }

    return (await response.json()) as T;
  }

  /** Identify the caller; doubles as the credential check at startup. */
  async myself(): Promise<CurrentUser> {
    const me = await this.get<{ accountId: string; displayName: string }>('/rest/api/3/myself');
    return { accountId: me.accountId, displayName: me.displayName };
  }
}

function asNetworkError(cause: unknown, baseUrl: string): JiraError {
  const name = cause instanceof Error ? cause.name : '';
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new JiraError('Jira did not respond within 20s.', [
      'Check your network connection or VPN, then press r to retry.',
    ]);
  }
  return new JiraError(`Could not reach ${baseUrl}.`, [
    cause instanceof Error ? cause.message : String(cause),
    'Verify JIRA_BASE_URL points at your Atlassian site.',
  ]);
}

async function asHttpError(response: Response, url: string): Promise<JiraError> {
  const detail = await readErrorDetail(response);

  switch (response.status) {
    case 401:
      return new JiraError('Jira rejected your credentials (401).', [
        'JIRA_EMAIL must be your Atlassian account email and JIRA_API_TOKEN an API token',
        '(not your password). Tokens: https://id.atlassian.com/manage-profile/security/api-tokens',
      ]);
    case 403:
      return new JiraError('Jira denied access (403).', [
        detail || 'Your account may lack permission for this project.',
      ]);
    case 400:
      return new JiraError('Jira rejected the request (400).', [
        detail || 'The JQL query may be invalid for this site.',
        'Adjust "issuesJql" in your config file.',
      ]);
    case 429:
      return new JiraError('Jira rate-limited this client (429).', [
        'Wait a moment, then press r to retry.',
      ]);
    default:
      return new JiraError(`Jira returned ${response.status} for ${new URL(url).pathname}.`, [
        detail || response.statusText,
      ]);
  }
}

/** Jira reports failures as `errorMessages` and/or a field-keyed `errors` map. */
async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null) return '';
    const { errorMessages, errors } = body as {
      errorMessages?: unknown;
      errors?: Record<string, unknown>;
    };

    const parts: string[] = [];
    if (Array.isArray(errorMessages)) parts.push(...errorMessages.map(String));
    if (errors && typeof errors === 'object') {
      parts.push(...Object.entries(errors).map(([k, v]) => `${k}: ${String(v)}`));
    }
    return parts.join('; ');
  } catch {
    return '';
  }
}
