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
    return ma_values.fillna(None).tolist()

def calculate_rsi(data: pd.DataFrame, period: int = 14) -> List[float]:
    """计算RSI指标"""
    if len(data) < period + 1:
        return [None] * len(data)
    
    delta = data['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(None).tolist()

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
    
    return {
        'macd': macd.fillna(None).tolist(),
        'signal': signal_line.fillna(None).tolist(),
        'histogram': histogram.fillna(None).tolist()
    }


# API Routes
@api_router.get("/")
async def root():
    return {"message": "A股看盘软件 API 已启动"}

@api_router.get("/stocks/search")
async def search_stocks(query: str = ""):
    """搜索股票"""
    try:
        if not query:
            # 获取热门股票
            df = ak.stock_zh_a_spot_em()
            df = df.head(20)  # 取前20只股票
        else:
            # 搜索股票
            df = ak.stock_zh_a_spot_em()
            df = df[df['名称'].str.contains(query, na=False) | df['代码'].str.contains(query, na=False)]
            df = df.head(10)
        
        stocks = []
        for _, row in df.iterrows():
            try:
                stock = StockInfo(
                    code=str(row['代码']),
                    name=str(row['名称']),
                    current_price=float(row['最新价']),
                    change_percent=float(row['涨跌幅']),
                    change_amount=float(row['涨跌额']),
                    volume=int(row['成交量']) if '成交量' in row and pd.notna(row['成交量']) else None,
                    market_cap=float(row['总市值']) if '总市值' in row and pd.notna(row['总市值']) else None
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
    """获取K线数据"""
    try:
        # 根据周期选择不同的数据获取方法
        if period == "daily":
            df = ak.stock_zh_a_hist(symbol=stock_code, period="daily", adjust="qfq")
        elif period == "weekly":
            df = ak.stock_zh_a_hist(symbol=stock_code, period="weekly", adjust="qfq")
        elif period == "monthly":
            df = ak.stock_zh_a_hist(symbol=stock_code, period="monthly", adjust="qfq")
        else:
            df = ak.stock_zh_a_hist(symbol=stock_code, period="daily", adjust="qfq")
        
        if df.empty:
            return {"kline_data": [], "message": "暂无数据"}
        
        df = df.tail(limit).reset_index()
        
        kline_data = []
        for _, row in df.iterrows():
            try:
                kline = KlineData(
                    timestamp=str(row['日期']),
                    open=float(row['开盘']),
                    high=float(row['最高']),
                    low=float(row['最低']),
                    close=float(row['收盘']),
                    volume=int(row['成交量'])
                )
                kline_data.append(kline)
            except (ValueError, KeyError) as e:
                continue
        
        return {"kline_data": kline_data}
    except Exception as e:
        logger.error(f"获取K线数据失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取K线数据失败: {str(e)}")

@api_router.get("/stocks/{stock_code}/indicators")
async def get_technical_indicators(stock_code: str, indicators: str = "ma,rsi,macd"):
    """获取技术指标数据"""
    try:
        # 获取历史数据
        df = ak.stock_zh_a_hist(symbol=stock_code, period="daily", adjust="qfq")
        if df.empty:
            return {"indicators": {}, "message": "暂无数据"}
        
        df = df.tail(100).reset_index()
        df.columns = ['date', 'open', 'high', 'low', 'close', 'volume', 'turnover', 'amplitude', 'change_percent', 'change_amount', 'turnover_rate']
        
        indicators_list = indicators.split(',')
        result_indicators = {}
        timestamps = df['date'].astype(str).tolist()
        
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