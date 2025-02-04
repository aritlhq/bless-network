import 'dotenv/config';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fs from 'fs';
import readline from 'readline';
import { displayBanner } from './banner.js';

const baseUrl = 'https://gateway-run.bls.dev/api/v1';
const ipCheckUrl = 'https://api.ipify.org?format=json';
const nodeId = process.env.NODE_ID;
const authToken = process.env.AUTH_TOKEN;
const extensionVersion = '0.1.7';
const PING_INTERVAL = 10000; // back to 1 minute
const LOG_PREFIX = '[Bless Network]';

// Display the banner
displayBanner();

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

// Read proxies from file
const proxies = [];
const fileStream = fs.createReadStream('proxies.txt');
const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
});

rl.on('line', (line) => {
    const [host, port, username, password] = line.split(':');
    proxies.push({ host, port, username, password });
});

rl.on('close', () => {
    if (proxies.length === 0) {
        console.error(`${LOG_PREFIX} No proxies found in proxies.txt`);
        process.exit(1);
    }
    main();
});

// Function to get a random proxy
function getRandomProxy() {
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
}

// Create axios instance with proxy agent
const api = axios.create({
    timeout: 30000,
    validateStatus: false
});

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
        // Using different IP check service that works with proxies
        const response = await api.get('https://api.myip.com');
        if (response.status !== 200) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.data.ip;
    } catch (error) {
        console.error('Failed to fetch IP address:', error.message);
        return 'unknown';
    }
}

// Modified makeRequest function to use random proxy
async function makeRequest(url, options = {}) {
    try {
        const proxyUrl = getRandomProxy();
        const httpsAgent = new HttpsProxyAgent(proxyUrl);
        const response = await api({
            url,
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            },
            httpsAgent
        });

        if (response.status !== 200) {
            throw new Error(`HTTP Error ${response.status}: ${JSON.stringify(response.data)}`);
        }

        return response.data;
    } catch (error) {
        console.error(`${LOG_PREFIX} Request failed:`, error.message);
        // Add delay on error
        await delay(5000);
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

// Run the main function after proxies are loaded
// main(); // Remove this line, as main() will be called after proxies are loaded