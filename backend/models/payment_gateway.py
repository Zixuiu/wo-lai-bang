"""
支付网关集成模块
支持支付宝和微信支付
"""

import json
import uuid
from datetime import datetime
from abc import ABC, abstractmethod


class PaymentGateway(ABC):
    """支付网关抽象基类"""
    
    @abstractmethod
    def create_order(self, order_id, amount, description, notify_url, return_url):
        """创建支付订单"""
        pass
    
    @abstractmethod
    def verify_callback(self, data):
        """验证支付回调"""
        pass
    
    @abstractmethod
    def refund(self, order_id, refund_amount, reason):
        """申请退款"""
        pass


class AlipayGateway(PaymentGateway):
    """支付宝支付网关"""
    
    def __init__(self, app_id, private_key, alipay_public_key, sandbox=True):
        self.app_id = app_id
        self.private_key = private_key
        self.alipay_public_key = alipay_public_key
        self.sandbox = sandbox
        
        # 沙箱环境或生产环境
        if sandbox:
            self.gateway_url = "https://openapi.alipaydev.com/gateway.do"
        else:
            self.gateway_url = "https://openapi.alipay.com/gateway.do"
    
    def create_order(self, order_id, amount, description, notify_url, return_url):
        """创建支付宝订单"""
        # 这里应该使用支付宝 SDK 创建订单
        # 为了演示，返回模拟数据
        
        biz_content = {
            'out_trade_no': order_id,
            'total_amount': str(amount),
            'subject': description,
            'product_code': 'FAST_INSTANT_TRADE_PAY'
        }
        
        # 实际项目中应该调用支付宝 SDK
        # from alipay import AliPay
        # alipay = AliPay(...)
        # order_string = alipay.api_alipay_trade_page_pay(...)
        
        return {
            'success': True,
            'gateway_url': self.gateway_url,
            'order_id': order_id,
            'amount': amount,
            'pay_url': f'{self.gateway_url}?order_id={order_id}',  # 模拟支付链接
            'message': '支付宝订单创建成功（模拟）'
        }
    
    def verify_callback(self, data):
        """验证支付宝回调"""
        # 实际项目中应该验证签名等
        # 这里返回模拟验证结果
        
        trade_status = data.get('trade_status', '')
        out_trade_no = data.get('out_trade_no', '')
        trade_no = data.get('trade_no', '')
        total_amount = data.get('total_amount', '0')
        
        if trade_status in ['TRADE_SUCCESS', 'TRADE_FINISHED']:
            return {
                'success': True,
                'order_id': out_trade_no,
                'transaction_id': trade_no,
                'amount': float(total_amount),
                'message': '支付成功'
            }
        
        return {
            'success': False,
            'message': f'支付状态: {trade_status}'
        }
    
    def refund(self, order_id, refund_amount, reason):
        """支付宝退款"""
        # 实际项目中应该调用支付宝退款接口
        refund_id = f'REF{datetime.now().strftime("%Y%m%d%H%M%S")}{uuid.uuid4().hex[:8]}'
        
        return {
            'success': True,
            'refund_id': refund_id,
            'order_id': order_id,
            'amount': refund_amount,
            'message': '退款申请已提交（模拟）'
        }


class WechatPayGateway(PaymentGateway):
    """微信支付网关"""
    
    def __init__(self, app_id, mch_id, api_key, sandbox=True):
        self.app_id = app_id
        self.mch_id = mch_id
        self.api_key = api_key
        self.sandbox = sandbox
        
        # 沙箱环境或生产环境
        if sandbox:
            self.gateway_url = "https://api.mch.weixin.qq.com/sandboxnew"
        else:
            self.gateway_url = "https://api.mch.weixin.qq.com"
    
    def create_order(self, order_id, amount, description, notify_url, return_url):
        """创建微信订单"""
        # 微信金额单位为分
        amount_in_cents = int(amount * 100)
        
        # 实际项目中应该使用微信支付 SDK
        # 这里返回模拟数据
        
        return {
            'success': True,
            'gateway_url': self.gateway_url,
            'order_id': order_id,
            'amount': amount,
            'prepay_id': f'wx{uuid.uuid4().hex[:16]}',  # 模拟预支付ID
            'pay_params': {
                'appId': self.app_id,
                'timeStamp': str(int(datetime.now().timestamp())),
                'nonceStr': uuid.uuid4().hex[:16],
                'package': f'prepay_id=wx{uuid.uuid4().hex[:16]}',
                'signType': 'RSA',
                'paySign': '模拟签名'
            },
            'message': '微信订单创建成功（模拟）'
        }
    
    def verify_callback(self, data):
        """验证微信回调"""
        # 实际项目中应该验证签名等
        result_code = data.get('result_code', '')
        out_trade_no = data.get('out_trade_no', '')
        transaction_id = data.get('transaction_id', '')
        total_fee = data.get('total_fee', '0')
        
        if result_code == 'SUCCESS':
            return {
                'success': True,
                'order_id': out_trade_no,
                'transaction_id': transaction_id,
                'amount': float(total_fee) / 100,  # 转换为元
                'message': '支付成功'
            }
        
        return {
            'success': False,
            'message': f'支付失败: {data.get("err_code_des", "未知错误")}'
        }
    
    def refund(self, order_id, refund_amount, reason):
        """微信退款"""
        # 实际项目中应该调用微信退款接口
        refund_id = f'REF{datetime.now().strftime("%Y%m%d%H%M%S")}{uuid.uuid4().hex[:8]}'
        
        return {
            'success': True,
            'refund_id': refund_id,
            'order_id': order_id,
            'amount': refund_amount,
            'message': '退款申请已提交（模拟）'
        }


class PaymentGatewayFactory:
    """支付网关工厂类"""
    
    _gateways = {}
    
    @classmethod
    def get_gateway(cls, gateway_type, **kwargs):
        """获取支付网关实例"""
        if gateway_type not in cls._gateways:
            if gateway_type == 'alipay':
                cls._gateways[gateway_type] = AlipayGateway(
                    app_id=kwargs.get('app_id', ''),
                    private_key=kwargs.get('private_key', ''),
                    alipay_public_key=kwargs.get('alipay_public_key', ''),
                    sandbox=kwargs.get('sandbox', True)
                )
            elif gateway_type == 'wechat':
                cls._gateways[gateway_type] = WechatPayGateway(
                    app_id=kwargs.get('app_id', ''),
                    mch_id=kwargs.get('mch_id', ''),
                    api_key=kwargs.get('api_key', ''),
                    sandbox=kwargs.get('sandbox', True)
                )
            else:
                raise ValueError(f'不支持的支付网关类型: {gateway_type}')
        
        return cls._gateways[gateway_type]
    
    @classmethod
    def create_payment(cls, gateway_type, order_id, amount, description, notify_url, return_url, **kwargs):
        """创建支付订单"""
        try:
            gateway = cls.get_gateway(gateway_type, **kwargs)
            return gateway.create_order(order_id, amount, description, notify_url, return_url)
        except Exception as e:
            return {
                'success': False,
                'message': f'创建支付订单失败: {str(e)}'
            }
    
    @classmethod
    def verify_callback(cls, gateway_type, data, **kwargs):
        """验证支付回调"""
        try:
            gateway = cls.get_gateway(gateway_type, **kwargs)
            return gateway.verify_callback(data)
        except Exception as e:
            return {
                'success': False,
                'message': f'验证回调失败: {str(e)}'
            }
    
    @classmethod
    def refund(cls, gateway_type, order_id, refund_amount, reason, **kwargs):
        """申请退款"""
        try:
            gateway = cls.get_gateway(gateway_type, **kwargs)
            return gateway.refund(order_id, refund_amount, reason)
        except Exception as e:
            return {
                'success': False,
                'message': f'退款申请失败: {str(e)}'
            }


# 配置示例
PAYMENT_CONFIG = {
    'alipay': {
        'app_id': 'your_alipay_app_id',
        'private_key': 'your_alipay_private_key',
        'alipay_public_key': 'your_alipay_public_key',
        'sandbox': True  # 开发环境使用沙箱
    },
    'wechat': {
        'app_id': 'your_wechat_app_id',
        'mch_id': 'your_wechat_mch_id',
        'api_key': 'your_wechat_api_key',
        'sandbox': True  # 开发环境使用沙箱
    }
}
