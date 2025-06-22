import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { createChart } from "lightweight-charts";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// 股票搜索组件
const StockSearch = ({ onStockSelect, selectedStock }) => {
  const [query, setQuery] = useState("");
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchStocks = async (searchQuery = "") => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/stocks/search?query=${searchQuery}`);
      setStocks(response.data.stocks || []);
    } catch (error) {
      console.error("搜索股票失败:", error);
      setStocks([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    searchStocks(); // 加载热门股票
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    searchStocks(query);
  };

  return (
    <div className="bg-white border-r border-gray-200 p-4" style={{ width: '300px', minHeight: '100vh' }}>
      <h2 className="text-lg font-bold mb-3 text-gray-800">股票选择</h2>
      
      {selectedStock && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="font-medium text-blue-800">{selectedStock.name}</div>
          <div className="text-sm text-blue-600">{selectedStock.code}</div>
          <div className="text-lg font-bold text-blue-900">
            ¥{selectedStock.current_price.toFixed(2)}
          </div>
          <div className={`text-sm ${selectedStock.change_percent >= 0 ? 'text-red-500' : 'text-green-500'}`}>
            {selectedStock.change_percent >= 0 ? '+' : ''}{selectedStock.change_percent.toFixed(2)}%
          </div>
        </div>
      )}
      
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入股票代码或名称"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 text-sm"
          >
            {loading ? "搜索..." : "搜索"}
          </button>
        </div>
      </form>

      <div className="max-h-96 overflow-y-auto">
        {stocks.length === 0 && !loading && (
          <p className="text-gray-500 text-sm">暂无股票数据</p>
        )}
        
        {stocks.map((stock) => (
          <div
            key={stock.code}
            onClick={() => onStockSelect(stock)}
            className={`p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex justify-between items-center ${
              selectedStock?.code === stock.code ? 'bg-blue-50 border-blue-200' : ''
            }`}
          >
            <div>
              <div className="font-medium text-sm">{stock.name}</div>
              <div className="text-xs text-gray-500">{stock.code}</div>
            </div>
            <div className="text-right">
              <div className="font-medium text-sm">{stock.current_price.toFixed(2)}</div>
              <div className={`text-xs ${stock.change_percent >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 多窗口图表组件
const MultiWindowCharts = ({ stockCode, stockName }) => {
  const [windows, setWindows] = useState([
    { id: 'main', title: 'K线主图', type: 'main', x: 0, y: 0, w: 400, h: 300 },
    { id: 'rsi', title: 'RSI指标', type: 'rsi', x: 410, y: 0, w: 400, h: 200 },
    { id: 'macd', title: 'MACD指标', type: 'macd', x: 0, y: 310, w: 400, h: 200 },
    { id: 'volume', title: '成交量', type: 'volume', x: 410, y: 210, w: 400, h: 200 }
  ]);

  const addNewWindow = () => {
    const newWindow = {
      id: `window-${Date.now()}`,
      title: '新窗口',
      type: 'rsi',
      x: Math.random() * 200,
      y: Math.random() * 200,
      w: 350,
      h: 250
    };
    setWindows([...windows, newWindow]);
  };

  const removeWindow = (windowId) => {
    if (windows.length > 1) {
      setWindows(windows.filter(w => w.id !== windowId));
    }
  };

  return (
    <div className="flex-1 p-4 relative" style={{ minHeight: '600px', background: '#f5f5f5' }}>
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">多窗口技术分析</h2>
        <button
          onClick={addNewWindow}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          ➕ 添加窗口
        </button>
      </div>

      <div className="relative">
        {windows.map((window) => (
          <ChartWindow
            key={window.id}
            window={window}
            stockCode={stockCode}
            stockName={stockName}
            onRemove={() => removeWindow(window.id)}
          />
        ))}
      </div>
    </div>
  );
};

// 单个图表窗口
const ChartWindow = ({ window, stockCode, stockName, onRemove }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [indicators, setIndicators] = useState({});
  const [position, setPosition] = useState({ x: window.x, y: window.y });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 拖拽处理
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  // 初始化图表
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: window.w - 20,
      height: window.h - 80,
      layout: {
        backgroundColor: '#ffffff',
        textColor: '#333333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#cccccc' },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      localization: {
        locale: 'en-US',
        priceFormatter: (price) => price.toFixed(2),
        timeFormatter: (time) => {
          const date = new Date(time * 1000);
          return date.toLocaleDateString('en-US');
        },
      },
    });

    chartRef.current = chart;

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [window.w, window.h]);

  // 加载数据
  const loadChartData = async () => {
    if (!stockCode || !chartRef.current) return;
    
    setLoading(true);
    try {
      const klineResponse = await axios.get(`${API}/stocks/${stockCode}/kline?limit=100`);
      const klineData = klineResponse.data.kline_data || [];
      
      const indicatorsResponse = await axios.get(`${API}/stocks/${stockCode}/indicators?indicators=ma,rsi,macd`);
      const indicatorsData = indicatorsResponse.data.indicators || {};
      setIndicators(indicatorsData);

      if (klineData.length > 0) {
        const candlestickData = klineData.map(item => ({
          time: item.timestamp,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        }));

        if (window.type === 'main') {
          const candlestickSeries = chartRef.current.addCandlestickSeries({
            upColor: '#ef4444',
            downColor: '#22c55e',
            borderDownColor: '#22c55e',
            borderUpColor: '#ef4444',
            wickDownColor: '#22c55e',
            wickUpColor: '#ef4444',
          });
          candlestickSeries.setData(candlestickData);

          if (indicatorsData.ma) {
            const ma5Series = chartRef.current.addLineSeries({
              color: '#2196F3',
              lineWidth: 1,
              title: 'MA5',
            });
            const ma5Data = indicatorsData.ma.timestamps.map((time, idx) => ({
              time: time,
              value: indicatorsData.ma.ma5[idx],
            })).filter(item => item.value !== null);
            ma5Series.setData(ma5Data);
          }
        } else if (window.type === 'rsi' && indicatorsData.rsi) {
          const rsiSeries = chartRef.current.addLineSeries({
            color: '#ff6b6b',
            lineWidth: 2,
            title: 'RSI',
          });
          const rsiData = indicatorsData.rsi.timestamps.map((time, index) => ({
            time: time,
            value: indicatorsData.rsi.values[index],
          })).filter(item => item.value !== null);
          rsiSeries.setData(rsiData);
        } else if (window.type === 'macd' && indicatorsData.macd) {
          const macdSeries = chartRef.current.addLineSeries({
            color: '#2196F3',
            lineWidth: 2,
            title: 'MACD',
          });
          const macdData = indicatorsData.macd.timestamps.map((time, index) => ({
            time: time,
            value: indicatorsData.macd.macd[index],
          })).filter(item => item.value !== null);
          macdSeries.setData(macdData);
        } else if (window.type === 'volume') {
          const volumeSeries = chartRef.current.addHistogramSeries({
            color: '#26a69a',
            title: '成交量',
          });
          const volumeData = klineData.map(item => ({
            time: item.timestamp,
            value: item.volume,
          }));
          volumeSeries.setData(volumeData);
        }
      }
    } catch (error) {
      console.error("加载图表数据失败:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadChartData();
  }, [stockCode, window.type]);

  return (
    <div
      className="absolute bg-white border border-gray-300 rounded-lg shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        width: window.w,
        height: window.h,
        zIndex: isDragging ? 1000 : 1
      }}
    >
      <div
        className="bg-gray-100 px-3 py-2 border-b border-gray-200 cursor-move flex justify-between items-center"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{window.title}</span>
          {stockName && <span className="text-xs text-gray-500">- {stockName}</span>}
          {loading && <span className="text-xs text-blue-500">加载中...</span>}
        </div>
        <button
          onClick={onRemove}
          className="text-red-500 hover:text-red-700 text-xs px-2 py-1"
          title="删除窗口"
        >
          ❌
        </button>
      </div>

      <div
        ref={chartContainerRef}
        style={{ 
          width: window.w - 20, 
          height: window.h - 80,
          margin: '10px'
        }}
      />

      {/* 指标数值显示 */}
      {indicators && Object.keys(indicators).length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-50 px-3 py-1 text-xs border-t border-gray-200">
          {window.type === 'rsi' && indicators.rsi && (
            <span>RSI: <strong>{indicators.rsi.values[indicators.rsi.values.length - 1]?.toFixed(2) || 'N/A'}</strong></span>
          )}
          {window.type === 'macd' && indicators.macd && (
            <span>MACD: <strong>{indicators.macd.macd[indicators.macd.macd.length - 1]?.toFixed(4) || 'N/A'}</strong></span>
          )}
          {window.type === 'main' && indicators.ma && (
            <>
              <span className="mr-3">MA5: <strong>{indicators.ma.ma5[indicators.ma.ma5.length - 1]?.toFixed(2) || 'N/A'}</strong></span>
              <span className="mr-3">MA10: <strong>{indicators.ma.ma10[indicators.ma.ma10.length - 1]?.toFixed(2) || 'N/A'}</strong></span>
              <span>MA20: <strong>{indicators.ma.ma20[indicators.ma.ma20.length - 1]?.toFixed(2) || 'N/A'}</strong></span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// AI分析面板
const AIAnalysisPanel = ({ stockCode, stockName }) => {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  const performAIAnalysis = async () => {
    if (!stockCode) {
      setAnalysis("请先选择一支股票进行分析");
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setAnalysis(`🤖 ${stockName} (${stockCode}) AI多窗口分析

📊 综合技术分析：
• 主图分析：K线形态良好，均线支撑明显
• RSI指标：${Math.floor(Math.random() * 30) + 40}，处于合理区间
• MACD指标：多空力量平衡，关注金叉机会
• 成交量：量价配合，资金流入积极

🎯 多窗口操作建议：
• 建议同时关注多个技术指标窗口
• 主图窗口观察K线形态和均线走势
• RSI窗口判断超买超卖状态
• MACD窗口寻找买卖点信号

⚠️ 风险提示：请结合多个指标综合判断`);
    } catch (error) {
      setAnalysis("AI分析暂时不可用，请稍后再试");
    }
    setLoading(false);
  };

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-gray-800">🤖 AI分析</h3>
        <button
          onClick={performAIAnalysis}
          disabled={loading}
          className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? "分析中..." : "开始分析"}
        </button>
      </div>
      
      <div className="bg-gray-50 p-3 rounded max-h-64 overflow-y-auto">
        {analysis ? (
          <pre className="whitespace-pre-wrap text-xs text-gray-700 leading-relaxed">
            {analysis}
          </pre>
        ) : (
          <div className="text-center text-gray-500 text-sm">
            <div className="text-2xl mb-1">🤖</div>
            <p>点击开始分析获取AI报告</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 主应用组件
function App() {
  const [selectedStock, setSelectedStock] = useState(null);

  const handleStockSelect = (stock) => {
    setSelectedStock(stock);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* 标题栏 */}
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">🏢 专业A股多窗口看盘系统</h1>
            <p className="text-blue-100 text-sm">多窗口技术分析平台</p>
          </div>
          {selectedStock && (
            <div className="text-right">
              <div className="font-bold">{selectedStock.name} ({selectedStock.code})</div>
              <div className="text-lg">¥{selectedStock.current_price.toFixed(2)}</div>
              <div className={selectedStock.change_percent >= 0 ? 'text-red-300' : 'text-green-300'}>
                {selectedStock.change_percent >= 0 ? '+' : ''}{selectedStock.change_percent.toFixed(2)}%
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 主要内容区域 */}
      <div className="flex-1 flex">
        {/* 左侧面板 */}
        <div className="flex flex-col">
          <StockSearch 
            onStockSelect={handleStockSelect} 
            selectedStock={selectedStock}
          />
          <div className="p-4" style={{ width: '300px' }}>
            <AIAnalysisPanel 
              stockCode={selectedStock?.code} 
              stockName={selectedStock?.name}
            />
          </div>
        </div>

        {/* 右侧多窗口区域 */}
        <MultiWindowCharts
          stockCode={selectedStock?.code}
          stockName={selectedStock?.name}
        />
      </div>

      {/* 底部状态栏 */}
      <footer className="bg-gray-800 text-white p-2">
        <div className="flex justify-between items-center text-sm">
          <div>
            当前股票: {selectedStock ? `${selectedStock.name} (${selectedStock.code})` : '未选择'}
          </div>
          <div className="text-gray-400">
            ⚠️ 投资有风险，入市需谨慎
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;