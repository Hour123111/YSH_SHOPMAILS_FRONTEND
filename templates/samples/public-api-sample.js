#!/usr/bin/env node
/**
 * Shop Mail MMO public API sample. Requires Node.js 18+.
 *
 * Contact: https://t.me/sp_shopmailmmo
 *
 * Demonstrates public endpoints and two purchase flows:
 * - Mail OTP: check stock -> user info -> create order -> poll OTP -> fetch OTP with `from`.
 * - Buy emails: create order with quantity -> read account data.
 *
 * API always returns HTTP 200 with JSON envelope:
 *   { status: "success", data: ... }
 *   { status: "error", message: "error.*", retryable: true|false }
 */

// --- Edit before running ---
const API_BASE = 'https://api.shopmailmmo.com/api/v2/public';
const API_KEY = 'your_api_key_here';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @typedef {[{ [key: string]: unknown } | null, string | null]} ApiResult */

/** @returns {ApiResult} */
function ok(data) {
	return [data, null];
}

/** @returns {ApiResult} */
function err(message) {
	return [null, message];
}

/** GET a public API endpoint with automatic retry. @returns {Promise<ApiResult>} */
async function api(path, query = {}, { retrySec = 1, timeoutSec = null } = {}) {
	const params = new URLSearchParams(query);
	const url = params.size ? `${API_BASE.replace(/\/$/, '')}${path}?${params}` : `${API_BASE.replace(/\/$/, '')}${path}`;

	let lastError = 'Request failed';
	const start = Date.now();
	let attempt = 0;

	while (true) {
		attempt += 1;

		try {
			const response = await fetch(url, {
				headers: { Accept: 'application/json' },
				signal: AbortSignal.timeout(60_000),
			});
			const body = await response.json().catch(() => {
				throw new Error(`Invalid JSON (HTTP ${response.status})`);
			});

			if (body.status === 'success') {
				return ok(body.data);
			}

			lastError = body.message || body.status || 'API error';
			// Stop immediately on non-retryable API errors.
			if (body.retryable === false) {
				return err(lastError);
			}
		} catch (error) {
			// Network, JSON parse, or any unexpected error — retry.
			lastError = error instanceof Error ? error.message : String(error);
		}

		if (timeoutSec != null && Date.now() - start >= timeoutSec * 1000) {
			return err(lastError);
		}
		if (timeoutSec == null) {
			return err(lastError);
		}

		console.log(`  retry ${attempt}: ${lastError}`);
		await sleep(retrySec * 1000);
	}
}

/** GET /services?service=... — price and stock (no auth). @returns {Promise<ApiResult>} */
async function checkStock(serviceType) {
	return api('/services', { service: serviceType });
}

/** GET /me?api_key=... — account id, email, balance. @returns {Promise<ApiResult>} */
async function getUserInfo() {
	return api('/me', { api_key: API_KEY });
}

/** GET /orders?api_key=...&service=...&unique_key=... [&quantity=...] — buy Mail OTP or email accounts. Retries every 1s. @returns {Promise<ApiResult>} */
async function createOrder(serviceType, { timeoutSec = 180, quantity = null } = {}) {
	const uniqueKey = crypto.randomUUID();
	const query = { api_key: API_KEY, service: serviceType, unique_key: uniqueKey };
	if (quantity != null) query.quantity = String(quantity);
	return api('/orders', query, { retrySec: 1, timeoutSec });
}

/**
 * GET /orders/otp?order_id=...&unique_key=... [&from=...] — poll OTP (no auth). Retries every 2s.
 * Optional `from` (Unix seconds): omit otp/received_at when latest received_at <= from.
 * @returns {Promise<ApiResult>}
 */
async function getOtp(orderId, fromTs = null, timeoutSec = 60) {
	const uniqueKey = crypto.randomUUID();
	const query = { order_id: orderId, unique_key: uniqueKey };
	if (fromTs != null) query.from = String(fromTs);

	const deadline = Date.now() + timeoutSec * 1000;
	while (true) {
		const remainingSec = (deadline - Date.now()) / 1000;
		if (remainingSec <= 0) {
			return err('Timed out waiting for OTP');
		}

		const [data, error] = await api('/orders/otp', query, { retrySec: 2, timeoutSec: remainingSec });
		if (error) return err(error);
		if (data.otp) return ok(data);

		if (Date.now() + 2000 > deadline) {
			return err('Timed out waiting for OTP');
		}
		await sleep(2000);
	}
}

async function main() {
	console.log(`base=${API_BASE}\n`);

	// ------------------------
	// 1. Check stock
	// ------------------------
	const [stock, stockError] = await checkStock('otp_gmail_facebook');
	if (stockError) {
		console.error(`Error: ${stockError}`);
		return 1;
	}
	console.log(`price=${stock.price} stock=${stock.stock}\n`);

	// ------------------------
	// 2. User info
	// ------------------------
	const [user, userError] = await getUserInfo();
	if (userError) {
		console.error(`Error: ${userError}`);
		return 1;
	}
	console.log(`id=${user.id} balance=${user.balance}\n`);

	// ------------------------
	// 3. Create order
	// ------------------------
	const [order, orderError] = await createOrder('otp_gmail_facebook', { timeoutSec: 180 });
	if (orderError) {
		console.error(`Error: ${orderError}`);
		return 1;
	}
	if (!order.id) {
		console.error('Error: Missing order id');
		return 1;
	}
	console.log(`order_id=${order.id} email=${order.email}\n`);

	// ------------------------
	// 4. Poll OTP
	// ------------------------
	const [firstOtp, firstOtpError] = await getOtp(order.id, null, 60);
	if (firstOtpError) {
		console.error(`Error: ${firstOtpError}`);
		return 1;
	}
	console.log(`otp=${firstOtp.otp || '-'} amount=${firstOtp.amount} received_at=${firstOtp.received_at}\n`);

	const fromTs = firstOtp.received_at;
	if (fromTs == null) {
		console.error('Error: Missing received_at');
		return 1;
	}

	const [secondOtp, secondOtpError] = await getOtp(order.id, fromTs, 60);
	if (secondOtpError) {
		console.error(`Error: ${secondOtpError}`);
		return 1;
	}
	console.log(`otp=${secondOtp.otp || '-'} history=${(secondOtp.otp_history || []).length}`);

	// ------------------------
	// 5. Buy emails
	// ------------------------
	const emailService = 'hotmail_imap_12m_36m';
	const [emailOrder, emailOrderError] = await createOrder(emailService, { timeoutSec: 180, quantity: 1 });
	if (emailOrderError) {
		console.error(`Error: ${emailOrderError}`);
		return 1;
	}

	const emailData = emailOrder.data || [];
	console.log(
		`\norder_id=${emailOrder.id} email=${emailOrder.email || '-'} quantity=${emailOrder.quantity} amount=${emailOrder.amount} accounts=${emailData.length}`,
	);
	for (const line of emailData.slice(0, 3)) {
		console.log(`  ${line}`);
	}

	console.log(`\nDone. OTP=${firstOtp.otp}`);
	return 0;
}

main()
	.then((code) => {
		if (code) process.exitCode = code;
	})
	.catch((error) => {
		console.error(`Error: ${error.message}`);
		process.exitCode = 1;
	});
