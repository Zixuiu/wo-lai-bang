import uuid
from datetime import datetime
import json
from .database import get_db_connection

class PaymentManager:
    """支付管理器"""

    PAYMENT_STATUS = {
        'pending': '待支付',
        'paid': '已支付',
        'failed': '支付失败',
        'refunded': '已退款',
        'partial_refunded': '部分退款'
    }

    PAYMENT_METHODS = {
        'alipay': '支付宝',
        'wechat': '微信支付',
        'wallet': '钱包余额'
    }

    @staticmethod
    def create_payment(request_id, payer_id, payee_id, amount, payment_method='wallet', description=''):
        """创建支付订单"""
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            transaction_id = f"PAY{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:8].upper()}"

            cursor.execute('''
                INSERT INTO payments
                (request_id, payer_id, payee_id, amount, payment_method, status, transaction_id, created_at, description)
                VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
            ''', (request_id, payer_id, payee_id, amount, payment_method, transaction_id,
                  datetime.now().strftime('%Y-%m-%d %H:%M:%S'), description))

            payment_id = cursor.lastrowid
            conn.commit()

            return {
                'success': True,
                'payment_id': payment_id,
                'transaction_id': transaction_id,
                'amount': amount,
                'message': '支付订单创建成功'
            }
        except Exception as e:
            conn.rollback()
            return {'success': False, 'message': f'创建支付订单失败: {str(e)}'}
        finally:
            conn.close()

    @staticmethod
    def process_payment(payment_id, payment_method='wallet'):
        """处理支付"""
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute('SELECT * FROM payments WHERE id = ?', (payment_id,))
            payment = cursor.fetchone()

            if not payment:
                return {'success': False, 'message': '支付订单不存在'}

            payment = dict(payment)

            if payment['status'] != 'pending':
                return {'success': False, 'message': '订单状态不正确'}

            payer_id = payment['payer_id']
            payee_id = payment['payee_id']
            amount = payment['amount']

            if payment_method == 'wallet':
                cursor.execute('SELECT * FROM wallets WHERE user_id = ?', (payer_id,))
                payer_wallet = cursor.fetchone()

                if not payer_wallet:
                    cursor.execute('''
                        INSERT INTO wallets (user_id, balance, frozen_amount, total_income, total_expense, created_at, updated_at)
                        VALUES (?, 0, 0, 0, 0, ?, ?)
                    ''', (payer_id, datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                          datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
                    conn.commit()
                    return {'success': False, 'message': '钱包余额不足'}

                payer_wallet = dict(payer_wallet)
                if payer_wallet['balance'] < amount:
                    return {'success': False, 'message': '钱包余额不足'}

                new_payer_balance = payer_wallet['balance'] - amount
                cursor.execute('''
                    UPDATE wallets
                    SET balance = ?, total_expense = total_expense + ?, updated_at = ?
                    WHERE user_id = ?
                ''', (new_payer_balance, amount, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), payer_id))

                cursor.execute('''
                    INSERT INTO wallet_transactions
                    (wallet_id, user_id, type, amount, balance_after, related_id, related_type, description, created_at)
                    VALUES (?, ?, 'payment', ?, ?, ?, 'payment', ?, ?)
                ''', (payer_wallet['id'], payer_id, -amount, new_payer_balance, payment_id,
                      f'支付订单 #{payment_id}', datetime.now().strftime('%Y-%m-%d %H:%M:%S')))

                cursor.execute('SELECT * FROM wallets WHERE user_id = ?', (payee_id,))
                payee_wallet = cursor.fetchone()

                if not payee_wallet:
                    cursor.execute('''
                        INSERT INTO wallets (user_id, balance, frozen_amount, total_income, total_expense, created_at, updated_at)
                        VALUES (?, ?, 0, ?, 0, ?, ?)
                    ''', (payee_id, amount, amount, datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                          datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
                    payee_wallet_id = cursor.lastrowid
                    new_payee_balance = amount
                else:
                    payee_wallet = dict(payee_wallet)
                    new_payee_balance = payee_wallet['balance'] + amount
                    cursor.execute('''
                        UPDATE wallets
                        SET balance = ?, total_income = total_income + ?, updated_at = ?
                        WHERE user_id = ?
                    ''', (new_payee_balance, amount, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), payee_id))
                    payee_wallet_id = payee_wallet['id']

                cursor.execute('''
                    INSERT INTO wallet_transactions
                    (wallet_id, user_id, type, amount, balance_after, related_id, related_type, description, created_at)
                    VALUES (?, ?, 'income', ?, ?, ?, 'payment', ?, ?)
                ''', (payee_wallet_id, payee_id, amount, new_payee_balance, payment_id,
                      f'收到订单 #{payment_id} 付款', datetime.now().strftime('%Y-%m-%d %H:%M:%S')))

            cursor.execute('''
                UPDATE payments
                SET status = 'paid', paid_at = ?, payment_method = ?
                WHERE id = ?
            ''', (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), payment_method, payment_id))

            conn.commit()

            return {
                'success': True,
                'message': '支付成功',
                'payment_id': payment_id,
                'amount': amount
            }

        except Exception as e:
            conn.rollback()
            return {'success': False, 'message': f'支付处理失败: {str(e)}'}
        finally:
            conn.close()

    @staticmethod
    def get_payment(payment_id):
        """获取支付订单详情"""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT p.*,
                   payer.nickname as payer_name,
                   payee.nickname as payee_name,
                   r.title as request_title
            FROM payments p
            JOIN users payer ON p.payer_id = payer.id
            JOIN users payee ON p.payee_id = payee.id
            JOIN requests r ON p.request_id = r.id
            WHERE p.id = ?
        ''', (payment_id,))

        payment = cursor.fetchone()
        conn.close()

        if payment:
            return {'success': True, 'data': dict(payment)}
        return {'success': False, 'message': '支付订单不存在'}

    @staticmethod
    def get_user_payments(user_id, role='all', status=None, limit=20, offset=0):
        """获取用户的支付记录"""
        conn = get_db_connection()
        cursor = conn.cursor()

        query = '''
            SELECT p.*,
                   payer.nickname as payer_name,
                   payee.nickname as payee_name,
                   r.title as request_title
            FROM payments p
            JOIN users payer ON p.payer_id = payer.id
            JOIN users payee ON p.payee_id = payee.id
            JOIN requests r ON p.request_id = r.id
            WHERE 1=1
        '''
        params = []

        if role == 'payer':
            query += ' AND p.payer_id = ?'
            params.append(user_id)
        elif role == 'payee':
            query += ' AND p.payee_id = ?'
            params.append(user_id)
        else:
            query += ' AND (p.payer_id = ? OR p.payee_id = ?)'
            params.extend([user_id, user_id])

        if status:
            query += ' AND p.status = ?'
            params.append(status)

        query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])

        cursor.execute(query, params)
        payments = [dict(row) for row in cursor.fetchall()]

        conn.close()

        return {'success': True, 'data': payments}


class WalletManager:
    """钱包管理器"""

    @staticmethod
    def get_wallet(user_id):
        """获取用户钱包信息"""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM wallets WHERE user_id = ?', (user_id,))
        wallet = cursor.fetchone()

        if not wallet:
            cursor.execute('''
                INSERT INTO wallets (user_id, balance, frozen_amount, total_income, total_expense, created_at, updated_at)
                VALUES (?, 0, 0, 0, 0, ?, ?)
            ''', (user_id, datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                  datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
            conn.commit()

            cursor.execute('SELECT * FROM wallets WHERE user_id = ?', (user_id,))
            wallet = cursor.fetchone()

        conn.close()

        return {'success': True, 'data': dict(wallet)}

    @staticmethod
    def get_transactions(user_id, transaction_type=None, limit=20, offset=0):
        """获取钱包交易记录"""
        conn = get_db_connection()
        cursor = conn.cursor()

        query = '''
            SELECT wt.*, u.nickname as user_name
            FROM wallet_transactions wt
            JOIN users u ON wt.user_id = u.id
            WHERE wt.user_id = ?
        '''
        params = [user_id]

        if transaction_type:
            query += ' AND wt.type = ?'
            params.append(transaction_type)

        query += ' ORDER BY wt.created_at DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])

        cursor.execute(query, params)
        transactions = [dict(row) for row in cursor.fetchall()]

        conn.close()

        return {'success': True, 'data': transactions}

    @staticmethod
    def recharge(user_id, amount, payment_method='alipay'):
        """钱包充值"""
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute('SELECT * FROM wallets WHERE user_id = ?', (user_id,))
            wallet = cursor.fetchone()

            if not wallet:
                cursor.execute('''
                    INSERT INTO wallets (user_id, balance, frozen_amount, total_income, total_expense, created_at, updated_at)
                    VALUES (?, 0, 0, 0, 0, ?, ?)
                ''', (user_id, datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                      datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
                conn.commit()
                wallet_id = cursor.lastrowid
                balance = 0
            else:
                wallet = dict(wallet)
                wallet_id = wallet['id']
                balance = wallet['balance']

            new_balance = balance + amount
            cursor.execute('''
                UPDATE wallets
                SET balance = ?, total_income = total_income + ?, updated_at = ?
                WHERE id = ?
            ''', (new_balance, amount, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), wallet_id))

            cursor.execute('''
                INSERT INTO wallet_transactions
                (wallet_id, user_id, type, amount, balance_after, related_type, description, created_at)
                VALUES (?, ?, 'recharge', ?, ?, 'recharge', ?, ?)
            ''', (wallet_id, user_id, amount, new_balance,
                  f'{payment_method}充值', datetime.now().strftime('%Y-%m-%d %H:%M:%S')))

            conn.commit()

            return {'success': True, 'message': '充值成功', 'amount': amount, 'balance': new_balance}

        except Exception as e:
            conn.rollback()
            return {'success': False, 'message': f'充值失败: {str(e)}'}
        finally:
            conn.close()


class WithdrawalManager:
    """提现管理器"""

    WITHDRAWAL_STATUS = {
        'pending': '待处理',
        'processing': '处理中',
        'completed': '已完成',
        'rejected': '已拒绝'
    }

    @staticmethod
    def create_withdrawal(user_id, amount, withdrawal_method, account_info):
        """创建提现申请"""
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute('SELECT * FROM wallets WHERE user_id = ?', (user_id,))
            wallet = cursor.fetchone()

            if not wallet:
                return {'success': False, 'message': '钱包不存在'}

            wallet = dict(wallet)
            available_balance = wallet['balance'] - wallet['frozen_amount']

            if available_balance < amount:
                return {'success': False, 'message': '可用余额不足'}

            new_frozen = wallet['frozen_amount'] + amount
            cursor.execute('''
                UPDATE wallets SET frozen_amount = ?, updated_at = ?
                WHERE id = ?
            ''', (new_frozen, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), wallet['id']))

            cursor.execute('''
                INSERT INTO withdrawals
                (user_id, amount, status, withdrawal_method, account_info, created_at)
                VALUES (?, ?, 'pending', ?, ?, ?)
            ''', (user_id, amount, withdrawal_method, json.dumps(account_info),
                  datetime.now().strftime('%Y-%m-%d %H:%M:%S')))

            withdrawal_id = cursor.lastrowid

            cursor.execute('''
                INSERT INTO wallet_transactions
                (wallet_id, user_id, type, amount, balance_after, related_id, related_type, description, created_at)
                VALUES (?, ?, 'withdrawal_freeze', ?, ?, ?, 'withdrawal', ?, ?)
            ''', (wallet['id'], user_id, -amount, wallet['balance'], withdrawal_id,
                  f'提现申请 #{withdrawal_id}', datetime.now().strftime('%Y-%m-%d %H:%M:%S')))

            conn.commit()

            return {
                'success': True,
                'message': '提现申请已提交',
                'withdrawal_id': withdrawal_id,
                'amount': amount
            }

        except Exception as e:
            conn.rollback()
            return {'success': False, 'message': f'提现申请失败: {str(e)}'}
        finally:
            conn.close()

    @staticmethod
    def get_withdrawals(user_id, status=None, limit=20, offset=0):
        """获取提现记录"""
        conn = get_db_connection()
        cursor = conn.cursor()

        query = 'SELECT * FROM withdrawals WHERE user_id = ?'
        params = [user_id]

        if status:
            query += ' AND status = ?'
            params.append(status)

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])

        cursor.execute(query, params)
        withdrawals = [dict(row) for row in cursor.fetchall()]

        conn.close()

        return {'success': True, 'data': withdrawals}
