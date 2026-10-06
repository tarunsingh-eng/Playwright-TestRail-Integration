import * as dotenv from 'dotenv';
dotenv.config();

// -- Minimal API Clinet

interface TestRailConfig {
    host: string;
    username: string;
    apiKey: string;
    project: string;
}

class TestRailClient {
    private baseUrl: string;
    private authHeader: string;
    
constructor(config: TestRailConfig) {
        this.baseUrl = `${config.host}/index.php?/api/v2/`;
        const credentials = Buffer.from(`${config.username}:${config.apiKey}`).toString('base64');
        this.authHeader = `Basic ${credentials}`;
    }

private async request<T>(endpoint: string, method: string = 'GET', body?: unknown): Promise<T>  {
   
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method,
            headers: {
                'Authorization': this.authHeader,
                'Content-Type': 'application/json',
                'User-Agent': 'TestRail-API-Client/1.0',
            },
            body: body ? JSON.stringify(body) : undefined,
        }); 

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Request failed with status ${response.status}: ${errorText}`);
        }   

        return response.json() as Promise<T>;
    }
public async get<T>(endpoint: string): Promise<T>{
    return this.request<T>(endpoint, 'GET');
}

public async post<T>(endpoint: string, data: unknown): Promise<T> {
        return this.request<T>(endpoint, 'POST', data);
    }

    // Suite Sections

    public async getSections(projectId: number, suiteId: number, name: string, parentId?: number,
    ): Promise<{id: number; name: string }> {
        return this.post(`add_section/${projectId}`, {
            suite_id: suiteId,
            name,
            parent_id: parentId,
        });
    }

public async addCase(
    sectionID: number,
    title: string,
    typeID =1,
): Promise<{id: number; title: string}> {
    return this.post(`add_case/${sectionID}`, {
        title,
        type_id: typeID,
    });
}


// Run Lifecycle

public async updateRun(
    runId: number,
    assignedToId?: number,
    description?: string,
): Promise<{id: number; name: string}> {
    return this.post(`update_run/${runId}`, {
        assignedto_id: assignedToId,
        description,
    });
}

// 
public async closeRun(runId: number): Promise<{id: number; name: string}> {
    return this.post(`close_run/${runId}`, {});
}

}


// Helper

function getEnvVariable(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`Missing environment variable: ${name}. Please check your .env file.`);
        process.exit(1);
    }
    return value;
}


function getClient(): TestRailClient {
    return new TestRailClient({
        host: getEnvVariable('TESTRAIL_HOST'),
        username: getEnvVariable('TESTRAIL_USERNAME'),
        apiKey: getEnvVariable('TESTRAIL_API_KEY'),
        project: getEnvVariable('TESTRAIL_PROJECT'),
    });
}

async function createSection(): Promise<void> {
    const client = getClient();
    const projectId = parseInt(getEnvVariable('TESTRAIL_PROJECT_ID'), 10);
    const suiteId = parseInt(getEnvVariable('TESTRAIL_SUITE_ID'), 10);
  
    console.log('Creating top-level section...');

    const login = await client.getSections(projectId, suiteId, 'Login');
    console.log('Login section created:', login);

    const checkout = await client.getSections(projectId, suiteId, 'Checkout');
    console.log('Checkout section created:', checkout);

    const apiHealth = await client.getSections(projectId, suiteId, 'API Health');
    console.log('API Health section created:', apiHealth);

    console.log('\nCreating sub-section under checkout..');

    const cart = await client.getSections(projectId, suiteId, 'Cart', checkout.id);
    console.log('Cart sub-section created:', cart);
    
    const payment = await client.getSections(projectId, suiteId, 'Payment', checkout.id);
    console.log('Payment sub-section created:', payment);

    console.log('\nSection hierarchy created successfully. Open suite in testrail to view the structure.');
    console.log(`Copy the section IDs above - You will need them for the cases step.`);

}

async function createCase(): Promise<void> {
    const client = getClient();

    const loginSectionId = Number(getEnvVariable('TESTRAIL_SECTION_LOGIN_ID'));
    const checkoutSectionId = Number(getEnvVariable('TESTRAIL_SECTION_CHECKOUT_ID'));

    console.log('Adding test casese...');

    const c1 = await client.addCase(loginSectionId, 'Verify login with valid credentials');
    console.log(`Case c${c1.id}: ${c1.title}`);
    
    const c2 = await client.addCase(loginSectionId, 'Verify login with invalid credentials');
    console.log(`Case c${c2.id}: ${c2.title}`);

    const c3 = await client.addCase(checkoutSectionId, 'Verify checkout with valid payment');
    console.log(`Case c${c3.id}: ${c3.title}`);

    const c4 = await client.addCase(checkoutSectionId, 'Verify checkout with invalid payment');
    console.log(`Case c${c4.id}: ${c4.title}`);

    console.log('\nTest cases added successfully. Open suite in testrail to view the cases.');
    console.log(` test.info().annotations.push({ type: 'test_id', value: 'c${c1.id}' });`);

}


async function assignRun(): Promise<void> {
    const client = getClient();
    const runId = Number(getEnvVariable('TESTRAIL_RUN_ID'));
    const assignedToId = Number(getEnvVariable('TESTRAIL_ASSIGNED_TO_ID'));
    const description = 
        `Assigned for v2.1 rlease sign-off.\n` + 
        `Assigned at: ${new Date().toISOString()}\n` +
        `Owner is reponsible for reviewing failures before milestone closes.`;

        console.log(`Assigning Run R${runId} to user ID ${assignedToId} with description:\n${description}`);

        const updated = await client.updateRun(runId, assignedToId, description);
        console.log(`Run R${updated.id} updated successfully.`);
        console.log(' Open the run in TestRail the assigned user name should now appear in the top-right');

}

async function closeRun(): Promise<void> {
    const client = getClient();
    const runId = Number(getEnvVariable('TESTRAIL_RUN_ID'));

    console.log(`Closing Run R${runId}...`);
    console.log(' (TRCLI will not be able to push results into a closed run.)');
    await client.closeRun(runId);

    console.log(`Run R${runId} closed successfully.`);
    console.log(' Open the run in TestRail and you should see the status as "Completed"');
}


const commmand = process.argv[2];

const commands: Record<string, () => Promise<void>> = {
    Sections: createSection,
    cases: createCase,
    assign: assignRun,
    close: closeRun,
};

if (!commmand || !commands[commmand]) {
    console.error(`Invalid command. Usage: ts-node run-lifecycle.ts <command>`);
    console.error(`Available commands: ${Object.keys(commands).join(', ')}`);
    process.exit(1);
}   

commands[commmand]().catch((error) => {
    console.error('Error executing command:', error);
    process.exit(1);
});
