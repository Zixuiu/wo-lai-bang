#!/usr/bin/env python3
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wolaibang.db')

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

print('wolaibang.db 中的表:')
for t in tables:
    table_name = t[0]
    cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
    count = cursor.fetchone()[0]
    print(f'  - {table_name}: {count} 条记录')

# 特别检查 messages 表
print('\n' + '=' * 50)
print('messages 表内容:')
cursor.execute('SELECT * FROM messages LIMIT 10')
rows = cursor.fetchall()
if rows:
    for row in rows:
        print(dict(row))
else:
    print('  (空)')

conn.close()
