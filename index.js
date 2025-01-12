import fetch from 'node-fetch';
import 'dotenv/config'


const baseUrl = 'https://gateway-run.bls.dev/api/v1';
const ipCheckUrl = 'https://api.ipify.org?format=json';
const nodeId = process.env.NODE_ID;
const authToken = process.env.AUTH_TOKEN;
const extensionVersion = '0.1.7';

// Add new constants for logging and timing
const PING_INTERVAL = 5000; // 1 minute in milliseconds
const LOG_PREFIX = '[Bless Network]';

// Validate environment variables
if (!process.env.NODE_ID || !process.env.AUTH_TOKEN) {
    console.error(`${LOG_PREFIX} Error: Missing required environment variables`);
    process.exit(1);
}

// Add session tracking
let currentSession = null;
let lastPingTime = null;

// Function to get IP address with better error handling
async function getIpAddress() {
    try {
        const response = await fetch(ipCheckUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Failed to fetch IP address:', error.message);
        return 'unknown';
    }
}

// Add additional headers for VPS environment
const defaultHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.AUTH_TOKEN}`,
    'X-Extension-Version': extensionVersion,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://gateway-run.bls.dev',
    'Referer': 'https://gateway-run.bls.dev/'
};

// Function to make authenticated request
async function makeRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });

    // Enhanced error handling
    if (!response.ok) {
        const text = await response.text();
        console.error(`${LOG_PREFIX} Full response:`, {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            body: text.slice(0, 500)
        });
        
        try {
            const errorJson = JSON.parse(text);
            throw new Error(`API Error: ${errorJson.message || text}`);
        } catch (e) {
            throw new Error(`HTTP Error ${response.status}: ${text.slice(0, 100)}`);
        }
    }

    try {
        return await response.json();
    } catch (error) {
        console.error(`${LOG_PREFIX} Error parsing response:`, error);
        throw new Error('Invalid JSON response');
    }
}

// Function to start session with proper body
async function startSession(nodeId) {
    try {
        const ipAddress = await getIpAddress();
        const hardwareInfo = {
            platform: process.platform,
            arch: process.arch,
            version: process.version
        };

        return await makeRequest(`${baseUrl}/nodes/${nodeId}/start-session`, {
            method: 'POST',
            body: JSON.stringify({
                ipAddress,
                hardwareInfo,
                extensionVersion
            })
        });
    } catch (error) {
        console.error('Error starting session:', error.message);
        return null;
    }
}

// Function to send ping with proper body
async function sendPing(nodeId, sessionData) {
    try {
        return await makeRequest(`${baseUrl}/nodes/${nodeId}/ping`, {
            method: 'POST',
            body: JSON.stringify({
                ipAddress: sessionData.ipAddress,
                hardwareInfo: sessionData.hardwareInfo,
                extensionVersion,
                sessionId: currentSession._id
            })
        });
    } catch (error) {
        console.error('Error sending ping:', error.message);
        return null;
    }
}

// Function to format date
function formatDate(date) {
    return date.toISOString().replace('T', ' ').slice(0, -5);
}

// Enhanced main function
async function main() {
    try {
        // Get initial node info
        const ipAddress = await getIpAddress();
        console.log('IP Address:', ipAddress);

        // Get hardware info
        const hardwareInfo = {
            platform: process.platform,
            arch: process.arch,
            version: process.version
        };

        // Get node data - changed to use query parameters instead of body
        const nodeData = await makeRequest(`${baseUrl}/nodes/${nodeId}`, {
            method: 'GET',
            headers: {
                'X-IP-Address': ipAddress,
                'X-Hardware-Info': JSON.stringify(hardwareInfo),
                'X-Extension-Version': extensionVersion
            }
        });
        
        console.log('Initial Node Data:', nodeData);

        // Start session with complete data
        currentSession = await startSession(nodeId);
        if (!currentSession) {
            throw new Error('Failed to start session');
        }
        console.log(`${LOG_PREFIX} Session Started at ${formatDate(new Date())}`);
        console.log(`${LOG_PREFIX} Session ID: ${currentSession._id}`);

        // Setup periodic ping with complete data and better logging
        setInterval(async () => {
            try {
                const currentIp = await getIpAddress();
                const pingResult = await sendPing(nodeId, {
                    ipAddress: currentIp,
                    hardwareInfo,
                    extensionVersion,
                    sessionId: currentSession._id
                });

                if (pingResult) {
                    lastPingTime = new Date();
                    console.log(`${LOG_PREFIX} Ping successful at ${formatDate(lastPingTime)}`);
                    console.log(`${LOG_PREFIX} Current rewards: ${pingResult.totalReward || 0}`);
                }
            } catch (pingError) {
                console.error(`${LOG_PREFIX} Ping failed:`, pingError.message);
            }
        }, PING_INTERVAL);

        // Log successful startup
        console.log(`${LOG_PREFIX} Node running successfully`);
        console.log(`${LOG_PREFIX} IP Address: ${ipAddress}`);
        console.log(`${LOG_PREFIX} Node ID: ${nodeId}`);
        console.log(`${LOG_PREFIX} Version: ${extensionVersion}`);

    } catch (error) {
        console.error(`${LOG_PREFIX} Fatal Error:`, error.message);
        console.error(`${LOG_PREFIX} Stack:`, error.stack);
        // Wait 30 seconds before exiting to prevent rapid restarts
        await new Promise(resolve => setTimeout(resolve, 30000));
        process.exit(1);
    }
}

// Add graceful shutdown
process.on('SIGINT', async () => {
    console.log(`\n${LOG_PREFIX} Shutting down...`);
    if (currentSession) {
        try {
            await makeRequest(`${baseUrl}/nodes/${nodeId}/stop-session`, {
                method: 'POST',
                body: JSON.stringify({ sessionId: currentSession._id })
            });
            console.log(`${LOG_PREFIX} Session ended successfully`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error ending session:`, error.message);
        }
    }
    process.exit(0);
});

// Run the main function
main();