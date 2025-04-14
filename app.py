from flask import Flask, request, jsonify, render_template
import gspread
import json
import os
from dotenv import load_dotenv
from flask_cors import CORS
from datetime import datetime
from oauth2client.service_account import ServiceAccountCredentials

load_dotenv()
app = Flask(__name__)
CORS(app)

import os
from dotenv import load_dotenv
load_dotenv()



SHEET_ID = '1dgxLSLBcjB0_56_8URBsYgP_pLBSz6SMBHXCr00YdW4'
SHEET_NAME = 'april'

def normalize_date(d):
    try:
        return datetime.strptime(d, "%m/%d").strftime("%m/%d")
    except:
        try:
            return datetime.strptime(d, "%Y/%m/%d").strftime("%m/%d")
        except:
            return d.strip()
creds_json = os.getenv("GOOGLE_CREDS_JSON")
print("GOOGLE_CREDS_JSON:", creds_json)  # 打印 GOOGLE_CREDS_JSON 以檢查是否正確載入
try:
    creds_dict = json.loads(creds_json)  # 將 JSON 字串轉換為字典
    print(creds_dict)
    print("成功解析憑證：", creds_dict)
except json.JSONDecodeError as e:
    print(f"JSON 解碼錯誤: {e}")

def connect_sheet():
    try:
        creds_json = os.getenv("GOOGLE_CREDS_JSON")  # 確保這裡使用正確的環境變數名稱
        if not creds_json:
            raise Exception("❌ GOOGLE_CREDS_JSON 環境變數未找到！")
        
        # 嘗試解析 JSON
        try:
            creds_dict = json.loads(creds_json)  # 解析憑證字串為字典
            print("🔐 成功解析服務帳號憑證 JSON")
        except json.JSONDecodeError as e:
            print(f"❌ JSON 解碼錯誤: {e}")
            raise Exception("❌ GOOGLE_CREDS_JSON 格式錯誤")
        
        # 定義 API 存取範圍
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]

        # 嘗試使用憑證來建立認證
        creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        print("🔐 成功建立服務帳戶認證")

        # 嘗試授權並連接到 Google Sheets
        client = gspread.authorize(creds)
        print("🔐 成功授權 Google Sheets API")

        sheet = client.open_by_key(SHEET_ID).worksheet(SHEET_NAME)
        print(f"🔐 成功連接到工作表: {SHEET_NAME}")

        return sheet

    except Exception as e:
        print("❌ connect_sheet 錯誤：", e)
        raise  # 重新拋出異常以便在外部處理

@app.route('/tasks', methods=['GET'])
def get_tasks():
    try:
        sheet = connect_sheet()
        data = sheet.get_all_records()
        return jsonify(data), 200
    except Exception as e:
        print("❌ 取得任務失敗：", e)
        return jsonify({'error': str(e)}), 500

@app.route('/tasks', methods=['POST'])
def add_task():
    try:
        new_task = request.json
        sheet = connect_sheet()
        row = [
            new_task.get('專案名稱', ''),
            new_task.get('專案截止日期', ''),
            new_task.get('任務名稱', ''),
            new_task.get('開始日期', ''),
            new_task.get('結束日期', ''),
            new_task.get('備註', '')
        ]
        sheet.append_row(row)
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        print("❌ 新增任務失敗：", e)
        return jsonify({'error': str(e)}), 500

@app.route('/tasks', methods=['PUT'])
def update_task():
    try:
        data = request.json
        sheet = connect_sheet()

        original_name = data.get('originalName')
        original_start = data.get('originalStart')
        original_end = data.get('originalEnd')

        records = sheet.get_all_records()
        for index, row in enumerate(records, start=2):
            if (row['任務名稱'] == original_name and
                row['開始日期'] == original_start and
                row['結束日期'] == original_end):

                sheet.update(f'A{index}:F{index}', [[
                    data.get('專案名稱', ''),
                    data.get('專案截止日期', ''),
                    data.get('任務名稱', ''),
                    data.get('開始日期', ''),
                    data.get('結束日期', ''),
                    data.get('備註', '')
                ]])
                return jsonify({'status': 'updated'}), 200

        return jsonify({'status': 'not found'}), 404
    except Exception as e:
        print("❌ 更新任務失敗：", e)
        return jsonify({'error': str(e)}), 500

@app.route('/tasks', methods=['DELETE'])
def delete_task():
    try:
        sheet = connect_sheet()
        task_data = request.json

        task_name = str(task_data.get('任務名稱', '')).strip()
        start_date = normalize_date(task_data.get('開始日期', ''))
        end_date = normalize_date(task_data.get('結束日期', ''))

        records = sheet.get_all_records()
        for index, row in enumerate(records, start=2):
            row_name = str(row.get('任務名稱', '')).strip()
            row_start = normalize_date(row.get('開始日期', ''))
            row_end = normalize_date(row.get('結束日期', ''))

            if row_name == task_name and row_start == start_date and row_end == end_date:
                sheet.delete_rows(index)
                return jsonify({'status': 'deleted'}), 200

        return jsonify({'status': 'not found'}), 404
    except Exception as e:
        print("❌ 刪除任務失敗：", e)
        return jsonify({'error': str(e)}), 500

@app.route('/')
def home():
    return render_template('index.html')
@app.route("/test-gs")
def test_gs():
    import os, json
    from google.oauth2 import service_account
    import gspread  # 如果您用gspread

    try:
        # 載入憑證資訊
        creds_info = json.loads(os.environ["GOOGLE_CREDS_JSON"])
        creds = service_account.Credentials.from_service_account_info(creds_info, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
        # 連接 Google Sheet（使用gspread範例）
        client = gspread.authorize(creds)
        sheet = client.open_by_key("<您的試算表ID>")
        data = sheet.sheet1.get_all_records()  # 或讀取第一行
        return {"status": "success", "rows": len(data)}, 200
    except Exception as e:
        # 將錯誤轉為字串輸出
        return {"status": "error", "message": str(e)}, 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))  # Render 預設是 10000
    app.run(host='0.0.0.0', port=port,debug=True)

