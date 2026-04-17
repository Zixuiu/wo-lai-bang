import sqlite3
import json
from datetime import datetime
import os
import math
import bcrypt
import sys

# Fix Windows Python 3.13+ console encoding issue
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# SQLite连接配置
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'wolaibang.db')

def calculate_distance(lat1, lng1, lat2, lng2):
    """
    计算两个坐标之间的距离（公里）
    使用Haversine公式
    """
    if lat1 is None or lng1 is None or lat2 is None or lng2 is None:
        return None
    
    R = 6371  # 地球半径（公里）
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return round(distance, 1)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 创建用户表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            nickname VARCHAR(50) NOT NULL,
            password VARCHAR(255) NOT NULL,
            avatar TEXT,
            phone VARCHAR(20),
            email VARCHAR(100),
            location TEXT,
            address TEXT,
            lat REAL,
            lng REAL,
            is_admin BOOLEAN DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            rating REAL DEFAULT 5.0,
            help_count INTEGER DEFAULT 0,
            request_count INTEGER DEFAULT 0,
            payment_qr_code TEXT,
            payment_qr_type VARCHAR(20)
        )
    ''')
    
    # 尝试添加收款码字段
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN payment_qr_code TEXT')
    except:
        pass
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN payment_qr_type VARCHAR(20)')
    except:
        pass
    
    # 尝试添加技能标签字段
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN skills TEXT')
    except:
        pass
    
    # 尝试添加个人简介字段
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN bio TEXT')
    except:
        pass
    
    # 创建需求表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(20) NOT NULL,
            location TEXT,
            address TEXT,
            lat REAL,
            lng REAL,
            reward TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            is_urgent INTEGER DEFAULT 0,
            urgent_type VARCHAR(20),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            helper_id INTEGER,
            helper_status VARCHAR(20) DEFAULT NULL,
            helper_completed INTEGER DEFAULT 0,
            helper_completed_at TIMESTAMP,
            need_photo_verify INTEGER DEFAULT 0,
            deposit_amount DECIMAL(10, 2) DEFAULT 0,
            deposit_paid INTEGER DEFAULT 0,
            deposit_refunded INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (helper_id) REFERENCES users (id)
        )
    ''')
    
    # 尝试添加 helper_completed 列（如果不存在）
    try:
        cursor.execute('ALTER TABLE requests ADD COLUMN helper_completed INTEGER DEFAULT 0')
    except:
        pass
    try:
        cursor.execute('ALTER TABLE requests ADD COLUMN helper_completed_at TIMESTAMP')
    except:
        pass
    
    # 尝试添加技能标签字段
    try:
        cursor.execute('ALTER TABLE requests ADD COLUMN skills TEXT')
    except:
        pass
    
    # 创建评论表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (request_id) REFERENCES requests (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # 创建帮助记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS help_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL,
            helper_id INTEGER NOT NULL,
            status VARCHAR(20) DEFAULT 'accepted',
            is_candidate INTEGER DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            rating INTEGER,
            review TEXT,
            FOREIGN KEY (request_id) REFERENCES requests (id),
            FOREIGN KEY (helper_id) REFERENCES users (id)
        )
    ''')

    # 创建消息表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            request_id INTEGER,
            content TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_read BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (sender_id) REFERENCES users (id),
            FOREIGN KEY (receiver_id) REFERENCES users (id),
            FOREIGN KEY (request_id) REFERENCES requests (id)
        )
    ''')

    # 创建登录失败追踪表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS login_failures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identifier VARCHAR(100) NOT NULL,
            fail_count INTEGER DEFAULT 1,
            last_fail_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            locked_until TIMESTAMP,
            UNIQUE(identifier)
        )
    ''')

    # 创建索引优化查询性能
    # 用户表索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_help_count ON users(help_count DESC)')
    
    # 需求表索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_requests_category ON requests(category)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_requests_helper_id ON requests(helper_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_requests_status_category ON requests(status, category)')
    
    # 评论表索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_comments_request_id ON comments(request_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)')
    
    # 帮助记录表索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_help_records_request_id ON help_records(request_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_help_records_helper_id ON help_records(helper_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_help_records_status ON help_records(status)')

    # 消息表索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_messages_request_id ON messages(request_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)')

    # 创建支付订单表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL,
            payer_id INTEGER NOT NULL,
            payee_id INTEGER NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            payment_method VARCHAR(20) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            transaction_id VARCHAR(100),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            paid_at TIMESTAMP,
            refunded_at TIMESTAMP,
            refund_amount DECIMAL(10, 2) DEFAULT 0,
            description TEXT,
            FOREIGN KEY (request_id) REFERENCES requests (id),
            FOREIGN KEY (payer_id) REFERENCES users (id),
            FOREIGN KEY (payee_id) REFERENCES users (id)
        )
    ''')

    # 创建钱包表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            balance DECIMAL(10, 2) DEFAULT 0,
            frozen_amount DECIMAL(10, 2) DEFAULT 0,
            total_income DECIMAL(10, 2) DEFAULT 0,
            total_expense DECIMAL(10, 2) DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # 创建钱包交易记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS wallet_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            type VARCHAR(20) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            balance_after DECIMAL(10, 2) NOT NULL,
            related_id INTEGER,
            related_type VARCHAR(20),
            description TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (wallet_id) REFERENCES wallets (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # 创建提现记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS withdrawals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            withdrawal_method VARCHAR(20) NOT NULL,
            account_info TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP,
            remark TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # 创建需求图片表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS request_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL,
            image_url TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (request_id) REFERENCES requests (id) ON DELETE CASCADE
        )
    ''')

    # 需求图片表索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_request_images_request_id ON request_images(request_id)')

    # 支付表索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_payments_request_id ON payments(request_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_payments_payer_id ON payments(payer_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_payments_payee_id ON payments(payee_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id)')
    
    # 钱包表索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id)')
    
    # 钱包交易记录索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC)')
    
    # 提现记录索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status)')

    # 验证码存储表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email VARCHAR(100) UNIQUE NOT NULL,
            code VARCHAR(10) NOT NULL,
            expires INTEGER NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email)')

    # 广告表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(100) NOT NULL,
            content TEXT,
            image_url TEXT,
            link_url TEXT,
            position VARCHAR(20) DEFAULT 'banner',
            priority INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active',
            start_date TIMESTAMP,
            end_date TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ads_priority ON ads(priority DESC)')

    # 交易记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            commission DECIMAL(10, 2) DEFAULT 0,
            status VARCHAR(20) DEFAULT 'pending',
            type VARCHAR(20) NOT NULL,
            related_id INTEGER,
            related_type VARCHAR(20),
            description TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)')

    conn.commit()
    conn.close()
    print("Database initialized! Indexes created.")

def migrate_database():
    """
    数据库迁移：添加新字段
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("PRAGMA table_info(requests)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'helper_status' not in columns:
            cursor.execute("ALTER TABLE requests ADD COLUMN helper_status VARCHAR(20) DEFAULT NULL")
            print("Added column: helper_status")
        
        if 'need_photo_verify' not in columns:
            cursor.execute("ALTER TABLE requests ADD COLUMN need_photo_verify INTEGER DEFAULT 0")
            print("Added column: need_photo_verify")
        
        if 'deposit_amount' not in columns:
            cursor.execute("ALTER TABLE requests ADD COLUMN deposit_amount DECIMAL(10, 2) DEFAULT 0")
            print("Added column: deposit_amount")
        
        if 'deposit_paid' not in columns:
            cursor.execute("ALTER TABLE requests ADD COLUMN deposit_paid INTEGER DEFAULT 0")
            print("Added column: deposit_paid")
        
        if 'deposit_refunded' not in columns:
            cursor.execute("ALTER TABLE requests ADD COLUMN deposit_refunded INTEGER DEFAULT 0")
            print("Added column: deposit_refunded")
        
        if 'progress' not in columns:
            cursor.execute("ALTER TABLE requests ADD COLUMN progress INTEGER DEFAULT 0")
            print("Added column: progress")
        
        # Add message_type field to messages table
        cursor.execute("PRAGMA table_info(messages)")
        msg_columns = [row[1] for row in cursor.fetchall()]
        if 'message_type' not in msg_columns:
            cursor.execute("ALTER TABLE messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text'")
            print("Added column: message_type")
        
        cursor.execute("PRAGMA table_info(help_records)")
        help_columns = [row[1] for row in cursor.fetchall()]
        
        if 'is_candidate' not in help_columns:
            cursor.execute("ALTER TABLE help_records ADD COLUMN is_candidate INTEGER DEFAULT 0")
            print("Added column: is_candidate")
        
        cursor.execute("PRAGMA table_info(users)")
        user_columns = [row[1] for row in cursor.fetchall()]
        
        if 'is_verified' not in user_columns:
            cursor.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0")
            print("Added column: is_verified")
        
        if 'verified_at' not in user_columns:
            cursor.execute("ALTER TABLE users ADD COLUMN verified_at TIMESTAMP")
            print("Added column: verified_at")
        
        if 'id_card' not in user_columns:
            cursor.execute("ALTER TABLE users ADD COLUMN id_card VARCHAR(20)")
            print("Added column: id_card")
        
        if 'real_name' not in user_columns:
            cursor.execute("ALTER TABLE users ADD COLUMN real_name VARCHAR(50)")
            print("Added column: real_name")
        
        if 'address' not in user_columns:
            cursor.execute("ALTER TABLE users ADD COLUMN address TEXT")
            print("Added column: address")
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS task_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES requests (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        print("Created table: task_notes")
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                related_id INTEGER,
                related_type VARCHAR(50),
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        print("Created table: notifications")
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS blacklist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                blocked_user_id INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (blocked_user_id) REFERENCES users (id),
                UNIQUE(user_id, blocked_user_id)
            )
        ''')
        print("Created table: blacklist")
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER NOT NULL,
                reported_user_id INTEGER,
                request_id INTEGER,
                type VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP,
                processed_by INTEGER,
                FOREIGN KEY (reporter_id) REFERENCES users (id),
                FOREIGN KEY (reported_user_id) REFERENCES users (id),
                FOREIGN KEY (request_id) REFERENCES requests (id),
                FOREIGN KEY (processed_by) REFERENCES users (id)
            )
        ''')
        print("Created table: reports")
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_task_notes_request_id ON task_notes(request_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_blacklist_user_id ON blacklist(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title VARCHAR(100) NOT NULL,
                content TEXT,
                image_url TEXT,
                link_url TEXT,
                position VARCHAR(20) DEFAULT 'banner',
                priority INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'active',
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        print("Created table: ads")

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                commission DECIMAL(10, 2) DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending',
                type VARCHAR(20) NOT NULL,
                related_id INTEGER,
                related_type VARCHAR(20),
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        print("Created table: transactions")

        cursor.execute('CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_ads_priority ON ads(priority DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)')
        
        conn.commit()
        print("Database migration completed")
    except Exception as e:
        print(f"Database migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

def insert_test_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 检查是否已有需求数据
    cursor.execute("SELECT COUNT(*) FROM requests")
    requests_count = cursor.fetchone()[0]
    
    if requests_count > 0:
        print(f"已有 {requests_count} 条需求数据，跳过插入")
        conn.close()
        return
    
    # 检查是否已有admin用户
    cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
    admin_exists = cursor.fetchone()[0] > 0
    
    # 检查是否已有普通用户
    cursor.execute("SELECT COUNT(*) FROM users WHERE username != 'admin'")
    users_exist = cursor.fetchone()[0] > 0
    
    # 插入测试用户 - 统一使用北京市朝阳区，便于距离计算
    # (username, nickname, password, avatar, phone, email, location, lat, lng, is_admin, created_at, rating, help_count, request_count)
    user_data_list = [
        ('admin', '管理员', '123456', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', '13800000000', 'admin@email.com', '北京市朝阳区', 39.9042, 116.4074, 1, '2026-01-01 00:00:00', 5.0, 0, 0),
        ('zhangsan', '张三', '123456', 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhangsan', '13800138001', 'zhangsan@email.com', '北京市朝阳区三里屯', 39.9345, 116.4551, 0, '2026-01-15 10:00:00', 4.8, 12, 3),
        ('lisi', '李四', '123456', 'https://api.dicebear.com/7.x/avataaars/svg?seed=lisi', '13800138002', 'lisi@email.com', '北京市朝阳区国贸', 39.9090, 116.4475, 0, '2026-01-16 14:30:00', 4.9, 25, 5),
        ('wangwu', '王五', '123456', 'https://api.dicebear.com/7.x/avataaars/svg?seed=wangwu', '13800138003', 'wangwu@email.com', '北京市朝阳区望京', 39.9990, 116.4810, 0, '2026-01-17 09:15:00', 4.7, 8, 12),
        ('zhaoliu', '赵六', '123456', 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhaoliu', '13800138004', 'zhaoliu@email.com', '北京市朝阳区大望路', 39.9140, 116.5260, 0, '2026-01-18 16:45:00', 5.0, 15, 2),
        ('qianqi', '钱七', '123456', 'https://api.dicebear.com/7.x/avataaars/svg?seed=qianqi', '13800138005', 'qianqi@email.com', '北京市朝阳区亚运村', 39.9820, 116.4070, 0, '2026-01-19 11:20:00', 4.6, 6, 8),
        ('sunba', '孙八', '123456', 'https://api.dicebear.com/7.x/avataaars/svg?seed=sunba', '13800138006', 'sunba@email.com', '北京市朝阳区酒仙桥', 39.9850, 116.4960, 0, '2026-01-20 13:00:00', 4.8, 3, 15),
        ('zhoujiu', '周九', '123456', 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhoujiu', '13800138007', 'zhoujiu@email.com', '北京市朝阳区东直门', 39.9400, 116.4350, 0, '2026-01-21 08:30:00', 5.0, 30, 1),
        ('wushi', '吴十', '123456', 'https://api.dicebear.com/7.x/avataaars/svg?seed=wushi', '13800138008', 'wushi@email.com', '北京市朝阳区四惠', 39.9080, 116.5050, 0, '2026-01-22 15:45:00', 4.7, 10, 6),
    ]

    users = []
    for user_data in user_data_list:
        username, nickname, password_plain, avatar, phone, email, location, lat, lng, is_admin, created_at, rating, help_count, request_count = user_data

        # 检查用户是否已存在
        cursor.execute("SELECT COUNT(*) FROM users WHERE username = ?", (username,))
        if cursor.fetchone()[0] > 0:
            continue

        # 生成密码哈希，默认密码为 password_plain
        password_hash = bcrypt.hashpw(password_plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        users.append((username, nickname, password_hash, avatar, phone, email, location, lat, lng, is_admin, created_at, rating, help_count, request_count))

    if users:
        cursor.executemany('''
            INSERT INTO users (username, nickname, password, avatar, phone, email, location, lat, lng, is_admin, created_at, rating, help_count, request_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', users)
    
    # 插入测试需求 - 包含详细地址和经纬度坐标，便于计算距离
    # 坐标基于北京市朝阳区各位置
    # 注意：初始化为空列表，不插入测试数据
    requests = []
    
    if requests:
        cursor.executemany('''
            INSERT INTO requests (user_id, title, description, category, location, address, lat, lng, reward, status, created_at, completed_at, helper_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', requests)
    
    # 插入测试评论
    comments = []
    
    if comments:
        cursor.executemany('''
            INSERT INTO comments (request_id, user_id, content, created_at)
            VALUES (?, ?, ?, ?)
        ''', comments)
    
    # 插入帮助记录
    help_records = []
    
    if help_records:
        cursor.executemany('''
        INSERT INTO help_records (request_id, helper_id, status, created_at, completed_at, rating, review)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', help_records)
    
    conn.commit()
    conn.close()
    
    # 初始化平台账户
    init_platform_account()
    
    print("测试数据插入完成！")

def init_platform_account():
    """
    初始化平台账户
    创建平台用户和对应的钱包
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 检查平台用户是否已存在
        cursor.execute("SELECT id FROM users WHERE username = 'platform' LIMIT 1")
        platform_user = cursor.fetchone()
        
        if not platform_user:
            # 创建平台用户
            platform_password = 'platform123456'
            password_hash = bcrypt.hashpw(platform_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            cursor.execute('''
                INSERT INTO users (username, nickname, password, avatar, location)
                VALUES (?, ?, ?, ?, ?)
            ''', ('platform', '平台账户', password_hash, 'https://api.dicebear.com/7.x/avataaars/svg?seed=platform', '系统'))
            
            platform_user_id = cursor.lastrowid
            print(f"创建平台用户成功，ID: {platform_user_id}")
        else:
            platform_user_id = platform_user[0]
            print(f"平台用户已存在，ID: {platform_user_id}")
        
        # 检查平台钱包是否已存在
        cursor.execute("SELECT id FROM wallets WHERE user_id = ? LIMIT 1", (platform_user_id,))
        platform_wallet = cursor.fetchone()
        
        if not platform_wallet:
            # 创建平台钱包
            cursor.execute('''
                INSERT INTO wallets (user_id, balance, frozen_amount)
                VALUES (?, ?, ?)
            ''', (platform_user_id, 0.00, 0.00))
            
            platform_wallet_id = cursor.lastrowid
            print(f"创建平台钱包成功，ID: {platform_wallet_id}")
        else:
            platform_wallet_id = platform_wallet[0]
            print(f"平台钱包已存在，ID: {platform_wallet_id}")
        
        conn.commit()
        print("平台账户初始化完成")
        
    except Exception as e:
        print(f"初始化平台账户失败: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    init_database()
    insert_test_data()
