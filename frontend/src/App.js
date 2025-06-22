import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { createChart } from "lightweight-charts";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// 股票搜索组件
const StockSearch = ({ onStockSelect }) => {
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
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 text-gray-800">股票搜索</h2>
      
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入股票代码或名称"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "搜索中..." : "搜索"}
          </button>
        </div>
      </form>

      <div className="max-h-64 overflow-y-auto">
        {stocks.length === 0 && !loading && (
          <p className="text-gray-500">暂无股票数据</p>
        )}
        
        {stocks.map((stock) => (
          <div
            key={stock.code}
            onClick={() => onStockSelect(stock)}
            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex justify-between items-center"
          >
            <div>
              <div className="font-medium">{stock.name}</div>
              <div className="text-sm text-gray-500">{stock.code}</div>
            </div>
            <div className="text-right">
              <div className="font-medium">{stock.current_price.toFixed(2)}</div>
              <div className={`text-sm ${stock.change_percent >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// K线图表组件
const KlineChart = ({ stockCode, stockName }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [indicators, setIndicators] = useState({});

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 创建图表
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        backgroundColor: '#ffffff',
        textColor: '#333333',
      },
      grid: {
        vertLines: {
          color: '#f0f0f0',
        },
        horzLines: {
          color: '#f0f0f0',
        },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#cccccc',
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderDownColor: '#22c55e',
      borderUpColor: '#ef4444',
      wickDownColor: '#22c55e',
      wickUpColor: '#ef4444',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // 窗口大小变化时调整图表大小
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, []);

  const loadKlineData = async () => {
    if (!stockCode) return;
    
    setLoading(true);
    try {
      // 获取K线数据
      const klineResponse = await axios.get(`${API}/stocks/${stockCode}/kline?limit=100`);
      const klineData = klineResponse.data.kline_data || [];
      
      // 获取技术指标数据
      const indicatorsResponse = await axios.get(`${API}/stocks/${stockCode}/indicators?indicators=ma,rsi,macd`);
      const indicatorsData = indicatorsResponse.data.indicators || {};
      setIndicators(indicatorsData);

      if (candlestickSeriesRef.current && klineData.length > 0) {
        // 转换K线数据格式
        const candlestickData = klineData.map(item => ({
          time: item.timestamp,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        }));

        candlestickSeriesRef.current.setData(candlestickData);

        // 添加移动平均线
        if (indicatorsData.ma) {
          const ma5Series = chartRef.current.addLineSeries({
            color: '#2196F3',
            lineWidth: 1,
            title: 'MA5',
          });

          const ma10Series = chartRef.current.addLineSeries({
            color: '#FF9800',
            lineWidth: 1,
            title: 'MA10',
          });

          const ma20Series = chartRef.current.addLineSeries({
            color: '#9C27B0',
            lineWidth: 1,
            title: 'MA20',
          });

          const ma5Data = indicatorsData.ma.timestamps.map((time, index) => ({
            time: time,
            value: indicatorsData.ma.ma5[index],
          })).filter(item => item.value !== null);

          const ma10Data = indicatorsData.ma.timestamps.map((time, index) => ({
            time: time,
            value: indicatorsData.ma.ma10[index],
          })).filter(item => item.value !== null);

          const ma20Data = indicatorsData.ma.timestamps.map((time, index) => ({
            time: time,
            value: indicatorsData.ma.ma20[index],
          })).filter(item => item.value !== null);

          ma5Series.setData(ma5Data);
          ma10Series.setData(ma10Data);
          ma20Series.setData(ma20Data);
        }
      }
    } catch (error) {
      console.error("加载K线数据失败:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadKlineData();
  }, [stockCode]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          {stockName ? `${stockName} (${stockCode})` : 'K线图表'}
        </h2>
        {loading && <span className="text-blue-500">加载中...</span>}
      </div>
      
      <div ref={chartContainerRef} style={{ position: 'relative' }} />
      
      {/* 技术指标显示 */}
      {Object.keys(indicators).length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {indicators.rsi && (
            <div className="bg-gray-50 p-3 rounded">
              <h3 className="font-medium text-gray-700 mb-2">RSI</h3>
              <div className="text-lg font-bold text-blue-600">
                {indicators.rsi.values[indicators.rsi.values.length - 1]?.toFixed(2) || 'N/A'}
              </div>
            </div>
          )}
          
          {indicators.macd && (
            <div className="bg-gray-50 p-3 rounded">
              <h3 className="font-medium text-gray-700 mb-2">MACD</h3>
              <div className="text-sm">
                <div>MACD: {indicators.macd.macd[indicators.macd.macd.length - 1]?.toFixed(4) || 'N/A'}</div>
                <div>Signal: {indicators.macd.signal[indicators.macd.signal.length - 1]?.toFixed(4) || 'N/A'}</div>
              </div>
            </div>
          )}
          
          {indicators.ma && (
            <div className="bg-gray-50 p-3 rounded">
              <h3 className="font-medium text-gray-700 mb-2">移动平均线</h3>
              <div className="text-sm">
                <div className="text-blue-600">MA5: {indicators.ma.ma5[indicators.ma.ma5.length - 1]?.toFixed(2) || 'N/A'}</div>
                <div className="text-orange-600">MA10: {indicators.ma.ma10[indicators.ma.ma10.length - 1]?.toFixed(2) || 'N/A'}</div>
                <div className="text-purple-600">MA20: {indicators.ma.ma20[indicators.ma.ma20.length - 1]?.toFixed(2) || 'N/A'}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// AI分析组件
const AIAnalysis = ({ stockCode, stockName }) => {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  const performAIAnalysis = async () => {
    if (!stockCode) {
      setAnalysis("请先选择一支股票进行分析");
      return;
    }

    setLoading(true);
    try {
      // 这里模拟AI分析，实际应用中可以调用AI服务
      await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟分析时间
      
      setAnalysis(`
📊 ${stockName} (${stockCode}) AI技术分析报告：

🔍 技术面分析：
• 当前趋势：震荡上行
• 支撑位：建议关注近期低点
• 阻力位：关注前期高点压力
• 成交量：成交量配合良好

📈 指标分析：
• RSI指标显示股票处于相对合理区间
• MACD指标显示多空力量平衡
• 均线系统呈现多头排列态势

⚠️ 风险提示：
• 市场波动较大，请注意风险控制
• 建议结合基本面分析
• 投资需谨慎，此分析仅供参考

💡 操作建议：
• 短线：可关注技术面突破机会
• 中线：建议关注基本面变化
• 长线：需要综合考虑行业前景
      `);
    } catch (error) {
      setAnalysis("AI分析暂时不可用，请稍后再试");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">AI智能分析</h2>
        <button
          onClick={performAIAnalysis}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              分析中...
            </>
          ) : (
            <>
              🤖 开始AI分析
            </>
          )}
        </button>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-md min-h-64">
        {analysis ? (
          <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
            {analysis}
          </pre>
        ) : (
          <div className="text-gray-500 text-center">
            <div className="text-4xl mb-2">🤖</div>
            <p>点击"开始AI分析"按钮获取智能分析报告</p>
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
    <div className="min-h-screen bg-gray-100">
      {/* 标题栏 */}
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">🏢 A股看盘软件</h1>
          <p className="text-blue-100">专业级股票分析工具</p>
        </div>
      </header>

      {/* 主要内容区域 */}
      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧：股票搜索 */}
          <div className="lg:col-span-1">
            <StockSearch onStockSelect={handleStockSelect} />
          </div>

          {/* 右侧：图表和分析 */}
          <div className="lg:col-span-3 space-y-6">
            {/* K线图表 */}
            <KlineChart 
              stockCode={selectedStock?.code} 
              stockName={selectedStock?.name}
            />

            {/* AI分析 */}
            <AIAnalysis 
              stockCode={selectedStock?.code} 
              stockName={selectedStock?.name}
            />
          </div>
        </div>
      </div>

      {/* 底部信息 */}
      <footer className="bg-gray-800 text-white p-4 mt-8">
        <div className="container mx-auto text-center">
          <p className="text-gray-400">
            ⚠️ 投资有风险，入市需谨慎。本软件仅供参考，不构成投资建议。
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;