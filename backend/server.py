from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import uuid
from datetime import datetime, timedelta
import akshare as ak
import pandas as pd
import numpy as np
import json


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class StockInfo(BaseModel):
    code: str
    name: str
    current_price: float
    change_percent: float
    change_amount: float
    volume: Optional[int] = None
    market_cap: Optional[float] = None

class StockSearchResult(BaseModel):
    stocks: List[StockInfo]

class KlineData(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int

class TechnicalIndicator(BaseModel):
    name: str
    values: List[float]
    timestamps: List[str]


# Stock data functions
def calculate_ma(data: pd.DataFrame, period: int = 20) -> List[float]:
    """计算移动平均线"""
    if len(data) < period:
        return [None] * len(data)
    ma_values = data['close'].rolling(window=period).mean()
    # 处理NaN值
    result = []
    for val in ma_values:
        if pd.isna(val) or not np.isfinite(val):
            result.append(None)
        else:
            result.append(float(val))
    return result

def calculate_rsi(data: pd.DataFrame, period: int = 14) -> List[float]:
    """计算RSI指标"""
    if len(data) < period + 1:
        return [None] * len(data)
    
    delta = data['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    # 避免除零错误
    loss = loss.replace(0, 1e-10)
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    
    # 处理NaN值和无穷大值
    result = []
    for val in rsi:
        if pd.isna(val) or not np.isfinite(val):
            result.append(None)
        else:
            result.append(float(val))
    return result

def calculate_macd(data: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> Dict:
    """计算MACD指标"""
    if len(data) < slow:
        return {
            'macd': [None] * len(data),
            'signal': [None] * len(data),
            'histogram': [None] * len(data)
        }
    
    ema_fast = data['close'].ewm(span=fast).mean()
    ema_slow = data['close'].ewm(span=slow).mean()
    macd = ema_fast - ema_slow
    signal_line = macd.ewm(span=signal).mean()
    histogram = macd - signal_line
    
    # 处理NaN值和无穷大值
    def clean_values(series):
        result = []
        for val in series:
            if pd.isna(val) or not np.isfinite(val):
                result.append(None)
            else:
                result.append(float(val))
        return result
    
    return {
        'macd': clean_values(macd),
        'signal': clean_values(signal_line),
        'histogram': clean_values(histogram)
    }


# API Routes
@api_router.get("/")
async def root():
    return {"message": "A股看盘软件 API 已启动"}

@api_router.get("/stocks/search")
async def search_stocks(query: str = ""):
    """搜索股票 - 测试版本"""
    try:
        # 暂时使用模拟数据，避免网络超时问题
        mock_stocks = [
            {
                "代码": "000001",
                "名称": "平安银行",
                "最新价": 12.35,
                "涨跌幅": 2.15,
                "涨跌额": 0.26,
                "成交量": 12500000,
                "总市值": 23900000000
            },
            {
                "代码": "000002", 
                "名称": "万科A",
                "最新价": 8.98,
                "涨跌幅": -1.22,
                "涨跌额": -0.11,
                "成交量": 8900000,
                "总市值": 9980000000
            },
            {
                "代码": "600036",
                "名称": "招商银行", 
                "最新价": 45.67,
                "涨跌幅": 1.85,
                "涨跌额": 0.83,
                "成交量": 5600000,
                "总市值": 127800000000
            },
            {
                "代码": "600519",
                "名称": "贵州茅台",
                "最新价": 1856.00,
                "涨跌幅": 0.65,
                "涨跌额": 12.00,
                "成交量": 340000,
                "总市值": 2330000000000
            },
            {
                "代码": "000858",
                "名称": "五粮液",
                "最新价": 155.43,
                "涨跌幅": -0.89,
                "涨跌额": -1.39,
                "成交量": 2100000,
                "总市值": 600000000000
            }
        ]
        
        # 如果有查询条件，进行过滤
        if query:
            filtered_stocks = []
            for stock in mock_stocks:
                if query in stock["名称"] or query in stock["代码"]:
                    filtered_stocks.append(stock)
            mock_stocks = filtered_stocks
        
        stocks = []
        for stock_dict in mock_stocks:
            try:
                stock = StockInfo(
                    code=str(stock_dict['代码']),
                    name=str(stock_dict['名称']),
                    current_price=float(stock_dict['最新价']),
                    change_percent=float(stock_dict['涨跌幅']),
                    change_amount=float(stock_dict['涨跌额']),
                    volume=int(stock_dict['成交量']) if stock_dict.get('成交量') else None,
                    market_cap=float(stock_dict['总市值']) if stock_dict.get('总市值') else None
                )
                stocks.append(stock)
            except (ValueError, KeyError) as e:
                continue
        
        return StockSearchResult(stocks=stocks)
    except Exception as e:
        logger.error(f"搜索股票失败: {e}")
        raise HTTPException(status_code=500, detail=f"搜索股票失败: {str(e)}")

@api_router.get("/stocks/{stock_code}/kline")
async def get_kline_data(stock_code: str, period: str = "daily", limit: int = 100):
    """获取K线数据 - 测试版本"""
    try:
        # 生成模拟K线数据
        from datetime import datetime, timedelta
        import random
        
        base_price = 100.0
        if stock_code == "000001":
            base_price = 12.35
        elif stock_code == "600036":
            base_price = 45.67
        elif stock_code == "600519":
            base_price = 1856.00
        elif stock_code == "000858":
            base_price = 155.43
        
        kline_data = []
        current_date = datetime.now() - timedelta(days=limit)
        current_price = base_price
        
        for i in range(limit):
            # 模拟价格波动
            change_percent = random.uniform(-0.05, 0.05)  # ±5%波动
            new_price = current_price * (1 + change_percent)
            
            high = new_price * random.uniform(1.0, 1.02)
            low = new_price * random.uniform(0.98, 1.0)
            open_price = current_price
            close_price = new_price
            volume = random.randint(1000000, 50000000)
            
            kline = KlineData(
                timestamp=current_date.strftime("%Y-%m-%d"),
                open=round(open_price, 2),
                high=round(high, 2),
                low=round(low, 2),
                close=round(close_price, 2),
                volume=volume
            )
            kline_data.append(kline)
            
            current_date += timedelta(days=1)
            current_price = new_price
        
        return {"kline_data": kline_data}
    except Exception as e:
        logger.error(f"获取K线数据失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取K线数据失败: {str(e)}")

@api_router.get("/stocks/{stock_code}/indicators")
async def get_technical_indicators(stock_code: str, indicators: str = "ma,rsi,macd"):
    """获取技术指标数据 - 测试版本"""
    try:
        # 首先获取K线数据
        kline_response = await get_kline_data(stock_code, "daily", 100)
        kline_data = kline_response["kline_data"]
        
        if not kline_data:
            return {"indicators": {}, "message": "暂无数据"}
        
        # 转换为DataFrame进行计算
        data = []
        for kline in kline_data:
            data.append({
                'date': kline.timestamp,
                'open': kline.open,
                'high': kline.high,
                'low': kline.low,
                'close': kline.close,
                'volume': kline.volume
            })
        
        df = pd.DataFrame(data)
        
        indicators_list = indicators.split(',')
        result_indicators = {}
        timestamps = df['date'].tolist()
        
        for indicator in indicators_list:
            indicator = indicator.strip().lower()
            
            if indicator == 'ma':
                ma5 = calculate_ma(df, 5)
                ma10 = calculate_ma(df, 10)
                ma20 = calculate_ma(df, 20)
                result_indicators['ma'] = {
                    'ma5': ma5,
                    'ma10': ma10,
                    'ma20': ma20,
                    'timestamps': timestamps
                }
            
            elif indicator == 'rsi':
                rsi_values = calculate_rsi(df, 14)
                result_indicators['rsi'] = {
                    'values': rsi_values,
                    'timestamps': timestamps
                }
            
            elif indicator == 'macd':
                macd_data = calculate_macd(df)
                result_indicators['macd'] = {
                    'macd': macd_data['macd'],
                    'signal': macd_data['signal'],
                    'histogram': macd_data['histogram'],
                    'timestamps': timestamps
                }
        
        return {"indicators": result_indicators}
    except Exception as e:
        logger.error(f"获取技术指标失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取技术指标失败: {str(e)}")

@api_router.get("/market/hot")
async def get_hot_stocks():
    """获取热门股票"""
    try:
        df = ak.stock_zh_a_spot_em()
        # 按成交量排序，获取热门股票
        df = df.sort_values('成交量', ascending=False).head(10)
        
        stocks = []
        for _, row in df.iterrows():
            try:
                stock = StockInfo(
                    code=str(row['代码']),
                    name=str(row['名称']),
                    current_price=float(row['最新价']),
                    change_percent=float(row['涨跌幅']),
                    change_amount=float(row['涨跌额']),
                    volume=int(row['成交量']) if pd.notna(row['成交量']) else None
                )
                stocks.append(stock)
            except (ValueError, KeyError) as e:
                continue
        
        return {"hot_stocks": stocks}
    except Exception as e:
        logger.error(f"获取热门股票失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取热门股票失败: {str(e)}")

# Original routes
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()