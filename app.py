from flask import Flask, request, jsonify
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from flask_cors import CORS
from datetime import datetime
import os
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)

SHEET_ID = '1dgxLSLBcjB0_56_8URBsYgP_pLBSz6SMBHXCr00YdW4'
SHEET_NAME = 'april'

def connect_sheet():
    scope = ['https://spreadsheets.google.com/feeds',
             'https://www.googleapis.com/auth/spreadsheets',
             'https://www.googleapis.com/auth/drive']
    creds_path = '/etc/secrets/creds.json'
    creds = ServiceAccountCredentials.from_json_keyfile_name(creds_path, scope)
    client = gspread.authorize(creds)
    sheet = client.open_by_key(SHEET_ID).worksheet(SHEET_NAME)
    return sheet
def normalize_date(d):
    try:
        return datetime.strptime(d, "%m/%d").strftime("%m/%d")
    except:
        try:
            return datetime.strptime(d, "%Y/%m/%d").strftime("%m/%d")
        except:
            return d.strip()

@app.route('/tasks', methods=['GET'])
def get_tasks():
    try:
        sheet = connect_sheet()
        data = sheet.get_all_records()
        return jsonify(data), 200
    except Exception as e:
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
        return jsonify({'status': 'success'})
    except Exception as e:
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
        for index, row in enumerate(records, start=2):  # 從第 2 列開始是資料列
            row_name = str(row.get('任務名稱', '')).strip()
            row_start = normalize_date(row.get('開始日期', ''))
            row_end = normalize_date(row.get('結束日期', ''))

            # ✅ 改為標準化比對
            if row_name == task_name and row_start == start_date and row_end == end_date:
                sheet.delete_rows(index)
                return jsonify({'status': 'deleted'}), 200

        return jsonify({'status': 'not found'}), 404
    except Exception as e:
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
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))  # Render 預設是 10000
    app.run(host='0.0.0.0', port=port,debug=True)
