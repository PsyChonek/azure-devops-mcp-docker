#!/usr/bin/env node

/**
 * MCP Proxy for Azure DevOps Docker Container
 * Fixed to ensure all responses have valid IDs
 */

const http = require('http');

process.stdin.setEncoding('utf8');

let messageBuffer = '';

function sendToServer(message, callback) {
	const postData = JSON.stringify(message);
	
	const options = {
		hostname: 'localhost',
		port: 3000,
		path: '/api/mcp',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(postData)
		},
		timeout: 10000
	};

	const req = http.request(options, (res) => {
		let responseData = '';
		
		res.on('data', (chunk) => {
			responseData += chunk;
		});
		
		res.on('end', () => {
			callback(null, responseData);
		});
	});

	req.on('timeout', () => {
		req.destroy();
		callback(new Error('Timeout'));
	});

	req.on('error', (error) => {
		callback(error);
	});

	req.write(postData);
	req.end();
}

function processMessage(messageText) {
	try {
		const message = JSON.parse(messageText);
		
		// Extract and validate the request ID
		const requestId = message.id;
		const isNotification = requestId === undefined;
		
		sendToServer(message, (error, responseData) => {
			if (error) {
				// Only send error response for requests (not notifications)
				if (!isNotification) {
					const errorResponse = {
						jsonrpc: '2.0',
						id: requestId, // Use original request ID
						error: {
							code: -32603,
							message: error.message
						}
					};
					process.stdout.write(JSON.stringify(errorResponse) + '\n');
				}
				return;
			}

			// Handle empty response (common for notifications)
			if (!responseData || !responseData.trim()) {
				// For notifications, empty response is normal - do nothing
				if (isNotification) {
					return;
				}
				
				// For requests, empty response is an error
				const errorResponse = {
					jsonrpc: '2.0',
					id: requestId, // Use original request ID
					error: {
						code: -32603,
						message: 'Empty response from server'
					}
				};
				process.stdout.write(JSON.stringify(errorResponse) + '\n');
				return;
			}

			try {
				const response = JSON.parse(responseData);
				
				// For notifications, don't send any response
				if (isNotification) {
					return;
				}
				
				// Ensure proper JSON-RPC format for requests
				if (!response.jsonrpc) {
					response.jsonrpc = '2.0';
				}
				
				// CRITICAL: Always ensure the response has the original request ID
				response.id = requestId;

				process.stdout.write(JSON.stringify(response) + '\n');
			} catch (parseError) {
				// Only send error response for requests
				if (!isNotification) {
					const errorResponse = {
						jsonrpc: '2.0',
						id: requestId, // Use original request ID
						error: {
							code: -32700,
							message: 'Invalid JSON response: ' + parseError.message
						}
					};
					process.stdout.write(JSON.stringify(errorResponse) + '\n');
				}
			}
		});
		
	} catch (error) {
		// For JSON parse errors, we can't get the original ID, so use null
		const errorResponse = {
			jsonrpc: '2.0',
			id: null,
			error: {
				code: -32700,
				message: 'Invalid JSON request: ' + error.message
			}
		};
		process.stdout.write(JSON.stringify(errorResponse) + '\n');
	}
}

process.stdin.on('data', (data) => {
	messageBuffer += data.toString();
	
	// Process complete messages (separated by newlines)
	let newlineIndex;
	while ((newlineIndex = messageBuffer.indexOf('\n')) !== -1) {
		const messageText = messageBuffer.slice(0, newlineIndex).trim();
		messageBuffer = messageBuffer.slice(newlineIndex + 1);
		
		if (messageText) {
			processMessage(messageText);
		}
	}
});

process.stdin.on('end', () => {
	process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// Keep process alive
process.stdin.resume();