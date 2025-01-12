# Bless Network Node

A Node.js implementation for running Bless Network nodes with proxy support.

## Prerequisites

- Node.js v16 or higher
- npm (Node Package Manager)
- A valid Bless Network account and authentication token
- Access to an Indonesian proxy (optional but recommended)

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/bless-network.git
cd bless-network
```

2. Install dependencies:
```bash
npm install
```

3. Configure your environment:
   - Copy `.env-example` to `.env`
   - Fill in your credentials:
     - `NODE_ID`: Your Bless Network node identifier
     - `AUTH_TOKEN`: Your authentication token
     - `PROXY_HOST`: Indonesian proxy host (optional)
     - `PROXY_PORT`: Indonesian proxy port (optional)

## Usage

```bash
npm run dev
```


## Features

- Automatic session management
- Periodic ping mechanism
- IP address verification
- Hardware information reporting
- Proxy support for region-locked access
- Graceful shutdown handling

## Configuration

The application uses the following environment variables:
- `NODE_ID`: Your unique node identifier
- `AUTH_TOKEN`: Authentication token for API access
- `PROXY_HOST`: Proxy server hostname (optional)
- `PROXY_PORT`: Proxy server port (optional)

## Troubleshooting

Common issues and solutions:

1. **403 Forbidden Error**
   - Ensure you're using a valid authentication token
   - Consider using an Indonesian proxy

2. **Connection Issues**
   - Verify your internet connection
   - Check proxy settings if configured
   - Ensure your AUTH_TOKEN hasn't expired

## Maintenance

The application automatically:
- Manages sessions
- Sends periodic pings
- Reports node status
- Handles connection errors
- Implements exponential backoff for retries

## Security

- Never share your AUTH_TOKEN
- Keep your .env file secure
- Regularly update dependencies
- Monitor your node's activities

## Licence

ISC Licence

## Disclaimer

This is an unofficial implementation. Use at your own discretion and ensure compliance with Bless Network's terms of service.
