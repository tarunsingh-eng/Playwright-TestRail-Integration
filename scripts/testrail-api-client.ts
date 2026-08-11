export interface TestRailConfig {
  host: string;
  username: string;
  apiKey: string;
}

export interface TestRailResultPayload {
  case_id: number;
  status_id: number; // 1: Passed, 2: Blocked, 4: Retest, 5: Failed
  comment?: string;
  elapsed?: string; // e.g. "3s", "1m 15s"
  version?: string;
  defects?: string;
}

export class TestRailApiClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: TestRailConfig) {
    this.baseUrl = config.host.replace(/\/+$/, '') + '/index.php?/api/v2';
    const credentials = Buffer.from(`${config.username}:${config.apiKey}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  private async request<T>(endpoint: string, method: string = 'GET', body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
    const headers = {
      'Authorization': this.authHeader,
      'Content-Type': 'application/json',
      'User-Agent': 'TestRail-Automation-Client/1.0'
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TestRail API Error [HTTP ${response.status}]: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  public async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, 'GET');
  }

  public async post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, 'POST', data);
  }

  public async addRun(projectId: number, name: string, description?: string, caseIds?: number[]) {
    return this.post<{ id: number; name: string }>(`add_run/${projectId}`, {
      name,
      description,
      include_all: caseIds ? false : true,
      case_ids: caseIds
    });
  }

  public async addResultsForCases(runId: number, results: TestRailResultPayload[]) {
    return this.post<unknown[]>(`add_results_for_cases/${runId}`, {
      results
    });
  }
}
