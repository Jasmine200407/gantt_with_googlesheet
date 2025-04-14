import json

creds_json = os.getenv("GOOGLE_CREDS_JSON")
try:
    creds_dict = json.loads(creds_json)
    print(creds_dict)
except json.JSONDecodeError as e:
    print(f"JSON 解碼錯誤: {e}")
