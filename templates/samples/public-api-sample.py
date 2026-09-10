#!/usr/bin/env python3
"""
Shop Mail MMO public API sample.

Contact: https://t.me/sp_shopmailmmo

Demonstrates public endpoints and two purchase flows:
- Mail OTP: check stock -> user info -> create order -> poll OTP -> fetch OTP with `from`.
- Buy emails: create order with quantity -> read account data.

API always returns HTTP 200 with JSON envelope:
  { "status": "success", "data": ... }
  { "status": "error", "message": "error.*", "retryable": true|false }
"""

import json
import sys
import time
import uuid
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

# --- Edit before running ---
API_BASE = "https://api.shopmailmmo.com/api/v2/public"
API_KEY = "your_api_key_here"

# (data, error) — no exceptions for API failures.
ApiResult = tuple[dict[str, Any] | None, str | None]


def ok(data: dict[str, Any]) -> ApiResult:
	return data, None


def err(message: str) -> ApiResult:
	return None, message


def api(
	path: str,
	query: dict[str, str] | None = None,
	*,
	retry_sec: float = 1,
	timeout_sec: float | None = None,
) -> ApiResult:
	"""GET a public API endpoint with automatic retry."""
	query = query or {}
	url = f"{API_BASE.rstrip('/')}{path}?{urlencode(query)}" if query else f"{API_BASE.rstrip('/')}{path}"
	last_error = "Request failed"
	start = time.monotonic()
	attempt = 0

	while True:
		attempt += 1
		try:
			request = Request(url, headers={"Accept": "application/json"})
			with urlopen(request, timeout=60) as response:
				body = json.loads(response.read().decode())

			if body.get("status") == "success":
				return ok(body["data"])

			last_error = body.get("message") or body.get("status") or "API error"
			# Stop immediately on non-retryable API errors.
			if body.get("retryable") is False:
				return err(last_error)
		except Exception as error:
			# Network, JSON parse, or any unexpected error — retry.
			last_error = str(error)

		if timeout_sec is not None and time.monotonic() - start >= timeout_sec:
			return err(last_error)
		if timeout_sec is None:
			return err(last_error)

		print(f"  retry {attempt}: {last_error}")
		time.sleep(retry_sec)


def check_stock(service_type: str) -> ApiResult:
	"""GET /services?service=... — price and stock (no auth)."""
	return api("/services", {"service": service_type})


def get_user_info() -> ApiResult:
	"""GET /me?api_key=... — account id, email, balance."""
	return api("/me", {"api_key": API_KEY})


def create_order(
	service_type: str,
	*,
	timeout_sec: float = 180,
	quantity: int | None = None,
) -> ApiResult:
	"""GET /orders?api_key=...&service=...&unique_key=... [&quantity=...] — buy Mail OTP or email accounts. Retries every 1s."""
	unique_key = str(uuid.uuid4())
	query: dict[str, str] = {"api_key": API_KEY, "service": service_type, "unique_key": unique_key}
	if quantity is not None:
		query["quantity"] = str(quantity)
	return api("/orders", query, retry_sec=1, timeout_sec=timeout_sec)


def get_otp(order_id: str, from_ts: int | None = None, timeout_sec: float = 60) -> ApiResult:
	"""
	GET /orders/otp?order_id=...&unique_key=... [&from=...] — poll OTP (no auth). Retries every 2s.

	Optional `from` (Unix seconds): omit otp/received_at when latest received_at <= from.
	otp_history is always returned in full.
	"""
	unique_key = str(uuid.uuid4())
	query = {"order_id": order_id, "unique_key": unique_key}
	if from_ts is not None:
		query["from"] = str(from_ts)

	deadline = time.monotonic() + timeout_sec
	while True:
		remaining = deadline - time.monotonic()
		if remaining <= 0:
			return err("Timed out waiting for OTP")

		data, error = api("/orders/otp", query, retry_sec=2, timeout_sec=remaining)
		if error:
			return err(error)
		if data.get("otp"):
			return ok(data)

		if time.monotonic() + 2 > deadline:
			return err("Timed out waiting for OTP")
		time.sleep(2)


def main() -> int:
	print(f"base={API_BASE}\n")

	# ------------------------
	# 1. Check stock
	# ------------------------
	stock, error = check_stock("otp_gmail_facebook")
	if error:
		print(f"Error: {error}", file=sys.stderr)
		return 1
	print(f"price={stock.get('price')} stock={stock.get('stock')}\n")

	# ------------------------
	# 2. User info
	# ------------------------
	user, error = get_user_info()
	if error:
		print(f"Error: {error}", file=sys.stderr)
		return 1
	print(f"id={user.get('id')} balance={user.get('balance')}\n")

	# ------------------------
	# 3. Create order
	# ------------------------
	order, error = create_order("otp_gmail_facebook", timeout_sec=180)
	if error:
		print(f"Error: {error}", file=sys.stderr)
		return 1

	order_id = order.get("id")
	if not order_id:
		print("Error: Missing order id", file=sys.stderr)
		return 1
	print(f"order_id={order_id} email={order.get('email')}\n")

	# ------------------------
	# 4. Poll OTP
	# ------------------------
	first_otp, error = get_otp(order_id, timeout_sec=60)
	if error:
		print(f"Error: {error}", file=sys.stderr)
		return 1
	print(f"otp={first_otp.get('otp') or '-'} amount={first_otp.get('amount')} received_at={first_otp.get('received_at')}\n")

	from_ts = first_otp.get("received_at")
	if from_ts is None:
		print("Error: Missing received_at", file=sys.stderr)
		return 1

	second_otp, error = get_otp(order_id, from_ts, timeout_sec=60)
	if error:
		print(f"Error: {error}", file=sys.stderr)
		return 1
	print(f"otp={second_otp.get('otp') or '-'} history={len(second_otp.get('otp_history') or [])}")

	# ------------------------
	# 5. Buy emails
	# ------------------------
	email_service = "hotmail_imap_12m_36m"
	email_order, error = create_order(email_service, timeout_sec=180, quantity=1)
	if error:
		print(f"Error: {error}", file=sys.stderr)
		return 1

	email_data = email_order.get("data") or []
	print(
		f"\norder_id={email_order.get('id')} email={email_order.get('email') or '-'} "
		f"quantity={email_order.get('quantity')} amount={email_order.get('amount')} accounts={len(email_data)}"
	)
	for line in email_data[:3]:
		print(f"  {line}")

	print(f"\nDone. OTP={first_otp.get('otp')}")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
