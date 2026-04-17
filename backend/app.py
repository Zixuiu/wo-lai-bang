from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_compress import Compress
from werkzeug.utils import secure_filename
from PIL import Image
import sys
import os
import re
import logging
import random
import string
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from functools import wraps
from dotenv import load_dotenv
import bcrypt
import uuid
import io
import time
import gzip

# 登录失败配置
LOGIN_MAX_FAILURES = 5
LOGIN_LOCK_MINUTES = 15

def check_password_strength(password):
    """
    检查密码强度，返回 (is_valid, message, strength)
    strength: 0=弱, 1=中等, 2=强
    """
    if len(password) < 6:
        return False, '密码至少6个字符', 0
    
    has_lower = re.search(r'[a-z]', password) is not None
    has_upper = re.search(r'[A-Z]', password) is not None
    has_digit = re.search(r'\d', password) is not None
    has_special = re.search(r'[!@#$%^&*(),.?":{}|<>]', password) is not None
    
    score = sum([has_lower, has_upper, has_digit, has_special])
    
    if len(password) >= 8 and score >= 3:
        return True, '密码强度良好', 2
    elif len(password) >= 6 and score >= 2:
        return True, '密码强度一般', 1
    else:
        return False, '密码需包含字母和数字', 0

def check_login_locked(identifier):
    """检查账号是否被锁定"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT fail_count, locked_until FROM login_failures WHERE identifier = ?',
        (identifier,)
    )
    result = cursor.fetchone()
    conn.close()
    
    if result:
        fail_count, locked_until = result[0], result[1]
        if locked_until:
            locked_time = datetime.fromisoformat(locked_until.replace('Z', '+00:00'))
            if datetime.now() < locked_time:
                remaining = (locked_time - datetime.now()).seconds // 60
                return True, f'登录尝试过多，请{remaining}分钟后再试'
            else:
                # 锁定时间已过，解锁
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute('DELETE FROM login_failures WHERE identifier = ?', (identifier,))
                conn.commit()
                conn.close()
        if fail_count >= LOGIN_MAX_FAILURES:
            return True, f'登录失败次数过多，账号已锁定{LOGIN_LOCK_MINUTES}分钟'
    return False, None

def record_login_failure(identifier):
    """记录登录失败"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        'SELECT fail_count FROM login_failures WHERE identifier = ?',
        (identifier,)
    )
    result = cursor.fetchone()
    
    if result:
        fail_count = result[0] + 1
        if fail_count >= LOGIN_MAX_FAILURES:
            locked_until = datetime.now() + timedelta(minutes=LOGIN_LOCK_MINUTES)
            cursor.execute(
                'UPDATE login_failures SET fail_count = ?, last_fail_at = datetime("now"), locked_until = ? WHERE identifier = ?',
                (fail_count, locked_until.isoformat(), identifier)
            )
        else:
            cursor.execute(
                'UPDATE login_failures SET fail_count = ?, last_fail_at = datetime("now") WHERE identifier = ?',
                (fail_count, identifier)
            )
    else:
        cursor.execute(
            'INSERT INTO login_failures (identifier, fail_count, last_fail_at) VALUES (?, 1, datetime("now"))',
            (identifier,)
        )
    
    conn.commit()
    conn.close()

def clear_login_failure(identifier):
    """清除登录失败记录（登录成功时调用）"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM login_failures WHERE identifier = ?', (identifier,))
    conn.commit()
    conn.close()

from datetime import timedelta

# 加载环境变量
load_dotenv()

# 验证码数据库操作函数
def save_verification_code(email, code, expires):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT OR REPLACE INTO verification_codes (email, code, expires, created_at) VALUES (?, ?, ?, datetime("now"))', (email, code, expires))
    conn.commit()
    conn.close()

def get_verification_code(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT code, expires FROM verification_codes WHERE email = ?', (email,))
    result = cursor.fetchone()
    conn.close()
    if result:
        return {'code': result[0], 'expires': result[1]}
    return None

def delete_verification_code(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM verification_codes WHERE email = ?', (email,))
    conn.commit()
    conn.close()

def cleanup_expired_codes():
    import time
    current_time = int(time.time())
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM verification_codes WHERE expires < ?', (current_time,))
    conn.commit()
    conn.close()

# 邮件配置
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.qq.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USERNAME = os.getenv('SMTP_USERNAME', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_USE_TLS = os.getenv('SMTP_USE_TLS', 'True').lower() == 'true'
EMAIL_FROM = os.getenv('EMAIL_FROM', SMTP_USERNAME)
EMAIL_FROM_NAME = os.getenv('EMAIL_FROM_NAME', '我来帮')

# 添加模型路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from models.database import get_db_connection, init_database, insert_test_data, calculate_distance, migrate_database
from models.payment import PaymentManager, WalletManager, WithdrawalManager
from datetime import datetime

PLATFORM_USER_ID_CACHE = None

def get_platform_user_id():
    """获取平台账户ID，如果不存在则返回1"""
    global PLATFORM_USER_ID_CACHE
    if PLATFORM_USER_ID_CACHE is not None:
        return PLATFORM_USER_ID_CACHE
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username = 'platform' LIMIT 1")
    result = cursor.fetchone()
    conn.close()
    
    if result:
        PLATFORM_USER_ID_CACHE = result[0]
    else:
        PLATFORM_USER_ID_CACHE = 1
    
    return PLATFORM_USER_ID_CACHE

# Flask-SocketIO 用于 WebSocket

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static')
CORS(app, origins='*',
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'])

# 启用 Gzip 压缩
app.config['COMPRESS_MIMETYPES'] = [
    'text/html', 'text/css', 'text/xml', 'application/json',
    'application/javascript', 'text/javascript', 'application/xml'
]
app.config['COMPRESS_LEVEL'] = 6  # 压缩级别 1-9，6是平衡值
app.config['COMPRESS_MIN_SIZE'] = 500  # 小于500字节不压缩
Compress(app)

# 文件上传配置
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
AVATAR_FOLDER = os.path.join(UPLOAD_FOLDER, 'avatars')
REQUEST_IMAGES_FOLDER = os.path.join(UPLOAD_FOLDER, 'request_images')

# 创建上传目录
os.makedirs(AVATAR_FOLDER, exist_ok=True)
os.makedirs(REQUEST_IMAGES_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 最大16MB

# 允许的图片格式
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def compress_image(image_file, max_size=(800, 800), quality=85):
    """
    压缩图片
    :param image_file: 图片文件对象
    :param max_size: 最大尺寸 (宽, 高)
    :param quality: JPEG质量 (1-95)
    :return: 压缩后的BytesIO对象
    """
    img = Image.open(image_file)

    # 转换为RGB模式（处理PNG透明背景等）
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    # 调整图片大小
    img.thumbnail(max_size, Image.Resampling.LANCZOS)

    # 保存到内存
    output = io.BytesIO()
    img.save(output, format='JPEG', quality=quality, optimize=True)
    output.seek(0)

    return output

# JWT配置
jwt_key_file = os.path.join(os.path.dirname(__file__), '.jwt_secret_key')

jwt_secret_key = os.getenv('JWT_SECRET_KEY')
if not jwt_secret_key:
    if os.path.exists(jwt_key_file):
        with open(jwt_key_file, 'r') as f:
            jwt_secret_key = f.read().strip()
    else:
        import secrets
        jwt_secret_key = secrets.token_hex(32)
        with open(jwt_key_file, 'w') as f:
            f.write(jwt_secret_key)
        logger.warning('JWT_SECRET_KEY未设置，已生成随机密钥并保存。生产环境请在.env文件中设置JWT_SECRET_KEY')

app.config['JWT_SECRET_KEY'] = jwt_secret_key
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 604800))  # 7天
jwt = JWTManager(app)

# 自定义JWT错误处理
@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({'success': False, 'message': '无效的token'}), 422

@jwt.unauthorized_loader
def unauthorized_callback(error):
    return jsonify({'success': False, 'message': '缺少token或token无效'}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'success': False, 'message': 'token已过期'}), 401

# 初始化 SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# 在线用户管理
online_users = {}  # {user_id: sid}
user_rooms = {}    # {user_id: [room1, room2, ...]}

# 上下文管理器优化数据库连接
class DatabaseConnection:
    """数据库连接上下文管理器"""
    def __enter__(self):
        self.conn = get_db_connection()
        self.cursor = self.conn.cursor()
        return self.cursor
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.conn.rollback()
            logger.error(f"数据库错误: {exc_val}")
        else:
            self.conn.commit()
        self.conn.close()
        return False

# 管理员权限检查装饰器
def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        user_id = get_jwt_identity()
        with DatabaseConnection() as cursor:
            cursor.execute('SELECT is_admin FROM users WHERE id = ?', (user_id,))
            user = cursor.fetchone()
            if not user or not user[0]:
                return jsonify({'success': False, 'message': '权限不足'}), 403
        return f(*args, **kwargs)
    return decorated_function

# 统一错误处理装饰器
def handle_errors(f):
    """统一错误处理装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"接口错误 {request.endpoint}: {str(e)}", exc_info=True)
            return jsonify({
                'success': False,
                'message': '服务器内部错误',
                'error': str(e) if app.debug else None
            }), 500
    return decorated_function

# 常量配置
MAX_TITLE_LENGTH = 100
MAX_DESCRIPTION_LENGTH = 1000
MAX_ADDRESS_LENGTH = 200
ALLOWED_CATEGORIES = ['搬运', '教育', '技术', '宠物', '维修', '跑腿', '健康', '设计', '借用', '摄影', '其他']

# 输入验证函数
def validate_request_data(data):
    """验证请求数据"""
    errors = {}
    
    # 验证标题
    title = data.get('title', '').strip()
    if not title:
        errors['title'] = '标题不能为空'
    elif len(title) > MAX_TITLE_LENGTH:
        errors['title'] = f'标题长度不能超过{MAX_TITLE_LENGTH}字'
    
    # 验证描述
    description = data.get('description', '').strip()
    if not description:
        errors['description'] = '描述不能为空'
    elif len(description) > MAX_DESCRIPTION_LENGTH:
        errors['description'] = f'描述长度不能超过{MAX_DESCRIPTION_LENGTH}字'
    
    # 验证类别
    category = data.get('category', '')
    if not category:
        errors['category'] = '请选择需求类别'
    # 暂时跳过类别验证
    # elif category not in ALLOWED_CATEGORIES:
    #     # 添加调试信息
    #     logger.info(f"接收到的category: '{category}'")
    #     logger.info(f"ALLOWED_CATEGORIES: {ALLOWED_CATEGORIES}")
    #     errors['category'] = '无效的需求类别'
    
    # 验证地址长度
    address = data.get('address', '')
    if len(address) > MAX_ADDRESS_LENGTH:
        errors['address'] = f'地址长度不能超过{MAX_ADDRESS_LENGTH}字'
    
    # 验证经纬度
    lat = data.get('lat')
    lng = data.get('lng')
    if lat is not None and not isinstance(lat, (int, float)):
        errors['lat'] = '纬度格式错误'
    if lng is not None and not isinstance(lng, (int, float)):
        errors['lng'] = '经度格式错误'
    
    return errors

def sanitize_input(text):
    """清理用户输入，防止 XSS"""
    if not text:
        return text
    # 移除 HTML 标签
    text = re.sub(r'<[^>]+>', '', text)
    # 转义特殊字符
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    text = text.replace('"', '&quot;').replace("'", '&#x27;')
    return text.strip()

# 简单的内存限流器
class RateLimiter:
    """API 限流器"""
    def __init__(self, max_requests=100, window_seconds=60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = {}  # {ip: [(timestamp, count), ...]}
    
    def _cleanup_expired(self):
        """清理所有过期记录"""
        now = datetime.now().timestamp()
        expired_ips = [
            ip for ip, records in self.requests.items()
            if not any(now - ts < self.window_seconds for ts, count in records)
        ]
        for ip in expired_ips:
            del self.requests[ip]
    
    def is_allowed(self, ip):
        """检查是否允许请求"""
        now = datetime.now().timestamp()
        
        # 10%概率触发全量清理
        if hash(ip) % 10 == 0:
            self._cleanup_expired()
        
        # 清理过期的记录
        if ip in self.requests:
            self.requests[ip] = [
                (ts, count) for ts, count in self.requests[ip]
                if now - ts < self.window_seconds
            ]
        
        # 计算当前窗口内的请求数
        if ip not in self.requests:
            self.requests[ip] = []
        
        total_requests = sum(count for ts, count in self.requests[ip])
        
        if total_requests >= self.max_requests:
            return False
        
        # 记录本次请求
        if self.requests[ip] and now - self.requests[ip][-1][0] < 1:
            # 同一秒内，增加计数
            self.requests[ip][-1] = (self.requests[ip][-1][0], self.requests[ip][-1][1] + 1)
        else:
            self.requests[ip].append((now, 1))
        
        return True
    
    def get_remaining(self, ip):
        """获取剩余请求次数"""
        now = datetime.now().timestamp()
        
        if ip not in self.requests:
            return self.max_requests
        
        # 清理过期记录
        self.requests[ip] = [
            (ts, count) for ts, count in self.requests[ip]
            if now - ts < self.window_seconds
        ]
        
        total_requests = sum(count for ts, count in self.requests[ip])
        return max(0, self.max_requests - total_requests)

# 创建限流器实例
rate_limiter = RateLimiter(max_requests=100, window_seconds=60)

# 限流装饰器
def rate_limit(f):
    """限流装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        
        if not rate_limiter.is_allowed(ip):
            logger.warning(f"IP {ip} 触发限流")
            return jsonify({
                'success': False,
                'message': '请求过于频繁，请稍后再试',
                'retry_after': 60
            }), 429
        
        # 添加限流信息到响应头
        response = f(*args, **kwargs)
        if isinstance(response, tuple):
            response_obj = response[0]
        else:
            response_obj = response
        
        if hasattr(response_obj, 'headers'):
            response_obj.headers['X-RateLimit-Limit'] = str(rate_limiter.max_requests)
            response_obj.headers['X-RateLimit-Remaining'] = str(rate_limiter.get_remaining(ip))
        
        return response
    return decorated_function

# 初始化数据库
@app.before_request
def setup():
    if not hasattr(app, '_initialized'):
        init_database()
        migrate_database()
        insert_test_data()
        app._initialized = True

# 获取单个需求详情
@app.route('/api/requests/<int:request_id>', methods=['GET'])
@rate_limit
@handle_errors
def get_request_detail(request_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 获取需求信息
        cursor.execute('''
            SELECT r.*, u.nickname as user_nickname, u.avatar as user_avatar, u.rating as user_rating
            FROM requests r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        ''', (request_id,))
        
        request_data = cursor.fetchone()
        if not request_data:
            return jsonify({'success': False, 'message': '需求不存在'}), 404
        
        request_data = dict(request_data)
        
        # 获取评论
        cursor.execute('''
            SELECT c.*, u.nickname as user_nickname, u.avatar as user_avatar
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.request_id = ?
            ORDER BY c.created_at DESC
        ''', (request_id,))
        
        comments = [dict(row) for row in cursor.fetchall()]
        request_data['comments'] = comments
        
        # 获取帮助者信息
        if request_data['helper_id']:
            cursor.execute('SELECT nickname, avatar, payment_qr_code, payment_qr_type FROM users WHERE id = ?', (request_data['helper_id'],))
            helper = cursor.fetchone()
            if helper:
                request_data['helper'] = dict(helper)
        
        return jsonify({'success': True, 'data': request_data})
    finally:
        conn.close()

# 发布需求
@app.route('/api/transaction', methods=['POST'])
@jwt_required()
def create_transaction():
    """创建交易，支持不同类型的交易"""
    data = request.get_json()
    amount = data.get('amount', 0)
    transaction_type = data.get('type', 'transfer')  # 交易类型：recharge, withdraw, task_payment, task_income, transfer
    related_id = data.get('related_id')  # 关联ID，如任务ID
    related_type = data.get('related_type')  # 关联类型，如request
    description = data.get('description', '')  # 交易描述
    
    user_id = get_jwt_identity()
    
    # 验证交易类型
    valid_types = ['recharge', 'withdraw', 'task_payment', 'task_income', 'transfer']
    if transaction_type not in valid_types:
        return jsonify({'success': False, 'message': '无效的交易类型'}), 400
    
    # 计算抽成（仅对任务相关交易）
    commission = 0.0
    if transaction_type in ['task_payment', 'task_income']:
        commission = amount * 0.05  # 5%抽成
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 开始事务（使用IMMEDIATE获取写锁，防止并发问题）
        conn.execute('BEGIN IMMEDIATE TRANSACTION')
        
        # 1. 记录交易
        cursor.execute('''
            INSERT INTO transactions (user_id, amount, commission, status, type, related_id, related_type, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id, 
            amount, 
            commission, 
            'pending',  # 初始状态为待处理
            transaction_type, 
            related_id, 
            related_type, 
            description, 
            datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        ))
        
        transaction_id = cursor.lastrowid
        
        # 2. 根据交易类型执行不同的逻辑
        if transaction_type == 'recharge':
            # 充值逻辑
            # 检查用户钱包
            cursor.execute('SELECT id, balance FROM wallets WHERE user_id = ?', (user_id,))
            wallet = cursor.fetchone()
            if not wallet:
                # 创建钱包
                cursor.execute('INSERT INTO wallets (user_id, balance, frozen_amount) VALUES (?, ?, ?)', (user_id, 0.0, 0.0))
                wallet_id = cursor.lastrowid
                current_balance = 0.0
            else:
                wallet_id, current_balance = wallet
            
            # 更新余额
            new_balance = current_balance + amount
            cursor.execute('UPDATE wallets SET balance = ?, updated_at = ? WHERE user_id = ?', 
                         (new_balance, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user_id))
            
            # 记录钱包交易
            cursor.execute('''
                INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance_after, related_id, related_type, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                wallet_id,
                user_id,
                'recharge',
                amount,
                new_balance,
                transaction_id,
                'transaction',
                f'充值 {amount} 元'
            ))
            
            # 更新交易状态
            cursor.execute('UPDATE transactions SET status = ? WHERE id = ?', ('completed', transaction_id))
            
        elif transaction_type == 'withdraw':
            # 提现逻辑
            # 检查用户钱包
            cursor.execute('SELECT id, balance FROM wallets WHERE user_id = ?', (user_id,))
            wallet = cursor.fetchone()
            if not wallet:
                conn.rollback()
                conn.close()
                return jsonify({'success': False, 'message': '钱包不存在'}), 400
            
            wallet_id, current_balance = wallet
            
            # 检查余额
            if current_balance < amount:
                conn.rollback()
                conn.close()
                return jsonify({'success': False, 'message': '余额不足'}), 400
            
            # 更新余额
            new_balance = current_balance - amount
            cursor.execute('UPDATE wallets SET balance = ?, updated_at = ? WHERE user_id = ?', 
                         (new_balance, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user_id))
            
            # 记录钱包交易
            cursor.execute('''
                INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance_after, related_id, related_type, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                wallet_id,
                user_id,
                'withdraw',
                -amount,
                new_balance,
                transaction_id,
                'transaction',
                f'提现 {amount} 元'
            ))
            
            # 记录提现申请
            cursor.execute('''
                INSERT INTO withdrawals (user_id, amount, status, withdrawal_method, account_info, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                amount,
                'pending',
                data.get('method', 'bank'),
                data.get('account_info', ''),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ))
            
            # 更新交易状态
            cursor.execute('UPDATE transactions SET status = ? WHERE id = ?', ('completed', transaction_id))
        
        # 提交事务
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': '交易成功',
            'data': {
                'transaction_id': transaction_id,
                'amount': amount,
                'commission': commission,
                'type': transaction_type,
                'status': 'completed'
            }
        })
        
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        logger.error(f"创建交易错误: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'}), 500

@app.route('/api/ads', methods=['GET'])
def get_advertisements():
    """获取广告列表"""
    with DatabaseConnection() as cursor:
        cursor.execute('SELECT * FROM ads WHERE status = ? ORDER BY priority DESC', ('active',))
        ads = cursor.fetchall()
    
    return jsonify({
        'success': True,
        'data': [dict(ad) for ad in ads]
    })

@app.route('/api/requests', methods=['POST'])
@jwt_required()
@rate_limit
@handle_errors
def create_request():
    data = request.json
    
    # 从JWT token获取用户ID
    user_id = get_jwt_identity()
    
    # 输入验证
    errors = validate_request_data(data)
    if errors:
        return jsonify({'success': False, 'errors': errors}), 400
    
    # 清理输入，防止 XSS
    title = sanitize_input(data.get('title', ''))
    description = sanitize_input(data.get('description', ''))
    address = sanitize_input(data.get('address', ''))
    location = sanitize_input(data.get('location', ''))
    
    reward = data.get('reward', '')
    
    # 解析报酬金额
    amount = 0.0
    if reward:
        import re
        amount_match = re.search(r'\d+(\.\d+)?', reward)
        if amount_match:
            amount = float(amount_match.group())
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        conn.execute('BEGIN IMMEDIATE TRANSACTION')
        
        request_status = 'pending'
        
        # 处理技能标签
        skills = data.get('skills', '')
        if skills:
            # 清理并格式化技能标签
            skill_list = [s.strip() for s in skills.split(',') if s.strip()]
            skills = ','.join(skill_list)
        
        cursor.execute('''
            INSERT INTO requests (user_id, title, description, category, location, address, lat, lng, reward, status, is_urgent, urgent_type, created_at, need_photo_verify, deposit_amount, start_time, deadline, skills)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            title,
            description,
            data.get('category', '其他'),
            location,
            address,
            data.get('lat'),
            data.get('lng'),
            reward,
            request_status,
            1 if data.get('is_urgent') else 0,
            data.get('urgent_type'),
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            1 if data.get('need_photo_verify') else 0,
            float(data.get('deposit_amount', 0)),
            data.get('start_time'),
            data.get('deadline'),
            skills
        ))
        
        new_request_id = cursor.lastrowid
        
        conn.commit()
        
        # 技能标签匹配通知
        if skills:
            try:
                notify_matching_skills(skills, new_request_id, title)
            except Exception as e:
                logger.error(f"技能匹配通知失败: {str(e)}")
        
        return jsonify({'success': True, 'message': '需求发布成功', 'data': {'id': new_request_id}})
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        logger.error(f"发布需求错误: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'}), 500


# 更新接单人状态（出发/到达）
@app.route('/api/requests/<int:request_id>/helper_status', methods=['POST'])
@jwt_required()
def update_helper_status(request_id):
    data = request.json
    helper_status = data.get('status')  # 'departed' or 'arrived'
    
    if helper_status not in ['departed', 'arrived']:
        return jsonify({'success': False, 'message': '无效的状态'}), 400
    
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT helper_id, status FROM requests WHERE id = ?', (request_id,))
    request_info = cursor.fetchone()
    
    if not request_info:
        conn.close()
        return jsonify({'success': False, 'message': '需求不存在'}), 404
    
    helper_id, status = request_info
    
    # 将两者都转换为整数进行比较
    if int(helper_id) != int(user_id):
        conn.close()
        return jsonify({'success': False, 'message': '只有接单人可以更新状态'}), 403
    
    if status != 'accepted':
        conn.close()
        return jsonify({'success': False, 'message': '需求不是进行中状态'}), 400
    
    cursor.execute('UPDATE requests SET helper_status = ? WHERE id = ?', (helper_status, request_id))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': '状态已更新', 'helper_status': helper_status})

# 接单人标记完成（等待发布者确认）
@app.route('/api/requests/<int:request_id>/mark_complete', methods=['POST'])
@jwt_required()
def mark_request_complete(request_id):
    user_id = get_jwt_identity()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('SELECT user_id, helper_id, status, title FROM requests WHERE id = ?', (request_id,))
        request_info = cursor.fetchone()
        if not request_info:
            conn.close()
            return jsonify({'success': False, 'message': '需求不存在'}), 404
        
        user_id_db, helper_id, status, title = request_info
        
        # 将两者都转换为整数进行比较
        if int(helper_id) != int(user_id):
            conn.close()
            return jsonify({'success': False, 'message': '只有接单人可以标记完成'}), 403
        
        if status != 'accepted':
            conn.close()
            return jsonify({'success': False, 'message': '只有进行中的任务才能标记完成'}), 400
        
        cursor.execute('''
            UPDATE requests SET helper_completed = 1, helper_completed_at = ? WHERE id = ?
        ''', (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), request_id))
        
        create_notification(user_id_db, 'helper_completed', '接单人已标记完成', f'接单人已标记任务「{title}」完成，请确认并支付报酬', request_id, 'request')
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '已标记完成，等待发布者确认'})
        
    except Exception as e:
        conn.close()
        logger.error(f"标记完成错误: {str(e)}")
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'}), 500

# 发单方改价
@app.route('/api/requests/<int:request_id>/change_reward', methods=['POST'])
@jwt_required()
def change_reward(request_id):
    data = request.json
    new_reward = data.get('reward')
    
    if not new_reward:
        return jsonify({'success': False, 'message': '请输入新的报酬'}), 400
    
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        conn.execute('BEGIN IMMEDIATE TRANSACTION')
        
        cursor.execute('SELECT user_id, status, reward FROM requests WHERE id = ?', (request_id,))
        request_info = cursor.fetchone()
        
        if not request_info:
            return jsonify({'success': False, 'message': '需求不存在'}), 404
        
        owner_id, status, old_reward = request_info
        
        if owner_id != user_id:
            return jsonify({'success': False, 'message': '只有发布者可以修改报酬'}), 403
        
        if status != 'pending':
            return jsonify({'success': False, 'message': '只有待接单状态可以修改报酬'}), 400
        
        import re
        old_amount = 0.0
        if old_reward:
            amount_match = re.search(r'\d+(\.\d+)?', old_reward)
            if amount_match:
                old_amount = float(amount_match.group())
        
        new_amount = 0.0
        amount_match = re.search(r'\d+(\.\d+)?', new_reward)
        if amount_match:
            new_amount = float(amount_match.group())
        
        if new_amount < old_amount:
            return jsonify({'success': False, 'message': '新报酬不能低于原报酬'}), 400
        
        diff_amount = new_amount - old_amount
        
        if diff_amount > 0:
            cursor.execute('SELECT balance FROM wallets WHERE user_id = ?', (user_id,))
            wallet = cursor.fetchone()
            if not wallet or wallet[0] < diff_amount:
                return jsonify({'success': False, 'message': '余额不足'}), 400
            
            cursor.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', (diff_amount, user_id))
            cursor.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', (diff_amount, get_platform_user_id()))
        
        cursor.execute('UPDATE requests SET reward = ? WHERE id = ?', (new_reward, request_id))
        conn.commit()
        
        return jsonify({'success': True, 'message': '报酬已修改', 'reward': new_reward})
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        logger.error(f"修改报酬错误: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'}), 500

# 发单方取消发布
@app.route('/api/requests/<int:request_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_request(request_id):
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        conn.execute('BEGIN IMMEDIATE TRANSACTION')
        
        cursor.execute('SELECT user_id, status, reward, helper_id FROM requests WHERE id = ?', (request_id,))
        request_info = cursor.fetchone()
        
        if not request_info:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '需求不存在'}), 404
        
        owner_id, status, reward, helper_id = request_info
        
        if owner_id != user_id:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '只有发布者可以取消'}), 403
        
        if status == 'completed':
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '已完成的需求不能取消'}), 400
        
        if status in ['pending', 'accepted']:
            import re
            amount = 0.0
            if reward:
                amount_match = re.search(r'\d+(\.\d+)?', reward)
                if amount_match:
                    amount = float(amount_match.group())
            
            if amount > 0:
                cursor.execute('SELECT balance FROM wallets WHERE user_id = ?', (get_platform_user_id(),))
                platform_balance = cursor.fetchone()
                if not platform_balance or platform_balance[0] < amount:
                    conn.rollback()
                    conn.close()
                    return jsonify({'success': False, 'message': '平台余额不足，无法退款'}), 400
                
                cursor.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', (amount, user_id))
                cursor.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', (amount, get_platform_user_id()))
        
        cursor.execute('UPDATE requests SET status = ? WHERE id = ?', ('cancelled', request_id))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '需求已取消'})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'}), 500

# 举手抢单（加入候选人列表）
@app.route('/api/requests/<int:request_id>/raise_hand', methods=['POST'])
@jwt_required()
def raise_hand(request_id):
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT user_id, status, helper_id FROM requests WHERE id = ?', (request_id,))
    request_info = cursor.fetchone()
    
    if not request_info:
        conn.close()
        return jsonify({'success': False, 'message': '需求不存在'}), 404
    
    owner_id, status, helper_id = request_info
    
    if status not in ['pending', 'accepted']:
        conn.close()
        return jsonify({'success': False, 'message': '只有待接单或已接受的需求可以举手'}), 400
    
    if helper_id and helper_id == user_id:
        conn.close()
        return jsonify({'success': False, 'message': '你已经是接单人了'}), 400
    
    if owner_id == user_id:
        conn.close()
        return jsonify({'success': False, 'message': '发布者不能举手'}), 400
    
    cursor.execute('SELECT id FROM help_records WHERE request_id = ? AND helper_id = ?', (request_id, user_id))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('UPDATE help_records SET is_candidate = 1 WHERE request_id = ? AND helper_id = ?', (request_id, user_id))
    else:
        record_status = 'accepted' if status == 'accepted' else 'pending'
        cursor.execute('INSERT INTO help_records (request_id, helper_id, status, is_candidate, created_at) VALUES (?, ?, ?, 1, datetime("now"))', (request_id, user_id, record_status))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': '举手成功，等待发单方确认'})

# 获取候选人列表
@app.route('/api/requests/<int:request_id>/candidates', methods=['GET'])
@jwt_required()
def get_candidates(request_id):
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT user_id FROM requests WHERE id = ?', (request_id,))
    request_info = cursor.fetchone()
    
    if not request_info:
        conn.close()
        return jsonify({'success': False, 'message': '需求不存在'}), 404
    
    owner_id = request_info[0]
    
    if owner_id != user_id:
        conn.close()
        return jsonify({'success': False, 'message': '只有发布者可以查看候选人'}), 403
    
    cursor.execute('''
        SELECT h.id, h.helper_id, h.is_candidate, h.created_at, u.username, u.nickname, u.avatar, u.rating, u.help_count
        FROM help_records h
        JOIN users u ON h.helper_id = u.id
        WHERE h.request_id = ? AND h.is_candidate = 1
        ORDER BY h.created_at DESC
    ''', (request_id,))
    
    candidates = cursor.fetchall()
    conn.close()
    
    candidate_list = []
    for c in candidates:
        candidate_list.append({
            'id': c[0],
            'helper_id': c[1],
            'is_candidate': c[2],
            'raised_at': c[3],
            'username': c[4],
            'nickname': c[5],
            'avatar': c[6],
            'rating': c[7] or 0,
            'help_count': c[8] or 0
        })
    
    return jsonify({'success': True, 'data': candidate_list})

# 发单方换人
@app.route('/api/requests/<int:request_id>/reassign', methods=['POST'])
@jwt_required()
def reassign_helper(request_id):
    user_id = get_jwt_identity()
    data = request.json
    new_helper_id = data.get('new_helper_id')
    
    if not new_helper_id:
        return jsonify({'success': False, 'message': '缺少新接单人ID'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT user_id, status, helper_id FROM requests WHERE id = ?', (request_id,))
    request_info = cursor.fetchone()
    
    if not request_info:
        conn.close()
        return jsonify({'success': False, 'message': '需求不存在'}), 404
    
    owner_id, status, helper_id = request_info
    
    if owner_id != user_id:
        conn.close()
        return jsonify({'success': False, 'message': '只有发布者可以换人'}), 403
    
    if status not in ['pending', 'accepted']:
        conn.close()
        return jsonify({'success': False, 'message': '该状态无法换人'}), 400
    
    if not helper_id:
        conn.close()
        return jsonify({'success': False, 'message': '还没有接单人'}), 400
    
    if helper_id == new_helper_id:
        conn.close()
        return jsonify({'success': False, 'message': '已经是该接单人了'}), 400
    
    cursor.execute('UPDATE requests SET helper_id = ? WHERE id = ?', (new_helper_id, request_id))
    cursor.execute('UPDATE help_records SET helper_id = ? WHERE request_id = ? AND helper_id = ?', (new_helper_id, request_id, helper_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': '换人成功'})

# 支付押金
@app.route('/api/requests/<int:request_id>/pay_deposit', methods=['POST'])
@jwt_required()
def pay_deposit(request_id):
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        conn.execute('BEGIN IMMEDIATE TRANSACTION')
        
        cursor.execute('SELECT user_id, status, deposit_amount, deposit_paid FROM requests WHERE id = ?', (request_id,))
        request_info = cursor.fetchone()
        
        if not request_info:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '需求不存在'}), 404
        
        owner_id, status, deposit_amount, deposit_paid = request_info
        
        if owner_id != user_id:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '只有发布者可以支付押金'}), 403
        
        if deposit_amount <= 0:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '此需求不需要押金'}), 400
        
        if deposit_paid:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '押金已支付'}), 400
        
        cursor.execute('SELECT balance FROM wallets WHERE user_id = ?', (user_id,))
        wallet = cursor.fetchone()
        if not wallet or wallet[0] < deposit_amount:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '余额不足'}), 400
        
        cursor.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', (deposit_amount, user_id))
        cursor.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', (deposit_amount, get_platform_user_id()))
        cursor.execute('UPDATE requests SET deposit_paid = 1 WHERE id = ?', (request_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '押金已支付', 'deposit_amount': deposit_amount})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'}), 500

# 退还押金
@app.route('/api/requests/<int:request_id>/refund_deposit', methods=['POST'])
@jwt_required()
def refund_deposit(request_id):
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        conn.execute('BEGIN IMMEDIATE TRANSACTION')
        
        cursor.execute('SELECT user_id, status, deposit_amount, deposit_paid, deposit_refunded FROM requests WHERE id = ?', (request_id,))
        request_info = cursor.fetchone()
        
        if not request_info:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '需求不存在'}), 404
        
        owner_id, status, deposit_amount, deposit_paid, deposit_refunded = request_info
        
        if owner_id != user_id:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '只有发布者可以退还押金'}), 403
        
        if not deposit_paid:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '押金未支付'}), 400
        
        if deposit_refunded:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '押金已退还'}), 400
        
        if deposit_amount <= 0:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '此需求不需要押金'}), 400
        
        if status not in ['completed', 'cancelled']:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '任务未完成或未取消，无法退还押金'}), 400
        
        cursor.execute('SELECT balance FROM wallets WHERE user_id = ?', (get_platform_user_id(),))
        platform_balance = cursor.fetchone()
        if not platform_balance or platform_balance[0] < deposit_amount:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '平台余额不足'}), 400
        
        cursor.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', (deposit_amount, user_id))
        cursor.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', (deposit_amount, get_platform_user_id()))
        cursor.execute('UPDATE requests SET deposit_refunded = 1 WHERE id = ?', (request_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '押金已退还', 'deposit_amount': deposit_amount})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'}), 500

# 添加评论
@app.route('/api/requests/<int:request_id>/comments', methods=['POST'])
@jwt_required()
def add_comment(request_id):
    data = request.json
    user_id = get_jwt_identity()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO comments (request_id, user_id, content, created_at)
        VALUES (?, ?, ?, ?)
    ''', (
        request_id,
        user_id,
        data['content'],
        datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    ))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': '评论添加成功'})

# 上传需求图片
@app.route('/api/requests/<int:request_id>/images', methods=['POST'])
@jwt_required()
def upload_request_images(request_id):
    """
    上传需求相关图片
    支持格式: png, jpg, jpeg, gif, webp
    最大文件大小: 16MB
    一次最多上传5张图片
    """
    user_id = get_jwt_identity()

    # 检查需求是否存在且属于当前用户
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT user_id FROM requests WHERE id = ?', (request_id,))
    request_data = cursor.fetchone()

    if not request_data:
        conn.close()
        return jsonify({'success': False, 'message': '需求不存在'}), 404

    if request_data[0] != user_id:
        conn.close()
        return jsonify({'success': False, 'message': '无权为此需求上传图片'}), 403

    # 检查是否有文件
    if 'images' not in request.files:
        return jsonify({'success': False, 'message': '请选择要上传的图片'}), 400

    files = request.files.getlist('images')

    if not files or files[0].filename == '':
        return jsonify({'success': False, 'message': '请选择要上传的图片'}), 400

    if len(files) > 5:
        return jsonify({'success': False, 'message': '一次最多上传5张图片'}), 400

    uploaded_images = []

    try:
        for file in files:
            # 检查文件类型
            if not allowed_file(file.filename):
                continue

            # 生成唯一文件名
            file_ext = file.filename.rsplit('.', 1)[1].lower()
            unique_filename = f"request_{request_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
            filepath = os.path.join(REQUEST_IMAGES_FOLDER, unique_filename)

            # 压缩并保存图片
            compressed_image = compress_image(file, max_size=(1200, 1200), quality=85)
            with open(filepath, 'wb') as f:
                f.write(compressed_image.read())

            # 保存到数据库
            image_url = f"/uploads/request_images/{unique_filename}"
            cursor.execute('''
                INSERT INTO request_images (request_id, image_url, created_at)
                VALUES (?, ?, ?)
            ''', (request_id, image_url, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))

            uploaded_images.append({
                'image_url': image_url,
                'full_url': f"/api{image_url}"
            })

        conn.commit()
        conn.close()

        logger.info(f"用户 {user_id} 为需求 {request_id} 上传了 {len(uploaded_images)} 张图片")

        return jsonify({
            'success': True,
            'message': f'成功上传 {len(uploaded_images)} 张图片',
            'data': {
                'images': uploaded_images
            }
        })

    except Exception as e:
        conn.rollback()
        conn.close()
        logger.error(f"上传需求图片失败: {str(e)}")
        return jsonify({'success': False, 'message': f'上传失败: {str(e)}'}), 500

# 获取需求的图片列表
@app.route('/api/requests/<int:request_id>/images', methods=['GET'])
def get_request_images(request_id):
    """获取需求的所有图片"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, image_url, created_at FROM request_images
        WHERE request_id = ?
        ORDER BY created_at ASC
    ''', (request_id,))

    images = []
    for row in cursor.fetchall():
        images.append({
            'id': row['id'],
            'image_url': row['image_url'],
            'full_url': f"/api{row['image_url']}",
            'created_at': row['created_at']
        })

    conn.close()

    return jsonify({
        'success': True,
        'data': {
            'images': images,
            'count': len(images)
        }
    })

# 删除需求图片
@app.route('/api/requests/<int:request_id>/images/<int:image_id>', methods=['DELETE'])
@jwt_required()
def delete_request_image(request_id, image_id):
    """删除需求图片"""
    user_id = get_jwt_identity()

    conn = get_db_connection()
    cursor = conn.cursor()

    # 检查需求所有权
    cursor.execute('SELECT user_id FROM requests WHERE id = ?', (request_id,))
    request_data = cursor.fetchone()

    if not request_data:
        conn.close()
        return jsonify({'success': False, 'message': '需求不存在'}), 404

    if request_data[0] != user_id:
        conn.close()
        return jsonify({'success': False, 'message': '无权删除此图片'}), 403

    # 获取图片信息
    cursor.execute('SELECT image_url FROM request_images WHERE id = ? AND request_id = ?', (image_id, request_id))
    image_data = cursor.fetchone()

    if not image_data:
        conn.close()
        return jsonify({'success': False, 'message': '图片不存在'}), 404

    try:
        # 删除文件
        image_filename = os.path.basename(image_data[0])
        image_path = os.path.join(REQUEST_IMAGES_FOLDER, image_filename)
        if os.path.exists(image_path):
            os.remove(image_path)

        # 删除数据库记录
        cursor.execute('DELETE FROM request_images WHERE id = ?', (image_id,))
        conn.commit()
        conn.close()

        logger.info(f"用户 {user_id} 删除了需求 {request_id} 的图片 {image_id}")

        return jsonify({'success': True, 'message': '图片删除成功'})

    except Exception as e:
        conn.rollback()
        conn.close()
        logger.error(f"删除图片失败: {str(e)}")
        return jsonify({'success': False, 'message': f'删除失败: {str(e)}'}), 500

# 获取所有用户
@app.route('/api/users', methods=['GET'])
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users ORDER BY help_count DESC')
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'data': users})

# 获取单个用户
@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        return jsonify({'success': True, 'data': dict(user)})
    return jsonify({'success': False, 'message': '用户不存在'}), 404

# 获取当前登录用户的所有需求
@app.route('/api/requests/my', methods=['GET'])
@jwt_required()
@rate_limit
@handle_errors
def get_my_requests():
    logger.info("获取当前用户的历史记录")
    
    # 使用JWT获取当前用户ID
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        # 获取用户发布的所有需求
        cursor.execute('''
            SELECT r.*, u.nickname as user_nickname, u.avatar as user_avatar, u.rating as user_rating
            FROM requests r
            JOIN users u ON r.user_id = u.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
        ''', (user_id,))
        
        requests_list = [dict(row) for row in cursor.fetchall()]
    
    logger.info(f"返回 {len(requests_list)} 条当前用户的历史记录")
    return jsonify({'success': True, 'data': requests_list})

# 获取当前用户帮助过的所有需求
@app.route('/api/requests/my-helps', methods=['GET'])
@jwt_required()
def get_my_helps():
    logger.info("获取当前用户的帮助记录")
    
    # 使用JWT获取当前用户ID
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        # 获取用户作为helper的所有需求
        cursor.execute('''
            SELECT r.*, u.nickname as user_nickname, u.avatar as user_avatar, u.rating as user_rating
            FROM requests r
            JOIN users u ON r.user_id = u.id
            WHERE r.helper_id = ?
            ORDER BY r.created_at DESC
        ''', (user_id,))
        
        helps_list = [dict(row) for row in cursor.fetchall()]
    
    logger.info(f"返回 {len(helps_list)} 条帮助记录")
    return jsonify({'success': True, 'data': helps_list})

# 获取用户的所有需求
@app.route('/api/users/<int:user_id>/requests', methods=['GET'])
def get_user_requests(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT r.*, u.nickname as user_nickname, u.avatar as user_avatar
        FROM requests r
        JOIN users u ON r.user_id = u.id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
    ''', (user_id,))
    requests_list = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'data': requests_list})

# 获取用户的帮助记录
@app.route('/api/users/<int:user_id>/helps', methods=['GET'])
def get_user_helps(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT hr.*, r.title as request_title, r.category, u.nickname as requester_nickname
        FROM help_records hr
        JOIN requests r ON hr.request_id = r.id
        JOIN users u ON r.user_id = u.id
        WHERE hr.helper_id = ?
        ORDER BY hr.created_at DESC
    ''', (user_id,))
    helps = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'data': helps})

# 上传用户头像
@app.route('/api/users/avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    """
    上传用户头像
    支持格式: png, jpg, jpeg, gif, webp
    最大文件大小: 16MB
    """
    user_id = get_jwt_identity()

    # 检查是否有文件
    if 'avatar' not in request.files:
        return jsonify({'success': False, 'message': '请选择要上传的图片'}), 400

    file = request.files['avatar']

    # 检查文件名
    if file.filename == '':
        return jsonify({'success': False, 'message': '请选择要上传的图片'}), 400

    # 检查文件类型
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'message': '不支持的文件格式，请上传 png, jpg, jpeg, gif 或 webp 格式的图片'}), 400

    try:
        # 生成唯一文件名
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"avatar_{user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
        filepath = os.path.join(AVATAR_FOLDER, unique_filename)

        # 压缩并保存图片
        compressed_image = compress_image(file, max_size=(400, 400), quality=85)
        with open(filepath, 'wb') as f:
            f.write(compressed_image.read())

        # 获取旧头像路径
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT avatar FROM users WHERE id = ?', (user_id,))
        old_avatar = cursor.fetchone()

        # 删除旧头像文件
        if old_avatar and old_avatar[0]:
            old_avatar_path = os.path.join(AVATAR_FOLDER, old_avatar[0])
            if os.path.exists(old_avatar_path):
                os.remove(old_avatar_path)

        # 更新数据库
        avatar_url = f"/uploads/avatars/{unique_filename}"
        cursor.execute('UPDATE users SET avatar = ? WHERE id = ?', (avatar_url, user_id))
        conn.commit()
        conn.close()

        logger.info(f"用户 {user_id} 上传了头像: {unique_filename}")

        return jsonify({
            'success': True,
            'message': '头像上传成功',
            'data': {
                'avatar_url': avatar_url,
                'full_url': f"/api{avatar_url}"
            }
        })

    except Exception as e:
        logger.error(f"上传头像失败: {str(e)}")
        return jsonify({'success': False, 'message': f'上传失败: {str(e)}'}), 500

# 上传收款码
@app.route('/api/users/payment_qr', methods=['POST'])
@jwt_required()
def upload_payment_qr():
    """
    上传用户收款码
    支持格式: png, jpg, jpeg
    """
    user_id = get_jwt_identity()
    
    QR_FOLDER = os.path.join(UPLOAD_FOLDER, 'payment_qr')
    os.makedirs(QR_FOLDER, exist_ok=True)
    
    if 'qr_code' not in request.files:
        return jsonify({'success': False, 'message': '请选择收款码图片'}), 400
    
    file = request.files['qr_code']
    qr_type = request.form.get('type', 'alipay')
    
    if file.filename == '':
        return jsonify({'success': False, 'message': '请选择收款码图片'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'message': '不支持的文件格式'}), 400
    
    try:
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"qr_{user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
        filepath = os.path.join(QR_FOLDER, unique_filename)
        
        compressed_image = compress_image(file, max_size=(500, 500), quality=85)
        with open(filepath, 'wb') as f:
            f.write(compressed_image.read())
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT payment_qr_code FROM users WHERE id = ?', (user_id,))
        old_qr = cursor.fetchone()
        
        if old_qr and old_qr[0]:
            old_qr_path = os.path.join(QR_FOLDER, old_qr[0].split('/')[-1])
            if os.path.exists(old_qr_path):
                os.remove(old_qr_path)
        
        qr_url = f"/uploads/payment_qr/{unique_filename}"
        cursor.execute('UPDATE users SET payment_qr_code = ?, payment_qr_type = ? WHERE id = ?', 
                      (qr_url, qr_type, user_id))
        conn.commit()
        conn.close()
        
        logger.info(f"用户 {user_id} 上传了收款码: {qr_type}")
        
        return jsonify({
            'success': True,
            'message': '收款码上传成功',
            'data': {
                'qr_url': qr_url,
                'qr_type': qr_type,
                'full_url': f"/api{qr_url}"
            }
        })
        
    except Exception as e:
        logger.error(f"上传收款码失败: {str(e)}")
        return jsonify({'success': False, 'message': f'上传失败: {str(e)}'}), 500

# 删除收款码
@app.route('/api/users/payment_qr', methods=['DELETE'])
@jwt_required()
def delete_payment_qr():
    """删除用户收款码"""
    user_id = get_jwt_identity()
    
    QR_FOLDER = os.path.join(UPLOAD_FOLDER, 'payment_qr')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT payment_qr_code FROM users WHERE id = ?', (user_id,))
        old_qr = cursor.fetchone()
        
        if old_qr and old_qr[0]:
            old_qr_path = os.path.join(QR_FOLDER, old_qr[0].split('/')[-1])
            if os.path.exists(old_qr_path):
                os.remove(old_qr_path)
        
        cursor.execute('UPDATE users SET payment_qr_code = NULL, payment_qr_type = NULL WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '收款码已删除'})
        
    except Exception as e:
        logger.error(f"删除收款码失败: {str(e)}")
        return jsonify({'success': False, 'message': f'删除失败: {str(e)}'}), 500

# 更新用户资料
@app.route('/api/users/profile', methods=['PUT'])
@jwt_required()
@rate_limit
@handle_errors
def update_profile():
    """更新用户资料"""
    user_id = get_jwt_identity()
    data = request.json
    
    nickname = data.get('nickname', '').strip()
    phone = data.get('phone', '').strip()
    location = data.get('location', '').strip()
    address = data.get('address', '').strip()
    email = data.get('email', '').strip()
    bio = data.get('bio', '').strip()
    
    # 处理技能标签
    skills = data.get('skills', [])
    if isinstance(skills, list):
        skills = ','.join([s.strip() for s in skills if s.strip()])
    else:
        skills = str(skills).strip()
    
    with DatabaseConnection() as cursor:
        # 构建动态更新语句
        update_fields = []
        params = []
        
        if nickname:
            update_fields.append('nickname = ?')
            params.append(nickname)
        if phone:
            update_fields.append('phone = ?')
            params.append(phone)
        if location:
            update_fields.append('location = ?')
            params.append(location)
        if address:
            update_fields.append('address = ?')
            params.append(address)
        if email:
            update_fields.append('email = ?')
            params.append(email)
        if bio is not None:
            update_fields.append('bio = ?')
            params.append(bio)
        if skills is not None:
            update_fields.append('skills = ?')
            params.append(skills)
        
        if update_fields:
            query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
            params.append(user_id)
            cursor.execute(query, params)
        
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
    
    return jsonify({
        'success': True, 
        'message': '资料更新成功',
        'data': dict(user) if user else None
    })

# 获取分类列表
@app.route('/api/categories', methods=['GET'])
def get_categories():
    categories = [
        {'id': 'all', 'name': '全部', 'icon': '📋'},
        {'id': '搬运', 'name': '搬运', 'icon': '📦'},
        {'id': '教育', 'name': '教育', 'icon': '📚'},
        {'id': '技术', 'name': '技术', 'icon': '💻'},
        {'id': '宠物', 'name': '宠物', 'icon': '🐾'},
        {'id': '维修', 'name': '维修', 'icon': '🔧'},
        {'id': '跑腿', 'name': '跑腿', 'icon': '🏃'},
        {'id': '健康', 'name': '健康', 'icon': '🏥'},
        {'id': '设计', 'name': '设计', 'icon': '🎨'},
        {'id': '借用', 'name': '借用', 'icon': '🤝'},
        {'id': '摄影', 'name': '摄影', 'icon': '📷'},
        {'id': '其他', 'name': '其他', 'icon': '📌'},
    ]
    return jsonify({'success': True, 'data': categories})

# 获取统计数据
@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM users')
    user_result = cursor.fetchone()
    user_count = user_result[0] if user_result else 0
    
    cursor.execute('SELECT COUNT(*) FROM requests')
    request_result = cursor.fetchone()
    request_count = request_result[0] if request_result else 0
    
    cursor.execute("SELECT COUNT(*) FROM requests WHERE status = 'completed'")
    completed_result = cursor.fetchone()
    completed_count = completed_result[0] if completed_result else 0
    
    cursor.execute('SELECT COUNT(*) FROM help_records')
    help_result = cursor.fetchone()
    help_count = help_result[0] if help_result else 0
    
    conn.close()
    
    return jsonify({
        'success': True,
        'data': {
            'user_count': user_count,
            'request_count': request_count,
            'completed_count': completed_count,
            'help_count': help_count
        }
    })

# ==================== WebSocket 事件处理 ====================

@socketio.on('connect')
def handle_connect():
    """客户端连接"""
    logger.info(f'客户端连接: {request.sid}')
    emit('connected', {'message': '连接成功', 'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    """客户端断开连接"""
    logger.info(f'客户端断开连接: {request.sid}')
    # 从在线用户列表中移除
    for user_id, sid in list(online_users.items()):
        if sid == request.sid:
            del online_users[user_id]
            if user_id in user_rooms:
                del user_rooms[user_id]
            logger.info(f'用户 {user_id} 下线')
            break

@socketio.on('auth')
def handle_auth(data):
    """用户认证"""
    user_id = data.get('userId')
    if user_id:
        online_users[user_id] = request.sid
        user_rooms[user_id] = []
        join_room(f'user_{user_id}')
        logger.info(f'用户 {user_id} 认证成功')
        emit('auth_success', {'userId': user_id})
    else:
        emit('auth_error', {'message': '用户ID不能为空'})

@socketio.on('join_room')
def handle_join_room(data):
    """加入房间"""
    room = data.get('room')
    user_id = data.get('userId')
    if room and user_id:
        join_room(room)
        if user_id in user_rooms:
            user_rooms[user_id].append(room)
        logger.info(f'用户 {user_id} 加入房间 {room}')
        emit('joined_room', {'room': room})

@socketio.on('leave_room')
def handle_leave_room(data):
    """离开房间"""
    room = data.get('room')
    user_id = data.get('userId')
    if room:
        leave_room(room)
        if user_id in user_rooms and room in user_rooms[user_id]:
            user_rooms[user_id].remove(room)
        logger.info(f'用户 {user_id} 离开房间 {room}')
        emit('left_room', {'room': room})

@socketio.on('send_message')
def handle_send_message(data):
    """发送消息"""
    sender_id = data.get('senderId')
    receiver_id = data.get('receiverId')
    message = data.get('message')
    request_id = data.get('requestId')
    
    if not all([sender_id, receiver_id, message]):
        emit('error', {'message': '缺少必要参数'})
        return
    
    # 保存消息到数据库
    try:
        with DatabaseConnection() as cursor:
            cursor.execute('''
                INSERT INTO messages (sender_id, receiver_id, request_id, content, created_at, is_read)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (sender_id, receiver_id, request_id, message, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), False))
        
        # 发送给接收者（如果在线）
        if receiver_id in online_users:
            socketio.emit('new_message', {
                'senderId': sender_id,
                'message': message,
                'requestId': request_id,
                'timestamp': datetime.now().isoformat()
            }, room=online_users[receiver_id])
        
        # 为接收者创建通知
        create_notification(receiver_id, 'message', '新消息', f'您收到一条新消息: {message[:50]}...', request_id, 'message')
        
        # 为发送者也创建通知（用于在消息中心显示聊天记录）
        create_notification(sender_id, 'message', '消息已发送', f'您发送的消息: {message[:50]}...', request_id, 'message')
        
        # 确认发送成功
        emit('message_sent', {'success': True})
        logger.info(f'消息从 {sender_id} 发送到 {receiver_id}')
        
    except Exception as e:
        logger.error(f'发送消息失败: {e}')
        emit('error', {'message': '发送消息失败'})

# ==================== 支付相关 API ====================

# 创建支付订单
@app.route('/api/payments', methods=['POST'])
@rate_limit
@handle_errors
def create_payment():
    """创建支付订单"""
    data = request.json
    
    request_id = data.get('request_id')
    payer_id = data.get('payer_id')
    amount = data.get('amount')
    payment_method = data.get('payment_method', 'wallet')
    description = data.get('description', '')
    
    if not all([request_id, payer_id, amount]):
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    # 获取需求信息，确定收款方
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT helper_id FROM requests WHERE id = ?', (request_id,))
    result = cursor.fetchone()
    conn.close()
    
    if not result or not result['helper_id']:
        return jsonify({'success': False, 'message': '需求不存在或尚未被接受'}), 400
    
    payee_id = result['helper_id']
    
    result = PaymentManager.create_payment(
        request_id=request_id,
        payer_id=payer_id,
        payee_id=payee_id,
        amount=amount,
        payment_method=payment_method,
        description=description
    )
    
    if result['success']:
        return jsonify(result), 201
    return jsonify(result), 400

# 处理支付
@app.route('/api/payments/<int:payment_id>/pay', methods=['POST'])
@rate_limit
@handle_errors
def process_payment(payment_id):
    """处理支付"""
    data = request.json
    payment_method = data.get('payment_method', 'wallet')
    
    result = PaymentManager.process_payment(payment_id, payment_method)
    
    if result['success']:
        # 发送支付成功通知
        payment = PaymentManager.get_payment(payment_id)
        if payment['success']:
            payment_data = payment['data']
            notify_payment_completed(payment_data['request_id'], payment_data['payer_id'], payment_data['payee_id'])
        return jsonify(result)
    return jsonify(result), 400

# 获取支付订单详情
@app.route('/api/payments/<int:payment_id>', methods=['GET'])
@rate_limit
@handle_errors
def get_payment(payment_id):
    """获取支付订单详情"""
    result = PaymentManager.get_payment(payment_id)
    
    if result['success']:
        return jsonify(result)
    return jsonify(result), 404

# 支付完成通知函数
def notify_payment_completed(request_id, payer_id, payee_id):
    """通知支付完成"""
    notification = {
        'type': 'payment_completed',
        'requestId': request_id,
        'message': '酬金支付已完成'
    }
    # 通知双方
    for user_id in [payer_id, payee_id]:
        if user_id in online_users:
            socketio.emit('payment_completed', notification, room=online_users[user_id])

# 技能标签匹配通知函数
def notify_matching_skills(request_skills, request_id, request_title):
    """通知技能标签匹配的用户"""
    if not request_skills:
        return
    
    skill_list = [s.strip() for s in request_skills.split(',') if s.strip()]
    if not skill_list:
        return
    
    try:
        with DatabaseConnection() as cursor:
            # 查找具有匹配技能标签的用户
            cursor.execute('SELECT id, skills, nickname FROM users WHERE skills IS NOT NULL AND skills != ""')
            users = cursor.fetchall()
            
            for user in users:
                user_id = user['id']
                user_skills = user['skills']
                user_nickname = user['nickname']
                
                if not user_skills:
                    continue
                
                # 检查用户技能是否与需求技能匹配
                user_skill_list = [s.strip() for s in user_skills.split(',') if s.strip()]
                matching_skills = set(skill_list) & set(user_skill_list)
                
                if matching_skills:
                    skill_text = '、'.join(list(matching_skills)[:3])
                    notification_title = f"🎯 有新的需求匹配您的技能"
                    notification_content = f"您关注的'{skill_text}'类需求有新发布：{request_title[:30]}..."
                    
                    # 创建通知
                    create_notification(
                        user_id, 
                        'skill_match', 
                        notification_title, 
                        notification_content, 
                        request_id, 
                        'request'
                    )
                    
                    logger.info(f"技能匹配通知已发送给用户 {user_id}，匹配技能: {skill_text}")
    except Exception as e:
        logger.error(f"技能匹配通知处理失败: {str(e)}")

# ==================== 消息相关 API ====================

@app.route('/api/messages', methods=['GET'])
@jwt_required()
@rate_limit
@handle_errors
def get_messages():
    """获取消息历史"""
    user_id = get_jwt_identity()
    other_user_id = request.args.get('user_id')
    request_id = request.args.get('request_id')
    limit = min(int(request.args.get('limit', 50)), 100)
    offset = int(request.args.get('offset', 0))
    
    with DatabaseConnection() as cursor:
        query = '''
            SELECT * FROM messages
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        '''
        params = [user_id, other_user_id, other_user_id, user_id]

        if request_id:
            query += ' AND request_id = ?'
            params.append(request_id)

        query += ' ORDER BY created_at ASC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        messages = [dict(row) for row in cursor.fetchall()]
    
    return jsonify({'success': True, 'data': messages})

# 发送消息（REST API）
@app.route('/api/messages', methods=['POST'])
@jwt_required()
@rate_limit
@handle_errors
def send_message_rest():
    """通过REST API发送消息"""
    user_id = get_jwt_identity()
    data = request.json
    
    receiver_id = data.get('receiver_id')
    content = data.get('content')
    request_id = data.get('request_id')
    
    if not receiver_id or not content:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    try:
        with DatabaseConnection() as cursor:
            # 保存消息到数据库
            cursor.execute('''
                INSERT INTO messages (sender_id, receiver_id, request_id, content, created_at, is_read)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, receiver_id, request_id, content, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), False))
            
            # 获取发送者信息
            cursor.execute('SELECT nickname as name FROM users WHERE id = ?', (user_id,))
            sender_info = cursor.fetchone()
            sender_name = sender_info['name'] if sender_info else '用户'
        
        # 通过WebSocket发送实时消息（如果接收者在线）
        if receiver_id in online_users:
            socketio.emit('new_message', {
                'senderId': user_id,
                'senderName': sender_name,
                'message': content,
                'requestId': request_id,
                'timestamp': datetime.now().isoformat()
            }, room=online_users[receiver_id])
        
        # 为接收者创建通知
        create_notification(receiver_id, 'message', f'来自 {sender_name} 的新消息', content, request_id, 'message')
        
        return jsonify({'success': True, 'message': '发送成功'})
    except Exception as e:
        logger.error(f'发送消息失败: {e}')
        return jsonify({'success': False, 'message': f'发送失败: {str(e)}'}), 500

# 获取联系人列表（与当前用户有过消息往来的用户 + 已接单任务的联系人）
@app.route('/api/messages/contacts', methods=['GET'])
@jwt_required()
@rate_limit
@handle_errors
def get_message_contacts():
    """获取消息联系人列表（包含消息联系人和已接单任务联系人）"""
    user_id = int(get_jwt_identity())
    logger.info(f"获取用户 {user_id} 的联系人列表")
    
    try:
        with DatabaseConnection() as cursor:
            # 1. 获取所有与当前用户有消息往来的用户ID
            cursor.execute('''
                SELECT DISTINCT 
                    CASE 
                        WHEN sender_id = ? THEN receiver_id 
                        ELSE sender_id 
                    END as contact_id
                FROM messages
                WHERE sender_id = ? OR receiver_id = ?
            ''', (user_id, user_id, user_id))
            
            message_contact_ids = set(row['contact_id'] for row in cursor.fetchall())
            logger.info(f"找到消息联系人ID: {message_contact_ids}")
            
            # 2. 获取已接单任务中的联系人（发单人/接单人）
            cursor.execute('''
                SELECT DISTINCT
                    CASE 
                        WHEN user_id = ? THEN helper_id 
                        ELSE user_id 
                    END as contact_id,
                    r.id as request_id,
                    r.title as request_title,
                    r.status as request_status,
                    COALESCE(r.helper_completed_at, r.completed_at, r.created_at) as contact_time
                FROM requests r
                WHERE (r.user_id = ? OR r.helper_id = ?) 
                  AND r.helper_id IS NOT NULL
                  AND r.status IN ('accepted', 'completed')
            ''', (user_id, user_id, user_id))
            
            request_contacts = {}
            for row in cursor.fetchall():
                contact_id = row['contact_id']
                if contact_id and contact_id != user_id:
                    request_contacts[contact_id] = {
                        'request_id': row['request_id'],
                        'request_title': row['request_title'],
                        'request_status': row['request_status'],
                        'contact_time': row['contact_time']
                    }
                    message_contact_ids.add(contact_id)
            
            logger.info(f"找到任务联系人: {list(request_contacts.keys())}")
            logger.info(f"总联系人ID: {message_contact_ids}")
            
            if not message_contact_ids:
                return jsonify({'success': True, 'data': []})
            
            contacts = []
            for contact_id in message_contact_ids:
                # 获取用户基本信息
                cursor.execute('''
                    SELECT id, nickname as name, avatar
                    FROM users
                    WHERE id = ?
                ''', (contact_id,))
                
                user_row = cursor.fetchone()
                if not user_row:
                    continue
                
                contact = dict(user_row)
                
                # 获取最新消息
                cursor.execute('''
                    SELECT 
                        content as last_message,
                        created_at as last_time,
                        is_read,
                        receiver_id,
                        sender_id
                    FROM messages
                    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                    ORDER BY created_at DESC
                    LIMIT 1
                ''', (user_id, contact_id, contact_id, user_id))
                
                msg_row = cursor.fetchone()
                
                if msg_row:
                    # 有消息记录
                    contact.update({
                        'last_message': msg_row['last_message'],
                        'last_time': msg_row['last_time'],
                        'is_read': msg_row['is_read'],
                        'receiver_id': msg_row['receiver_id'],
                        'sender_id': msg_row['sender_id']
                    })
                elif contact_id in request_contacts:
                    # 没有消息，但有任务关联
                    task_info = request_contacts[contact_id]
                    contact.update({
                        'last_message': f"任务「{task_info['request_title']}」已接单，开始沟通吧！",
                        'last_time': task_info['contact_time'],
                        'is_read': 1,
                        'receiver_id': user_id,
                        'sender_id': contact_id,
                        'request_id': task_info['request_id']
                    })
                else:
                    continue
                
                # 格式化时间
                if contact.get('last_time'):
                    try:
                        from datetime import datetime
                        msg_time = datetime.strptime(contact['last_time'], '%Y-%m-%d %H:%M:%S')
                        now = datetime.now()
                        delta = now - msg_time
                        if delta.days == 0:
                            contact['lastTime'] = msg_time.strftime('%H:%M')
                        elif delta.days == 1:
                            contact['lastTime'] = '昨天'
                        elif delta.days < 7:
                            contact['lastTime'] = f'{delta.days}天前'
                        else:
                            contact['lastTime'] = msg_time.strftime('%m-%d')
                    except:
                        contact['lastTime'] = contact['last_time'][:16] if contact['last_time'] else ''
                else:
                    contact['lastTime'] = ''
                
                # 检查是否有未读消息（SQLite中is_read是整数0/1）
                is_read_val = contact.get('is_read', 1)
                if isinstance(is_read_val, bool):
                    is_read_val = 1 if is_read_val else 0
                contact['unread'] = 1 if (contact.get('receiver_id') == user_id and is_read_val == 0) else 0
                contact['online'] = contact['id'] in online_users
                contacts.append(contact)
            
            # 按最后消息时间排序
            contacts.sort(key=lambda x: x.get('last_time', ''), reverse=True)
            logger.info(f"返回 {len(contacts)} 个联系人")
            return jsonify({'success': True, 'data': contacts})
    except Exception as e:
        logger.error(f"获取联系人列表失败: {e}")
        return jsonify({'success': False, 'message': f'获取联系人失败: {str(e)}'}), 500

# 获取用户任务动态
@app.route('/api/activity', methods=['GET'])
@jwt_required()
@rate_limit
@handle_errors
def get_user_activity():
    """获取用户任务动态（接单、完成等）"""
    user_id = int(get_jwt_identity())
    logger.info(f"获取用户 {user_id} 的任务动态")
    
    try:
        with DatabaseConnection() as cursor:
            # 获取用户参与的所有任务（作为发布者或接单人）
            cursor.execute('''
                SELECT 
                    r.id,
                    r.title,
                    r.status,
                    r.user_id as publisher_id,
                    r.helper_id,
                    r.created_at,
                    r.helper_completed_at,
                    r.completed_at,
                    u.nickname as publisher_name,
                    h.nickname as helper_name
                FROM requests r
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN users h ON r.helper_id = h.id
                WHERE (r.user_id = ? OR r.helper_id = ?)
                  AND r.helper_id IS NOT NULL
                ORDER BY COALESCE(r.completed_at, r.helper_completed_at, r.created_at) DESC
                LIMIT 50
            ''', (user_id, user_id))
            
            activities = []
            for row in cursor.fetchall():
                request_id = row['id']
                title = row['title']
                status = row['status']
                publisher_id = row['publisher_id']
                helper_id = row['helper_id']
                publisher_name = row['publisher_name'] or '未知用户'
                helper_name = row['helper_name'] or '未知用户'
                
                # 根据角色和状态生成动态描述
                if status == 'accepted':
                    # 任务被接单
                    if publisher_id == user_id:
                        # 我是发布者，显示接单人信息
                        activities.append({
                            'id': f'accept_{request_id}',
                            'type': 'accept',
                            'icon': '✅',
                            'title': f'<strong>{helper_name}</strong> 已接单',
                            'desc': f'任务「{title}」',
                            'time': row['created_at']
                        })
                    else:
                        # 我是接单人，显示我接了谁的单
                        activities.append({
                            'id': f'accept_{request_id}',
                            'type': 'accept',
                            'icon': '🤝',
                            'title': '您已接单',
                            'desc': f'任务「{title}」来自 <strong>{publisher_name}</strong>',
                            'time': row['created_at']
                        })
                
                elif status == 'completed':
                    # 任务完成
                    if publisher_id == user_id:
                        # 我是发布者，我确认了完成
                        activities.append({
                            'id': f'complete_{request_id}',
                            'type': 'complete',
                            'icon': '🎉',
                            'title': f'您已确认完成',
                            'desc': f'任务「{title}」由 <strong>{helper_name}</strong> 完成',
                            'time': row['completed_at']
                        })
                    else:
                        # 我是接单人，发布者确认了我的完成
                        activities.append({
                            'id': f'complete_{request_id}',
                            'type': 'complete',
                            'icon': '✨',
                            'title': f'<strong>{publisher_name}</strong> 已确认完成',
                            'desc': f'任务「{title}」',
                            'time': row['completed_at']
                        })
                
                # 接单人标记完成（待确认状态）
                if helper_id == user_id and row['helper_completed_at'] and status != 'completed':
                    activities.append({
                        'id': f'helper_complete_{request_id}',
                        'type': 'helper_complete',
                        'icon': '⏳',
                        'title': '您已完成任务',
                        'desc': f'任务「{title}」等待 <strong>{publisher_name}</strong> 确认',
                        'time': row['helper_completed_at']
                    })
            
            # 格式化时间
            for activity in activities:
                if activity['time']:
                    try:
                        act_time = datetime.strptime(activity['time'], '%Y-%m-%d %H:%M:%S')
                        now = datetime.now()
                        delta = now - act_time
                        if delta.days == 0:
                            if delta.seconds < 3600:
                                minutes = delta.seconds // 60
                                activity['time'] = f'{minutes}分钟前' if minutes > 0 else '刚刚'
                            else:
                                activity['time'] = f'{delta.seconds // 3600}小时前'
                        elif delta.days == 1:
                            activity['time'] = '昨天'
                        elif delta.days < 7:
                            activity['time'] = f'{delta.days}天前'
                        else:
                            activity['time'] = act_time.strftime('%m-%d')
                    except:
                        pass
            
            logger.info(f"返回 {len(activities)} 条动态")
            return jsonify({'success': True, 'data': activities})
    except Exception as e:
        logger.error(f"获取任务动态失败: {e}")
        return jsonify({'success': False, 'message': f'获取动态失败: {str(e)}'}), 500

@app.route('/api/messages/image', methods=['POST'])
@jwt_required()
@handle_errors
def upload_message_image():
    """上传聊天图片"""
    user_id = get_jwt_identity()
    
    if 'image' not in request.files:
        return jsonify({'success': False, 'message': '请选择图片'}), 400
    
    file = request.files['image']
    receiver_id = request.form.get('receiver_id')
    
    if not receiver_id:
        return jsonify({'success': False, 'message': '缺少接收者ID'}), 400
    
    if file.filename == '':
        return jsonify({'success': False, 'message': '请选择图片'}), 400
    
    if not allowed_file(file.filename, {'jpg', 'jpeg', 'png', 'gif', 'webp'}):
        return jsonify({'success': False, 'message': '不支持的图片格式'}), 400
    
    import uuid
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'jpg'
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, 'chat_images', filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    img = Image.open(file.stream)
    img.thumbnail((800, 800), Image.Resampling.LANCZOS)
    img.save(filepath, quality=85)
    
    image_url = f"/uploads/chat_images/{filename}"
    
    with DatabaseConnection() as cursor:
        cursor.execute('''
            INSERT INTO messages (sender_id, receiver_id, content, created_at, is_read, message_type)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, receiver_id, image_url, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), False, 'image'))
    
    return jsonify({'success': True, 'data': {'image_url': image_url}})

# ==================== 用户认证 API ====================

@app.route('/api/auth/register', methods=['POST'])
@rate_limit
@handle_errors
def register():
    """用户注册"""
    data = request.json
    logger.info(f'注册请求数据: {data}')
    
    nickname = data.get('nickname')
    password = data.get('password')
    phone = data.get('phone')
    email = data.get('email')
    verification_code = data.get('verification_code')
    
    if not all([nickname, password, email, verification_code]):
        missing = []
        if not nickname: missing.append('nickname')
        if not password: missing.append('password')
        if not email: missing.append('email')
        if not verification_code: missing.append('verification_code')
        logger.warning(f'缺少必要参数: {missing}')
        return jsonify({'success': False, 'message': f'缺少必要参数: {", ".join(missing)}'}), 400
    
    # 验证邮箱格式
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        return jsonify({'success': False, 'message': '邮箱格式不正确'}), 400
    
    # 验证验证码
    stored_data = get_verification_code(email)
    if not stored_data:
        logger.warning(f'验证码不存在: {email}')
        return jsonify({'success': False, 'message': '验证码不存在或已过期'}), 400
    
    logger.info(f'存储的验证码数据: {stored_data}')
    
    # 检查验证码是否过期
    import time
    current_time = int(time.time())
    if current_time > stored_data['expires']:
        delete_verification_code(email)
        logger.warning(f'验证码已过期: {email}')
        return jsonify({'success': False, 'message': '验证码已过期'}), 400
    
    # 验证验证码
    if stored_data['code'] != verification_code:
        logger.warning(f'验证码错误: 输入={verification_code}, 存储={stored_data["code"]}')
        return jsonify({'success': False, 'message': '验证码错误'}), 400
    
    # 密码强度验证
    is_valid, strength_msg, strength_level = check_password_strength(password)
    if not is_valid:
        return jsonify({'success': False, 'message': strength_msg}), 400
    
    # 生成密码哈希
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    with DatabaseConnection() as cursor:
        # 检查昵称是否已存在
        cursor.execute('SELECT id FROM users WHERE username = ?', (nickname,))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': '用户名已存在'}), 400
        
        # 检查邮箱是否已存在
        cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': '邮箱已被注册'}), 400
        
        # 插入新用户，使用nickname作为username
        cursor.execute('''
            INSERT INTO users (username, nickname, password, phone, email, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (nickname, nickname, password_hash, phone, email, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        
        user_id = cursor.lastrowid
    
    # 删除已使用的验证码
    delete_verification_code(email)
    
    # 生成访问令牌
    access_token = create_access_token(identity=str(user_id))
    
    return jsonify({
        'success': True,
        'message': '注册成功',
        'data': {
            'user_id': user_id,
            'username': nickname,
            'nickname': nickname,
            'help_count': 0,
            'request_count': 0,
            'access_token': access_token
        }
    }), 201

def send_email_verification_code(to_email, code, email_type='register'):
    """发送验证码邮件
    
    Args:
        to_email: 收件人邮箱
        code: 验证码
        email_type: 邮件类型，'register' 或 'forgot_password'
    """
    try:
        # 检查邮件配置
        if not SMTP_USERNAME or not SMTP_PASSWORD:
            logger.warning('邮件服务器未配置，跳过邮件发送')
            return False
        
        # 根据类型设置邮件内容
        if email_type == 'forgot_password':
            subject = '【我来帮】密码重置验证码'
            title = '密码重置'
            description = '您好！您正在重置 <span style="color: #22c55e; font-weight: bold;">我来帮</span> 账号密码'
            action_text = '找回密码'
            text_description = '您正在重置【我来帮】账号密码'
        else:
            subject = '【我来帮】邮箱验证码'
            title = '邮箱验证'
            description = '您好！您正在注册 <span style="color: #22c55e; font-weight: bold;">我来帮</span> 账号'
            action_text = '注册账号'
            text_description = '您正在注册【我来帮】账号'
        
        # 创建邮件内容
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        # 使用纯邮箱地址作为From，避免foxmail格式问题
        msg['From'] = SMTP_USERNAME
        msg['To'] = to_email
        
        # 邮件正文 - 兼容性优化的HTML模板
        html_content = f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>我来帮 - {subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 40px 10px;">
                <table border="0" cellpadding="0" cellspacing="0" width="480" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                    <!-- 头部 -->
                    <tr>
                        <td align="center" style="background-color: #22c55e; padding: 30px 20px; border-radius: 12px 12px 0 0;">
                            <table border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="font-size: 40px; line-height: 1;">&#129309;</td>
                                </tr>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 10px;">
                                <tr>
                                    <td style="color: #ffffff; font-size: 24px; font-weight: bold; font-family: Arial, 'Microsoft YaHei', sans-serif;">我来帮</td>
                                </tr>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 5px;">
                                <tr>
                                    <td style="color: #dcfce7; font-size: 13px; font-family: Arial, 'Microsoft YaHei', sans-serif;">人与人互助 &#183; 温暖社区</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- 内容 -->
                    <tr>
                        <td style="padding: 30px 25px;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td style="color: #1f2937; font-size: 20px; font-weight: bold; font-family: Arial, 'Microsoft YaHei', sans-serif; padding-bottom: 15px;">{title}</td>
                                </tr>
                                <tr>
                                    <td style="color: #4b5563; font-size: 14px; font-family: Arial, 'Microsoft YaHei', sans-serif; line-height: 1.8; padding-bottom: 20px;">
                                        {description}
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- 验证码框 -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4; border: 2px dashed #22c55e; border-radius: 10px; margin: 15px 0;">
                                <tr>
                                    <td align="center" style="padding: 25px 20px;">
                                        <table border="0" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="color: #16a34a; font-size: 12px; font-weight: bold; font-family: Arial, sans-serif; letter-spacing: 2px; padding-bottom: 10px;">VERIFICATION CODE</td>
                                            </tr>
                                        </table>
                                        <table border="0" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="color: #16a34a; font-size: 36px; font-weight: bold; font-family: 'Courier New', Arial, monospace; letter-spacing: 10px;">{code}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- 有效期提示 -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; margin: 15px 0;">
                                <tr>
                                    <td style="padding: 12px 15px;">
                                        <table border="0" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="color: #92400e; font-size: 14px; font-family: Arial, 'Microsoft YaHei', sans-serif;">
                                                    &#9200; 有效期 <span style="font-weight: bold;">5分钟</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- 安全提示 -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px;">
                                <tr>
                                    <td style="color: #6b7280; font-size: 13px; font-family: Arial, 'Microsoft YaHei', sans-serif; line-height: 1.6;">
                                        &#128274; 如非本人操作，请忽略此邮件
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- 底部 -->
                    <tr>
                        <td align="center" style="background-color: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                            <table border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="color: #9ca3af; font-size: 12px; font-family: Arial, 'Microsoft YaHei', sans-serif; text-align: center;">
                                        此邮件由系统自动发送，请勿回复<br/>
                                        <span style="color: #22c55e;">&copy; 2026 我来帮</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""
        
        text_content = f"""
        【我来帮】{subject}
        
        您好！
        
        {text_description}，请使用以下验证码完成验证：
        
        ╔════════════════════════════════╗
        ║                              ║
        ║         {code}          ║
        ║                              ║
        ╚════════════════════════════════╝
        
        此验证码有效期为5分钟，请尽快完成验证。
        
        安全提示：如果您没有进行此操作，请忽略此邮件。请勿将验证码透露给他人。
        
        ---
        此邮件由系统自动发送，请勿回复
        © 2026 我来帮 - 人与互助平台
        """
        
        # 添加邮件内容
        part1 = MIMEText(text_content, 'plain', 'utf-8')
        part2 = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part1)
        msg.attach(part2)
        
        # 连接SMTP服务器并发送
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_USERNAME, to_email, msg.as_string())
        
        logger.info(f'验证码邮件已发送 - 邮箱: {to_email}')
        return True
        
    except Exception as e:
        logger.error(f'发送邮件失败: {e}')
        import traceback
        logger.error(traceback.format_exc())
        return False

@app.route('/api/auth/send-verification-code', methods=['POST'])
@rate_limit
@handle_errors
def send_verification_code():
    """发送邮箱验证码"""
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({'success': False, 'message': '邮箱不能为空'}), 400
    
    # 验证邮箱格式
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        return jsonify({'success': False, 'message': '邮箱格式不正确'}), 400
    
    # 生成6位数字验证码
    code = ''.join(random.choices(string.digits, k=6))
    
    # 存储验证码到数据库，5分钟有效
    import time
    expires = int(time.time()) + 300
    save_verification_code(email, code, expires)
    
    # 获取邮件类型（注册或找回密码）
    email_type = data.get('type', 'register')
    
    # 尝试发送邮件
    email_sent = send_email_verification_code(email, code, email_type)
    
    if email_sent:
        return jsonify({
            'success': True,
            'message': '验证码已发送到您的邮箱，请查收',
            'data': {
                'email': email
            }
        })
    else:
        logger.info(f'验证码已生成（邮件未发送）- 邮箱: {email}, 验证码: {code}')
        response_data = {
            'success': True,
            'message': '验证码已生成（邮件服务器未配置，请在控制台查看验证码）',
            'data': {
                'email': email
            }
        }
        # 仅在调试模式下返回验证码
        if os.getenv('FLASK_DEBUG', '').lower() == 'true' or os.getenv('DEBUG', '').lower() == 'true':
            response_data['data']['code'] = code
        
        return jsonify(response_data)

@app.route('/api/auth/verify-code', methods=['POST'])
@rate_limit
@handle_errors
def verify_code():
    """验证邮箱验证码"""
    data = request.json
    email = data.get('email')
    code = data.get('code')
    
    if not email or not code:
        return jsonify({'success': False, 'message': '邮箱和验证码不能为空'}), 400
    
    # 检查验证码是否存在
    stored_data = get_verification_code(email)
    if not stored_data:
        return jsonify({'success': False, 'message': '验证码不存在或已过期'}), 400
    
    # 检查验证码是否过期
    import time
    if int(time.time()) > stored_data['expires']:
        delete_verification_code(email)
        return jsonify({'success': False, 'message': '验证码已过期'}), 400
    
    # 验证验证码
    if stored_data['code'] != code:
        return jsonify({'success': False, 'message': '验证码错误'}), 400
    
    return jsonify({
        'success': True,
        'message': '验证成功'
    })

@app.route('/api/auth/reset-password', methods=['POST'])
@rate_limit
@handle_errors
def reset_password():
    """重置密码（忘记密码）"""
    data = request.json
    
    email = data.get('email')
    code = data.get('code')
    new_password = data.get('new_password')
    
    if not all([email, code, new_password]):
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    # 密码强度验证
    is_valid, strength_msg, strength_level = check_password_strength(new_password)
    if not is_valid:
        return jsonify({'success': False, 'message': strength_msg}), 400
    
    # 检查验证码
    stored_data = get_verification_code(email)
    if not stored_data:
        return jsonify({'success': False, 'message': '验证码不存在或已过期'}), 400
    
    # 检查验证码是否过期
    import time
    if int(time.time()) > stored_data['expires']:
        delete_verification_code(email)
        return jsonify({'success': False, 'message': '验证码已过期'}), 400
    
    # 验证验证码
    if stored_data['code'] != code:
        return jsonify({'success': False, 'message': '验证码错误'}), 400
    
    # 查找用户
    with DatabaseConnection() as cursor:
        cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'success': False, 'message': '该邮箱未注册'}), 404
        
        # 加密新密码
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        
        # 更新密码
        cursor.execute('UPDATE users SET password = ? WHERE email = ?', (hashed_password.decode('utf-8'), email))
    
    # 删除已使用的验证码
    delete_verification_code(email)
    
    logger.info(f'密码重置成功 - 邮箱: {email}')
    
    return jsonify({
        'success': True,
        'message': '密码重置成功，请使用新密码登录'
    })

@app.route('/api/auth/login', methods=['POST'])
@rate_limit
@handle_errors
def login():
    """用户登录 - 支持用户名或邮箱登录"""
    data = request.json
    
    username = data.get('username')
    password = data.get('password')
    
    if not all([username, password]):
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    is_locked, lock_message = check_login_locked(username)
    if is_locked:
        return jsonify({'success': False, 'message': lock_message}), 403
    
    with DatabaseConnection() as cursor:
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        is_email = re.match(email_pattern, username)
        
        if is_email:
            cursor.execute('SELECT id, username, nickname, password, avatar, phone, email, location, address, created_at, rating, help_count, request_count, payment_qr_code, payment_qr_type FROM users WHERE email = ?', (username,))
        else:
            cursor.execute('SELECT id, username, nickname, password, avatar, phone, email, location, address, created_at, rating, help_count, request_count, payment_qr_code, payment_qr_type FROM users WHERE username = ?', (username,))
        user = cursor.fetchone()
        
        if not user:
            record_login_failure(username)
            remaining = LOGIN_MAX_FAILURES - 1
            return jsonify({'success': False, 'message': f'用户名或密码错误，剩余尝试次数: {remaining}'}), 401
        
        stored_password = user[3]
        
        password_valid = False
        if stored_password.startswith('$2'):  # bcrypt哈希
            try:
                password_valid = bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8'))
            except Exception:
                password_valid = False
        else:  # 明文密码（兼容旧数据）
            password_valid = (password == stored_password)
            if password_valid:
                new_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                with DatabaseConnection() as cursor:
                    cursor.execute('UPDATE users SET password = ? WHERE id = ?', (new_hash, user[0]))
        
        if not password_valid:
            record_login_failure(username)
            remaining = LOGIN_MAX_FAILURES - 1
            return jsonify({'success': False, 'message': f'用户名或密码错误，剩余尝试次数: {remaining}'}), 401
    
    clear_login_failure(username)
    access_token = create_access_token(identity=str(user[0]))
    
    return jsonify({
        'success': True,
        'message': '登录成功',
        'data': {
            'user_id': user[0],
            'username': user[1],
            'nickname': user[2],
            'avatar': user[4],
            'phone': user[5],
            'email': user[6],
            'location': user[7],
            'address': user[8],
            'created_at': user[9],
            'rating': user[10],
            'help_count': user[11] or 0,
            'request_count': user[12] or 0,
            'payment_qr_code': user[13],
            'payment_qr_type': user[14],
            'access_token': access_token
        }
    })

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
@handle_errors
def get_current_user():
    """获取当前用户信息"""
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        cursor.execute('''
            SELECT id, username, nickname, avatar, phone, email, location, address, created_at, rating, help_count, request_count
            FROM users
            WHERE id = ?
        ''', (user_id,))
        user = cursor.fetchone()
    
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    
    # 将Row对象转换为字典
    user_dict = dict(user)
    
    # 确保数值字段不为null
    user_dict['help_count'] = user_dict.get('help_count') or 0
    user_dict['request_count'] = user_dict.get('request_count') or 0
    user_dict['rating'] = user_dict.get('rating') or 5.0
    
    return jsonify({'success': True, 'data': user_dict})

@app.route('/api/admin/users', methods=['GET'])
@admin_required
@handle_errors
def get_admin_users():
    """获取用户列表（管理员）"""
    # 获取查询参数
    page = max(int(request.args.get('page', 1)), 1)
    limit = min(int(request.args.get('limit', 10)), 50)
    search = request.args.get('search', '')
    
    # 计算偏移量
    offset = (page - 1) * limit
    
    with DatabaseConnection() as cursor:
        # 构建查询语句
        if search:
            cursor.execute('''
                SELECT id, username, nickname, avatar, phone, email, location, created_at, rating, help_count, request_count
                FROM users
                WHERE username LIKE ? OR nickname LIKE ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (f'%{search}%', f'%{search}%', limit, offset))
            
            # 获取用户列表
            users = cursor.fetchall()
            
            # 获取总数
            cursor.execute('''
                SELECT COUNT(*)
                FROM users
                WHERE username LIKE ? OR nickname LIKE ?
            ''', (f'%{search}%', f'%{search}%'))
        else:
            cursor.execute('''
                SELECT id, username, nickname, avatar, phone, email, location, created_at, rating, help_count, request_count
                FROM users
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (limit, offset))
            
            # 获取用户列表
            users = cursor.fetchall()
            
            # 获取总数
            cursor.execute('SELECT COUNT(*) FROM users')
        
        total_result = cursor.fetchone()
        total = total_result[0] if total_result else 0
        
        # 将Row对象转换为字典列表
        users_list = []
        for user in users:
            user_dict = dict(user)
            users_list.append(user_dict)
    
    return jsonify({
        'success': True,
        'data': {
            'users': users_list,
            'total': total,
            'page': page,
            'limit': limit,
            'total_pages': (total + limit - 1) // limit
        }
    })

# ==================== API 文档路由 ====================

@app.route('/api/docs')
def api_docs():
    """API 文档"""
    docs = {
        'name': '我来帮 API',
        'version': '1.0.0',
        'description': '人与互助平台 API 文档',
        'base_url': '/api',
        'endpoints': {
            'auth': {
                'POST /api/auth/register': '用户注册',
                'POST /api/auth/login': '用户登录',
                'GET /api/auth/me': '获取当前用户信息'
            },
            'membership': {
                'GET /api/membership/levels': '获取所有会员等级',
                'POST /api/membership/subscribe': '订阅会员',
                'GET /api/membership/status': '获取用户会员状态'
            },
            'ads': {
                'GET /api/ads': '获取广告列表',
                'POST /api/ads/<id>/click': '记录广告点击'
            },
            'points': {
                'GET /api/points/status': '获取用户积分状态',
                'GET /api/points/transactions': '获取用户积分交易记录'
            },
            'messages': {
                'GET /api/messages': '获取消息历史',
                'POST /api/messages': '发送消息（WebSocket）'
            },
            'requests': {
                'GET /api/requests': '获取所有需求',
                'GET /api/requests?status=pending': '按状态筛选需求',
                'GET /api/requests?category=搬运': '按分类筛选需求',
                'POST /api/requests': '发布新需求',
                'GET /api/requests/<id>': '获取需求详情',
                'POST /api/requests/<id>/accept': '接受需求',
                'POST /api/requests/<id>/complete': '完成需求',
                'POST /api/requests/<id>/comments': '添加评论'
            },
            'users': {
                'GET /api/users': '获取所有用户',
                'GET /api/users/<id>': '获取用户详情',
                'GET /api/users/<id>/requests': '获取用户发布的需求',
                'GET /api/users/<id>/helps': '获取用户的帮助记录'
            },
            'categories': {
                'GET /api/categories': '获取所有分类'
            },
            'stats': {
                'GET /api/stats': '获取统计数据'
            },
            'payments': {
                'POST /api/payments': '创建支付订单',
                'POST /api/payments/<id>/pay': '处理支付',
                'GET /api/payments/<id>': '获取支付订单详情',
                'GET /api/users/<id>/payments': '获取用户支付记录'
            },
            'wallet': {
                'GET /api/users/<id>/wallet': '获取用户钱包信息',
                'GET /api/users/<id>/wallet/transactions': '获取钱包交易记录',
                'POST /api/users/<id>/wallet/recharge': '钱包充值'
            },
            'withdrawals': {
                'POST /api/users/<id>/withdrawals': '创建提现申请',
                'GET /api/users/<id>/withdrawals': '获取提现记录'
            },
            'payment_gateway': {
                'POST /api/payments/gateway/alipay': '创建支付宝订单',
                'POST /api/payments/gateway/wechat': '创建微信支付订单',
                'POST /api/payments/callback/alipay': '支付宝支付回调',
                'POST /api/payments/callback/wechat': '微信支付回调',
                'POST /api/payments/alipay/refund': '支付宝退款',
                'POST /api/payments/wechat/refund': '微信退款'
            }
        },
        'websocket': {
            'events': {
                'connect': '连接服务器',
                'auth': '用户认证',
                'join_room': '加入房间',
                'leave_room': '离开房间',
                'send_message': '发送消息'
            },
            'notifications': {
                'new_request': '新需求通知',
                'request_accepted': '需求被接受',
                'request_completed': '需求已完成',
                'new_message': '新消息',
                'notification': '系统通知'
            }
        },
        'authentication': {
            'type': 'JWT Token',
            'description': '使用JSON Web Token进行认证',
            'headers': {
                'Authorization': 'Bearer <token>'
            },
            'endpoints': {
                'POST /api/auth/register': '用户注册',
                'POST /api/auth/login': '用户登录',
                'GET /api/auth/me': '获取当前用户信息'
            }
        },
        'rate_limiting': {
            'description': '每个 IP 每分钟最多 100 次请求',
            'headers': {
                'X-RateLimit-Limit': '请求限制数',
                'X-RateLimit-Remaining': '剩余请求数'
            }
        },
        'response_format': {
            'success': {
                'success': True,
                'data': {},
                'message': '操作成功'
            },
            'error': {
                'success': False,
                'message': '错误信息',
                'errors': {}
            }
        }
    }
    return jsonify(docs)

# 静态文件服务 - 上传的图片
@app.route('/api/uploads/avatars/<path:filename>')
def serve_avatar(filename):
    """提供头像图片访问"""
    return send_from_directory(AVATAR_FOLDER, filename)

@app.route('/api/uploads/payment_qr/<path:filename>')
def serve_payment_qr(filename):
    """提供收款码图片访问"""
    QR_FOLDER = os.path.join(UPLOAD_FOLDER, 'payment_qr')
    return send_from_directory(QR_FOLDER, filename)

@app.route('/api/uploads/request_images/<path:filename>')
def serve_request_image(filename):
    """提供需求图片访问"""
    return send_from_directory(REQUEST_IMAGES_FOLDER, filename)

# 静态文件服务
@app.route('/')
def index():
    response = send_from_directory(os.path.join(os.path.dirname(__file__), '../frontend'), 'index.html')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/<path:path>')
def static_files(path):
    response = send_from_directory(os.path.join(os.path.dirname(__file__), '../frontend'), path)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# ==================== 任务进度追踪 API ====================

@app.route('/api/requests/<int:request_id>/progress', methods=['POST'])
@jwt_required()
@rate_limit
@handle_errors
def update_progress(request_id):
    """接单人更新任务进度"""
    data = request.json
    progress = data.get('progress')
    user_id = get_jwt_identity()
    
    if progress is None or progress < 0 or progress > 100:
        return jsonify({'success': False, 'message': '进度必须在0-100之间'}), 400
    
    with DatabaseConnection() as cursor:
        cursor.execute('SELECT helper_id, status FROM requests WHERE id = ?', (request_id,))
        request_info = cursor.fetchone()
        
        if not request_info:
            return jsonify({'success': False, 'message': '需求不存在'}), 404
        
        if request_info['helper_id'] != user_id:
            return jsonify({'success': False, 'message': '只有接单人可以更新进度'}), 403
        
        if request_info['status'] != 'accepted':
            return jsonify({'success': False, 'message': '只能更新进行中任务的进度'}), 400
        
        cursor.execute('UPDATE requests SET progress = ? WHERE id = ?', (progress, request_id))
        
        cursor.execute('SELECT user_id FROM requests WHERE id = ?', (request_id,))
        owner_id = cursor.fetchone()[0]
        
        create_notification(owner_id, 'progress_update', '任务进度更新', f'任务进度已更新为 {progress}%', request_id, 'request')
    
    return jsonify({'success': True, 'message': '进度已更新'})

# ==================== 任务备注 API ====================

@app.route('/api/requests/<int:request_id>/notes', methods=['POST'])
@jwt_required()
@rate_limit
@handle_errors
def add_task_note(request_id):
    """添加任务备注"""
    data = request.json
    content = data.get('content', '').strip()
    user_id = get_jwt_identity()
    
    if not content:
        return jsonify({'success': False, 'message': '备注内容不能为空'}), 400
    
    with DatabaseConnection() as cursor:
        cursor.execute('SELECT user_id, helper_id FROM requests WHERE id = ?', (request_id,))
        request_info = cursor.fetchone()
        
        if not request_info:
            return jsonify({'success': False, 'message': '需求不存在'}), 404
        
        if request_info['user_id'] != user_id and request_info['helper_id'] != user_id:
            return jsonify({'success': False, 'message': '只有任务相关人员可以添加备注'}), 403
        
        cursor.execute('''
            INSERT INTO task_notes (request_id, user_id, content, created_at)
            VALUES (?, ?, ?, ?)
        ''', (request_id, user_id, content, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    
    return jsonify({'success': True, 'message': '备注添加成功'})

@app.route('/api/requests/<int:request_id>/notes', methods=['GET'])
@jwt_required()
@rate_limit
@handle_errors
def get_task_notes(request_id):
    """获取任务备注列表"""
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        cursor.execute('SELECT user_id, helper_id FROM requests WHERE id = ?', (request_id,))
        request_info = cursor.fetchone()
        
        if not request_info:
            return jsonify({'success': False, 'message': '需求不存在'}), 404
        
        if request_info['user_id'] != user_id and request_info['helper_id'] != user_id:
            return jsonify({'success': False, 'message': '只有任务相关人员可以查看备注'}), 403
        
        cursor.execute('''
            SELECT tn.*, u.nickname, u.avatar
            FROM task_notes tn
            JOIN users u ON tn.user_id = u.id
            WHERE tn.request_id = ?
            ORDER BY tn.created_at DESC
        ''', (request_id,))
        
        notes = [dict(row) for row in cursor.fetchall()]
    
    return jsonify({'success': True, 'data': notes})

# ==================== 系统通知 API ====================

def create_notification(user_id, notif_type, title, content, related_id=None, related_type=None):
    """创建系统通知"""
    try:
        with DatabaseConnection() as cursor:
            cursor.execute('''
                INSERT INTO notifications (user_id, type, title, content, related_id, related_type, is_read, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, notif_type, title, content, related_id, related_type, False, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        
        if user_id in online_users:
            socketio.emit('notification', {
                'type': notif_type,
                'title': title,
                'content': content,
                'relatedId': related_id,
                'relatedType': related_type,
                'timestamp': datetime.now().isoformat()
            }, room=online_users[user_id])
        
        return True
    except Exception as e:
        logger.error(f'创建通知失败: {e}')
        return False

@app.route('/api/notifications', methods=['GET'])
@jwt_required()
@rate_limit
@handle_errors
def get_notifications():
    """获取用户通知列表"""
    user_id = get_jwt_identity()
    limit = min(int(request.args.get('limit', 20)), 100)
    offset = int(request.args.get('offset', 0))
    
    with DatabaseConnection() as cursor:
        cursor.execute('''
            SELECT * FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        ''', (user_id, limit, offset))
        
        notifications = [dict(row) for row in cursor.fetchall()]
        
        cursor.execute('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = ?', (user_id, False))
        unread_count = cursor.fetchone()[0]
    
    return jsonify({'success': True, 'data': {'notifications': notifications, 'unread_count': unread_count}})

@app.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
@jwt_required()
@rate_limit
@handle_errors
def mark_notification_read(notification_id):
    """标记通知为已读"""
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        cursor.execute('UPDATE notifications SET is_read = ? WHERE id = ? AND user_id = ?', (True, notification_id, user_id))
    
    return jsonify({'success': True, 'message': '已标记为已读'})

@app.route('/api/notifications/read-all', methods=['POST'])
@jwt_required()
@rate_limit
@handle_errors
def mark_all_notifications_read():
    """标记所有通知为已读"""
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        cursor.execute('UPDATE notifications SET is_read = ? WHERE user_id = ?', (True, user_id))
    
    return jsonify({'success': True, 'message': '所有通知已标记为已读'})

# ==================== 消息已读/未读 API ====================

@app.route('/api/messages/<int:message_id>/read', methods=['POST'])
@jwt_required()
@rate_limit
@handle_errors
def mark_message_read(message_id):
    """标记消息为已读"""
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        cursor.execute('UPDATE messages SET is_read = ? WHERE id = ? AND receiver_id = ?', (True, message_id, user_id))
    
    return jsonify({'success': True, 'message': '消息已标记为已读'})

@app.route('/api/messages/conversations/<int:other_user_id>/read', methods=['POST'])
@jwt_required()
@rate_limit
@handle_errors
def mark_conversation_read(other_user_id):
    """标记与某人的所有消息为已读"""
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        cursor.execute('''
            UPDATE messages SET is_read = ? 
            WHERE sender_id = ? AND receiver_id = ? AND is_read = ?
        ''', (True, other_user_id, user_id, False))
    
    return jsonify({'success': True, 'message': '会话已标记为已读'})

@app.route('/api/messages/unread-count', methods=['GET'])
@jwt_required()
@rate_limit
@handle_errors
def get_unread_message_count():
    """获取未读消息数量"""
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        cursor.execute('SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND is_read = ?', (user_id, False))
        count = cursor.fetchone()[0]
    
    return jsonify({'success': True, 'data': {'unread_count': count}})

# ==================== 搜索和筛选增强 API ====================

@app.route('/api/requests', methods=['GET'])
@rate_limit
@handle_errors
def get_requests():
    """获取需求列表（增强版，支持价格和距离筛选）"""
    logger.info(f"获取需求列表 - 参数: {request.args}")

    status = request.args.get('status', 'pending')
    category = request.args.get('category', 'all')
    current_user_id = request.args.get('user_id', 1)
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)
    max_distance = request.args.get('max_distance', type=float)

    with DatabaseConnection() as cursor:
        cursor.execute("SELECT lat, lng FROM users WHERE id = ?", (current_user_id,))
        user_loc = cursor.fetchone()
        user_lat = user_loc[0] if user_loc else None
        user_lng = user_loc[1] if user_loc else None

        query = '''
            SELECT r.*, u.nickname as user_nickname, u.avatar as user_avatar, u.rating as user_rating
            FROM requests r
            JOIN users u ON r.user_id = u.id
            WHERE 1=1
        '''
        params = []

        if status != 'all':
            query += ' AND r.status = ?'
            params.append(status)

        if category != 'all':
            query += ' AND r.category = ?'
            params.append(category)

        query += ' ORDER BY r.created_at DESC'

        cursor.execute(query, params)
        requests_list = []
        for row in cursor.fetchall():
            req = dict(row)
            if user_lat is not None and user_lng is not None and req['lat'] is not None and req['lng'] is not None:
                distance = calculate_distance(user_lat, user_lng, req['lat'], req['lng'])
                req['distance'] = distance
                req['distance_text'] = f'{distance}km' if distance is not None else None
            else:
                req['distance'] = None
                req['distance_text'] = None
            
            try:
                import re
                amount_match = re.search(r'\d+(\.\d+)?', req['reward'] or '')
                req['reward_amount'] = float(amount_match.group()) if amount_match else 0.0
            except:
                req['reward_amount'] = 0.0
            
            requests_list.append(req)
        
        filtered_requests = []
        for req in requests_list:
            if min_price is not None and req['reward_amount'] < min_price:
                continue
            if max_price is not None and req['reward_amount'] > max_price:
                continue
            if max_distance is not None and req['distance'] is not None and req['distance'] > max_distance:
                continue
            filtered_requests.append(req)

    logger.info(f"返回 {len(filtered_requests)} 条需求")
    return jsonify({'success': True, 'data': filtered_requests})

# ==================== 实名认证 API ====================

@app.route('/api/users/verify', methods=['POST'])
@jwt_required()
@rate_limit
@handle_errors
def submit_verification():
    """提交实名认证信息"""
    data = request.json
    real_name = data.get('real_name', '').strip()
    id_card = data.get('id_card', '').strip()
    user_id = get_jwt_identity()
    
    if not real_name or not id_card:
        return jsonify({'success': False, 'message': '请填写真实姓名和身份证号'}), 400
    
    if len(id_card) not in [15, 18]:
        return jsonify({'success': False, 'message': '身份证号格式不正确'}), 400
    
    with DatabaseConnection() as cursor:
        cursor.execute('''
            UPDATE users 
            SET real_name = ?, id_card = ?, is_verified = ?, verified_at = ?
            WHERE id = ?
        ''', (real_name, id_card, 1, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user_id))
    
    return jsonify({'success': True, 'message': '实名认证已提交'})

@app.route('/api/users/verification', methods=['GET'])
@jwt_required()
@rate_limit
@handle_errors
def get_verification_status():
    """获取实名认证状态"""
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        cursor.execute('SELECT is_verified, verified_at, real_name, id_card FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
    
    if user:
        return jsonify({'success': True, 'data': {
            'is_verified': bool(user['is_verified']),
            'verified_at': user['verified_at'],
            'real_name': user['real_name'],
            'id_card': user['id_card'][:6] + '********' + user['id_card'][-4:] if user['id_card'] else None
        }})
    return jsonify({'success': False, 'message': '用户不存在'}), 404

# ==================== 举报和拉黑 API ====================

@app.route('/api/blacklist', methods=['POST'])
@jwt_required()
@rate_limit
@handle_errors
def add_to_blacklist():
    """拉黑用户"""
    data = request.json
    blocked_user_id = data.get('blocked_user_id')
    user_id = get_jwt_identity()
    
    if not blocked_user_id:
        return jsonify({'success': False, 'message': '请提供要拉黑的用户ID'}), 400
    
    if blocked_user_id == user_id:
        return jsonify({'success': False, 'message': '不能拉黑自己'}), 400
    
    try:
        with DatabaseConnection() as cursor:
            cursor.execute('''
                INSERT OR IGNORE INTO blacklist (user_id, blocked_user_id, created_at)
                VALUES (?, ?, ?)
            ''', (user_id, blocked_user_id, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    except:
        return jsonify({'success': False, 'message': '已在黑名单中'}), 400
    
    return jsonify({'success': True, 'message': '已加入黑名单'})

@app.route('/api/blacklist/<int:blocked_user_id>', methods=['DELETE'])
@jwt_required()
@rate_limit
@handle_errors
def remove_from_blacklist(blocked_user_id):
    """移除黑名单"""
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        cursor.execute('DELETE FROM blacklist WHERE user_id = ? AND blocked_user_id = ?', (user_id, blocked_user_id))
    
    return jsonify({'success': True, 'message': '已从黑名单移除'})

@app.route('/api/blacklist', methods=['GET'])
@jwt_required()
@rate_limit
@handle_errors
def get_blacklist():
    """获取黑名单列表"""
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        cursor.execute('''
            SELECT b.*, u.nickname, u.avatar
            FROM blacklist b
            JOIN users u ON b.blocked_user_id = u.id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        ''', (user_id,))
        
        blacklist = [dict(row) for row in cursor.fetchall()]
    
    return jsonify({'success': True, 'data': blacklist})

@app.route('/api/reports', methods=['POST'])
@jwt_required()
@rate_limit
@handle_errors
def submit_report():
    """提交举报"""
    data = request.json
    reported_user_id = data.get('reported_user_id')
    request_id = data.get('request_id')
    report_type = data.get('type', '').strip()
    description = data.get('description', '').strip()
    user_id = get_jwt_identity()
    
    if not report_type or not description:
        return jsonify({'success': False, 'message': '请填写举报类型和描述'}), 400
    
    if not reported_user_id and not request_id:
        return jsonify({'success': False, 'message': '请提供被举报用户或任务'}), 400
    
    with DatabaseConnection() as cursor:
        cursor.execute('''
            INSERT INTO reports (reporter_id, reported_user_id, request_id, type, description, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, reported_user_id, request_id, report_type, description, 'pending', datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
    
    return jsonify({'success': True, 'message': '举报已提交'})

@app.route('/api/reports/my', methods=['GET'])
@jwt_required()
@rate_limit
@handle_errors
def get_my_reports():
    """获取我的举报列表"""
    user_id = get_jwt_identity()
    
    with DatabaseConnection() as cursor:
        cursor.execute('''
            SELECT r.*, u.nickname as reporter_nickname
            FROM reports r
            LEFT JOIN users u ON r.reporter_id = u.id
            WHERE r.reporter_id = ?
            ORDER BY r.created_at DESC
        ''', (user_id,))
        
        reports = [dict(row) for row in cursor.fetchall()]
    
    return jsonify({'success': True, 'data': reports})

# ==================== 修改接单API，添加通知 ====================

@app.route('/api/requests/<int:request_id>/accept', methods=['POST'])
@jwt_required()
def accept_request(request_id):
    data = request.json
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        conn.execute('BEGIN IMMEDIATE TRANSACTION')
        
        cursor.execute('SELECT user_id, status, helper_id, title FROM requests WHERE id = ?', (request_id,))
        request_info = cursor.fetchone()
        
        if not request_info:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '需求不存在'}), 404
        
        if request_info['user_id'] == user_id:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '不能接受自己发布的需求'}), 400
        
        if request_info['status'] != 'pending':
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '该需求已不接受帮助'}), 400
        
        if request_info['helper_id']:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '已有其他帮助者接单'}), 400
        
        cursor.execute('''
            UPDATE requests SET status = 'accepted', helper_id = ? WHERE id = ?
        ''', (user_id, request_id))
        
        cursor.execute('''
            INSERT INTO help_records (request_id, helper_id, status, created_at)
            VALUES (?, ?, 'accepted', ?)
        ''', (request_id, user_id, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        
        # 创建接单通知给发布者
        notif_result = create_notification(request_info['user_id'], 'request_accepted', '您的任务被接单了', f'任务「{request_info["title"]}」已有人接单', request_id, 'request')
        logger.info(f"接单通知创建结果: {notif_result}, 发布者ID: {request_info['user_id']}")

        # 自动发送消息给发单人
        try:
            # 获取接单人信息
            cursor.execute('SELECT name, avatar FROM users WHERE id = ?', (user_id,))
            helper_info = cursor.fetchone()
            helper_name = helper_info['name'] if helper_info else '帮助者'
            
            welcome_message = '你好，我来帮你！'
            cursor.execute('''
                INSERT INTO messages (sender_id, receiver_id, request_id, content, created_at, is_read)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, request_info['user_id'], request_id, welcome_message, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), False))
            
            # 通过WebSocket发送实时消息（如果发单人在线）
            if request_info['user_id'] in online_users:
                socketio.emit('new_message', {
                    'senderId': user_id,
                    'senderName': helper_name,
                    'message': welcome_message,
                    'requestId': request_id,
                    'timestamp': datetime.now().isoformat()
                }, room=online_users[request_info['user_id']])
            
            # 为发单人创建消息通知
            create_notification(request_info['user_id'], 'message', f'来自 {helper_name} 的新消息', welcome_message, request_id, 'message')
            
            logger.info(f"自动发送欢迎消息成功: 接单人 {user_id} -> 发单人 {request_info['user_id']}")
        except Exception as msg_e:
            logger.error(f"自动发送欢迎消息失败: {msg_e}")
            # 不影响主流程，继续执行

        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '接受帮助成功'})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'}), 500

# ==================== 修改完成任务API，添加通知 ====================

@app.route('/api/requests/<int:request_id>/complete', methods=['POST'])
@jwt_required()
def complete_request(request_id):
    user_id = get_jwt_identity()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        conn.execute('BEGIN IMMEDIATE TRANSACTION')
        
        cursor.execute('SELECT user_id, helper_id, reward, status, title FROM requests WHERE id = ?', (request_id,))
        request_info = cursor.fetchone()
        if not request_info:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '任务不存在'}), 404
        
        user_id_db, helper_id, reward, status, title = request_info
        
        if user_id_db != user_id:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '只有发布者才能确认完成'}), 403
        
        if status != 'accepted':
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '任务未被接受，无法完成'}), 400
        
        if not helper_id:
            conn.rollback()
            conn.close()
            return jsonify({'success': False, 'message': '接单人未指定'}), 400
        
        amount = 0.0
        if reward:
            import re
            amount_match = re.search(r'\d+(\.\d+)?', reward)
            if amount_match:
                amount = float(amount_match.group())
        
        cursor.execute('''
            UPDATE requests SET status = 'completed', completed_at = ? WHERE id = ?
        ''', (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), request_id))
        
        cursor.execute('''
            UPDATE help_records SET status = 'completed', completed_at = ? WHERE request_id = ?
        ''', (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), request_id))
        
        if amount > 0:
            cursor.execute('SELECT id, balance FROM wallets WHERE user_id = ?', (user_id_db,))
            requester_wallet = cursor.fetchone()
            if not requester_wallet:
                conn.rollback()
                conn.close()
                return jsonify({'success': False, 'message': '发布者钱包未初始化'}), 500
            
            requester_wallet_id = requester_wallet[0]
            requester_balance = requester_wallet[1]
            
            if requester_balance < amount:
                conn.rollback()
                conn.close()
                return jsonify({'success': False, 'message': '发布者账户余额不足'}), 500
            
            cursor.execute('SELECT id, balance FROM wallets WHERE user_id = ?', (helper_id,))
            helper_wallet = cursor.fetchone()
            if not helper_wallet:
                cursor.execute('INSERT INTO wallets (user_id, balance, frozen_amount) VALUES (?, ?, ?)', (helper_id, 0.0, 0.0))
                helper_wallet_id = cursor.lastrowid
                helper_balance = 0.0
            else:
                helper_wallet_id = helper_wallet[0]
                helper_balance = helper_wallet[1]
            
            new_requester_balance = requester_balance - amount
            cursor.execute('UPDATE wallets SET balance = ?, updated_at = ? WHERE user_id = ?', 
                         (new_requester_balance, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user_id_db))
            cursor.execute('INSERT INTO wallet_transactions (wallet_id, type, amount, balance_after, description, related_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                         (requester_wallet_id, 'payment', amount, new_requester_balance, f'支付任务报酬: {title}', request_id, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
            
            new_helper_balance = helper_balance + amount
            cursor.execute('UPDATE wallets SET balance = ?, updated_at = ? WHERE user_id = ?', 
                         (new_helper_balance, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), helper_id))
            cursor.execute('INSERT INTO wallet_transactions (wallet_id, type, amount, balance_after, description, related_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                         (helper_wallet_id, 'income', amount, new_helper_balance, f'任务完成报酬: {title}', request_id, datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
        
        create_notification(helper_id, 'task_completed', '任务已完成', f'您接的任务「{title}」已完成', request_id, 'request')

        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '需求已完成'})
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        logger.error(f"完成任务错误: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'}), 500

if __name__ == '__main__':
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
