export interface TestRailConfig {
    host: string;
    username: string;
    apiKey: string;
    projectName?: string;
    milestoneId?: string;
}

export interface TestRailResultPayload {
    case_id: number;
    status_id: number;
    comment?: string;
    elapsed?: string;
    defects?: string;
    version?: string;
}

export class TestRailAPIClient {
    private baseURL: string;
    private authHeader: string;

    constructor(private config: TestRailConfig) {
        this.baseURL = `${config.host}/index.php?/api/v2`;

        const credentials = Buffer
            .from(`${config.username}:${config.apiKey}`)
            .toString('base64');

        this.authHeader = `Basic ${credentials}`;
    }

    private async request<T>(
        endpoint: string,
        method: string = 'GET',
        body?: unknown
    ): Promise<T> {
        const url = `${this.baseURL}/${endpoint.replace(/^\/+/, '')}`;

        const headers = {
            Authorization: this.authHeader,
            'Content-Type': 'application/json',
        };

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorText = await response.text();

            throw new Error(
                `TestRail API Error ${response.status}: ${errorText}`
            );
        }

        return response.json() as Promise<T>;
    }

    private async post<T>(
        endpoint: string,
        body: unknown
    ): Promise<T> {
        return this.request<T>(
            endpoint,
            'POST',
            body
        );
    }

    public async addRun(
        projectId: number,
        name: string,
        description?: string,
        caseIds?: number[]
    ): Promise<{ id: number; name: string }> {
        return this.post<{ id: number; name: string }>(
            `add_run/${projectId}`,
            {
                name,
                description,
                include_all: caseIds ? false : true,
                case_ids: caseIds,
            }
        );
    }

    public async addResultsForCases(
        runId: number,
        results: TestRailResultPayload[]
    ): Promise<unknown> {
        return this.post(
            `add_results_for_cases/${runId}`,
            {
                results,
            }
        );
    }
}