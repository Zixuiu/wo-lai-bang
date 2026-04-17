#!/usr/bin/env python3
"""
清除所有业务数据脚本
包括：需求单子、聊天记录、接单记录、评论、图片、交易记录等
保留：用户账号信息
"""

import sqlite3
import os

# 数据库路径
DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def clear_all_data():
    """清空所有业务数据表"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 要清空的表列表（按依赖关系排序）
    tables_to_clear = [
        'messages',           # 聊天记录
        'comments',           # 评论
        'request_images',     # 需求图片
        'help_records',       # 帮助记录/接单记录
        'task_notes',         # 任务备注
        'notifications',      # 通知
        'wallet_transactions',# 钱包交易记录
        'withdrawals',        # 提现记录
        'transactions',       # 交易记录
        'requests',           # 需求单子
    ]
    
    print("开始清空数据...")
    print("=" * 50)
    
    for table in tables_to_clear:
        try:
            # 获取清空前的记录数
            cursor.execute(f'SELECT COUNT(*) FROM {table}')
            count = cursor.fetchone()[0]
            
            # 清空表
            cursor.execute(f'DELETE FROM {table}')
            
            # 重置自增ID（SQLite）
            cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}'")
            
            print(f"✓ {table}: 已删除 {count} 条记录")
        except Exception as e:
            print(f"✗ {table}: 删除失败 - {str(e)}")
    
    # 重置钱包余额（可选，保留钱包记录但清零）
    try:
        cursor.execute("UPDATE wallets SET balance = 0, frozen_amount = 0")
        print("✓ wallets: 已重置所有余额为0")
    except Exception as e:
        print(f"✗ wallets: 重置失败 - {str(e)}")
    
    conn.commit()
    conn.close()
    
    print("=" * 50)
    print("数据清空完成！")
    print("\n保留的数据：")
    print("  - 用户账号信息（users表）")
    print("  - 广告信息（ads表）")
    print("  - 钱包账户（wallets表，但余额已清零）")

if __name__ == '__main__':
    import sys
    
    # 检查是否有 --force 参数
    if len(sys.argv) > 1 and sys.argv[1] == '--force':
        clear_all_data()
    else:
        # 确认提示
        print("警告：此操作将清空所有业务数据！")
        print("包括：需求单子、聊天记录、接单记录、评论、交易记录等")
        print()
        print("使用方法：")
        print("  python clear_all_data.py       # 交互式确认")
        print("  python clear_all_data.py --force  # 直接执行，跳过确认")
        print()
        
        confirm = input("确定要清空所有数据吗？输入 'yes' 确认: ")
        
        if confirm.lower() == 'yes':
            clear_all_data()
        else:
            print("操作已取消")
