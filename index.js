import 'dotenv/config';
import axios from 'axios';

const baseUrl = 'https://gateway-run.bls.dev/api/v1';
const ipCheckUrl = 'https://api.ipify.org?format=json';
const nodeId = process.env.NODE_ID;
const authToken = process.env.AUTH_TOKEN;
const extensionVersion = '0.1.7';
const PING_INTERVAL = 10000; // back to 1 minute
const LOG_PREFIX = '[Bless Network]';

// Better headers simulation
const defaultHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Authorization': `Bearer ${authToken}`,
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
    'Pragma': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-Extension-Version': extensionVersion,
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
};

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
        const response = await axios.get(ipCheckUrl);
        if (response.status !== 200) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.data.ip;
    } catch (error) {
        console.error('Failed to fetch IP address:', error.message);
        return 'unknown';
    }
}

// Modified makeRequest function
async function makeRequest(url, options = {}) {
    try {
        const response = await axios({
            url,
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            },
            validateStatus: false // Handle HTTP errors manually
        });

        if (response.status !== 200) {
            throw new Error(`HTTP Error ${response.status}: ${response.data}`);
        }

        return response.data;
    } catch (error) {
        console.error(`${LOG_PREFIX} Request failed:`, error.message);
        throw error;
    }
}

// Add delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
            data: {
                ipAddress,
                hardwareInfo,
                extensionVersion
            }
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
            data: {
                ipAddress: sessionData.ipAddress,
                hardwareInfo: sessionData.hardwareInfo,
                extensionVersion,
                sessionId: currentSession._id
            }
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

// Modified main function
async function main() {
    try {
        // Initial delay to avoid immediate requests
        await delay(2000);

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
                // Random delay between 1-5 seconds before each ping
                await delay(1000 + Math.random() * 4000);

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
                await delay(5000); // Wait 5 seconds on error
            }
        }, PING_INTERVAL);

        // Log successful startup
        console.log(`${LOG_PREFIX} Node running successfully`);
        console.log(`${LOG_PREFIX} IP Address: ${ipAddress}`);
        console.log(`${LOG_PREFIX} Node ID: ${nodeId}`);
        console.log(`${LOG_PREFIX} Version: ${extensionVersion}`);

    } catch (error) {
        console.error(`${LOG_PREFIX} Fatal Error:`, error.message);
        await delay(30000);
        process.exit(1);
    }
}

// Add cleanup on exit
process.on('SIGINT', async () => {
    console.log(`\n${LOG_PREFIX} Shutting down...`);
    if (currentSession) {
        try {
            await makeRequest(`${baseUrl}/nodes/${nodeId}/stop-session`, {
                method: 'POST',
                data: { sessionId: currentSession._id }
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