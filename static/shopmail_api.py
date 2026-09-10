import time

import requests

base_url = "https://shopmailmmo.store"  # Replace with actual API base URL

# TODO: replace with your api key
api_key = 'xxx'
delay_seconds = 7


class MailResp(object):
    Mail: str
    Pass: str
    Recover: str


def get_mail(service, time_out_second=None) -> (MailResp, str):
    if time_out_second is None:
        time_out_second = 10000000  # run loop forever until got an email

    total_time = 0
    while total_time < time_out_second:
        try:
            response = requests.post(f"{base_url}/v1/api/create-order.php?service=" + service, headers={
                'api_key': api_key
            })

            status_code = response.status_code
            if status_code == 200:
                data = response.json()
                mail = MailResp()
                mail.Mail = data.get("mail")
                mail.Pass = data.get("pass")
                mail.Recover = data.get("recover")

                return mail, data.get("order_id")

            if status_code < 500 or status_code > 550:
                print('get mail error:' + str(status_code))
                time.sleep(delay_seconds)
                continue

            if status_code == 502:
                raise Exception('invalid api key')

            data = response.json()
            msg = response.text
            if 'error' in data:
                msg = data['error']

            print('get mail error:' + str(status_code) + ', ' + msg)
            time.sleep(delay_seconds)
        except requests.RequestException as e:
            print(f"Error calling get_mail API: {e}")
            time.sleep(delay_seconds)
        finally:
            total_time = total_time + delay_seconds

    return None, None


def get_code(order_id: str, time_out_second=None, old_code=None):
    if time_out_second is None:
        # 360 = 6 min
        time_out_second = 360

    total_time = 0
    while total_time < time_out_second:
        try:
            response = requests.post(f"{base_url}/v1/api/check-otp.php?id={order_id}", headers={
                'api_key': api_key
            })

            status_code = response.status_code
            if status_code == 200:
                data = response.json()
                otp = data.get('otp')
                if otp is None or otp == '':
                    print('delay get otp')
                    time.sleep(delay_seconds)
                    continue

                return otp

            if status_code < 500 or status_code > 550:
                print('get code error:' + str(status_code))
                time.sleep(delay_seconds)
                continue

            if status_code == 502:
                raise Exception('invalid api key')

            data = response.json()
            msg = response.text
            if 'error' in data:
                msg = data['error']

            print('get code error:' + str(status_code) + ', ' + msg)
            time.sleep(delay_seconds)
        except requests.RequestException as e:
            print(f"Error calling get_code API: {e}")
            time.sleep(delay_seconds)
        finally:
            total_time = total_time + delay_seconds

    return None


def main():
    mail, order = get_mail('facebook')
    if mail is None:
        raise Exception('get mail timeout')

    print('mail ' + mail.Mail, mail.Pass, mail.Recover, order)

    code = get_code(order)
    if code is None:
        raise Exception(mail + ' no code!')
    print('code lan 1', code)

    code = get_code(order, old_code=code)
    if code is None:
        raise Exception(mail + ' no code!')
    print('code lan 2', code)


if __name__ == "__main__":
    main()
