#!/usr/bin/env python3
"""
初始化数据库并清空所有业务数据
"""

import sys
import os

# 添加模型路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.database import init_database, get_db_connection

def clear_all_data():
    """清空所有业务数据表"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 获取所有表名
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    print("数据库中的表:")
    for t in tables:
        print(f"  - {t[0]}")
    
    print("\n" + "=" * 50)
    print("开始清空数据...")
    print("=" * 50)
    
    # 要清空的业务表（按依赖关系排序）
    tables_to_clear = [
        'messages',           # 聊天记录
        'comments',           # 评论
        'help_records',       # 帮助记录/接单记录
        'login_failures',     # 登录失败记录
        'verification_codes', # 验证码
        'payments',           # 支付订单
        'wallets',            # 钱包
        'requests',           # 需求单子
    ]
    
    for table in tables_to_clear:
        try:
            # 获取清空前的记录数
            cursor.execute(f'SELECT COUNT(*) FROM {table}')
            count = cursor.fetchone()[0]
            
            if count > 0:
                # 清空表
                cursor.execute(f'DELETE FROM {table}')
                print(f"✓ {table}: 已删除 {count} 条记录")
            else:
                print(f"  {table}: 无数据")
        except Exception as e:
            print(f"✗ {table}: 删除失败 - {str(e)}")
    
    conn.commit()
    conn.close()
    
    print("=" * 50)
    print("数据清空完成！")
    print("\n保留的数据：")
    print("  - 用户账号信息（users表）")

if __name__ == '__main__':
    # 先初始化数据库（创建表）
    print("正在初始化数据库...")
    init_database()
    print("数据库初始化完成！\n")
    
    # 清空数据
    clear_all_data()
