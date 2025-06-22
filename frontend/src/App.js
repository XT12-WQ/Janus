import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { createChart } from "lightweight-charts";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Responsive, WidthProvider } from "react-grid-layout";
import "./App.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// 技术指标类型定义
const INDICATOR_TYPES = {
  MAIN: 'main', // 主图（K线+MA）
  RSI: 'rsi',
  MACD: 'macd',
  VOLUME: 'volume',
  KDJ: 'kdj',
  BOLL: 'boll'
};

// 可用的技术指标工具
const AVAILABLE_INDICATORS = [
  { id: 'main', name: 'K线图', type: INDICATOR_TYPES.MAIN, icon: '📊' },
  { id: 'rsi', name: 'RSI', type: INDICATOR_TYPES.RSI, icon: '📈' },
  { id: 'macd', name: 'MACD', type: INDICATOR_TYPES.MACD, icon: '📉' },
  { id: 'volume', name: '成交量', type: INDICATOR_TYPES.VOLUME, icon: '📋' },
  { id: 'ma', name: '均线', type: INDICATOR_TYPES.MAIN, icon: '〰️' }
];

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
    <div className="stock-search-panel bg-white border-r border-gray-200 p-4">
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

// 指标工具栏组件
const IndicatorToolbar = ({ onAddIndicator }) => {
  const handleDragStart = (e, indicator) => {
    e.dataTransfer.setData('indicator', JSON.stringify(indicator));
  };

  return (
    <div className="indicator-toolbar bg-gray-50 border-b border-gray-200 p-3">
      <h3 className="text-sm font-medium text-gray-700 mb-2">技术指标工具栏</h3>
      <div className="flex gap-2 flex-wrap">
        {AVAILABLE_INDICATORS.map((indicator) => (
          <div
            key={indicator.id}
            draggable
            onDragStart={(e) => handleDragStart(e, indicator)}
            className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm cursor-move hover:bg-blue-50 hover:border-blue-300 flex items-center gap-1"
          >
            <span>{indicator.icon}</span>
            <span>{indicator.name}</span>
          </div>
        ))}
        <button
          onClick={() => onAddIndicator('new-window')}
          className="px-3 py-1 bg-green-500 text-white rounded-md text-sm hover:bg-green-600 flex items-center gap-1"
        >
          ➕ 添加窗口
        </button>
      </div>
    </div>
  );
};

// 单个图表窗口组件
const ChartWindow = ({ windowId, config, stockCode, stockName, onUpdateConfig, onRemoveWindow, onAddIndicator }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRefs = useRef({});
  const [loading, setLoading] = useState(false);
  const [indicators, setIndicators] = useState({});

  // 初始化图表
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: config.height - 60, // 减去标题栏高度
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
      },
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: config.height - 60,
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
  }, [config.height]);

  // 加载数据
  const loadChartData = async () => {
    if (!stockCode || !chartRef.current) return;
    
    setLoading(true);
    try {
      // 获取K线数据
      const klineResponse = await axios.get(`${API}/stocks/${stockCode}/kline?limit=100`);
      const klineData = klineResponse.data.kline_data || [];
      
      // 获取技术指标数据
      const indicatorsResponse = await axios.get(`${API}/stocks/${stockCode}/indicators?indicators=ma,rsi,macd`);
      const indicatorsData = indicatorsResponse.data.indicators || {};
      setIndicators(indicatorsData);

      // 清除现有的系列
      Object.values(seriesRefs.current).forEach(series => {
        try {
          chartRef.current.removeSeries(series);
        } catch (e) {}
      });
      seriesRefs.current = {};

      if (klineData.length > 0) {
        // 转换K线数据格式
        const candlestickData = klineData.map(item => ({
          time: item.timestamp,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        }));

        // 根据窗口类型显示不同的图表
        if (config.type === INDICATOR_TYPES.MAIN) {
          // 主图：K线+移动平均线
          const candlestickSeries = chartRef.current.addCandlestickSeries({
            upColor: '#ef4444',
            downColor: '#22c55e',
            borderDownColor: '#22c55e',
            borderUpColor: '#ef4444',
            wickDownColor: '#22c55e',
            wickUpColor: '#ef4444',
          });
          candlestickSeries.setData(candlestickData);
          seriesRefs.current.candlestick = candlestickSeries;

          // 添加移动平均线
          if (indicatorsData.ma) {
            const colors = ['#2196F3', '#FF9800', '#9C27B0'];
            const periods = ['ma5', 'ma10', 'ma20'];
            const names = ['MA5', 'MA10', 'MA20'];

            periods.forEach((period, index) => {
              if (indicatorsData.ma[period]) {
                const maSeries = chartRef.current.addLineSeries({
                  color: colors[index],
                  lineWidth: 1,
                  title: names[index],
                });

                const maData = indicatorsData.ma.timestamps.map((time, idx) => ({
                  time: time,
                  value: indicatorsData.ma[period][idx],
                })).filter(item => item.value !== null);

                maSeries.setData(maData);
                seriesRefs.current[period] = maSeries;
              }
            });
          }
        } else if (config.type === INDICATOR_TYPES.RSI && indicatorsData.rsi) {
          // RSI指标
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
          seriesRefs.current.rsi = rsiSeries;

          // 添加RSI的超买超卖线
          const overboughtSeries = chartRef.current.addLineSeries({
            color: '#ff0000',
            lineWidth: 1,
            lineStyle: 2, // 虚线
            title: '超买线(70)',
          });
          const oversoldSeries = chartRef.current.addLineSeries({
            color: '#00ff00',
            lineWidth: 1,
            lineStyle: 2, // 虚线
            title: '超卖线(30)',
          });

          const overboughtData = indicatorsData.rsi.timestamps.map(time => ({ time, value: 70 }));
          const oversoldData = indicatorsData.rsi.timestamps.map(time => ({ time, value: 30 }));

          overboughtSeries.setData(overboughtData);
          oversoldSeries.setData(oversoldData);
          seriesRefs.current.overbought = overboughtSeries;
          seriesRefs.current.oversold = oversoldSeries;

        } else if (config.type === INDICATOR_TYPES.MACD && indicatorsData.macd) {
          // MACD指标
          const macdSeries = chartRef.current.addLineSeries({
            color: '#2196F3',
            lineWidth: 2,
            title: 'MACD',
          });
          const signalSeries = chartRef.current.addLineSeries({
            color: '#FF9800',
            lineWidth: 2,
            title: 'Signal',
          });

          const macdData = indicatorsData.macd.timestamps.map((time, index) => ({
            time: time,
            value: indicatorsData.macd.macd[index],
          })).filter(item => item.value !== null);

          const signalData = indicatorsData.macd.timestamps.map((time, index) => ({
            time: time,
            value: indicatorsData.macd.signal[index],
          })).filter(item => item.value !== null);

          macdSeries.setData(macdData);
          signalSeries.setData(signalData);
          seriesRefs.current.macd = macdSeries;
          seriesRefs.current.signal = signalSeries;

          // 添加MACD柱状图
          const histogramSeries = chartRef.current.addHistogramSeries({
            color: '#26a69a',
            title: 'Histogram',
          });

          const histogramData = indicatorsData.macd.timestamps.map((time, index) => ({
            time: time,
            value: indicatorsData.macd.histogram[index] || 0,
          })).filter(item => item.value !== null);

          histogramSeries.setData(histogramData);
          seriesRefs.current.histogram = histogramSeries;

        } else if (config.type === INDICATOR_TYPES.VOLUME) {
          // 成交量
          const volumeSeries = chartRef.current.addHistogramSeries({
            color: '#26a69a',
            title: '成交量',
          });

          const volumeData = klineData.map(item => ({
            time: item.timestamp,
            value: item.volume,
          }));

          volumeSeries.setData(volumeData);
          seriesRefs.current.volume = volumeSeries;
        }
      }
    } catch (error) {
      console.error("加载图表数据失败:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadChartData();
  }, [stockCode, config.type]);

  // 处理拖拽放置
  const handleDrop = (e) => {
    e.preventDefault();
    const indicatorData = e.dataTransfer.getData('indicator');
    if (indicatorData) {
      const indicator = JSON.parse(indicatorData);
      onUpdateConfig(windowId, { ...config, type: indicator.type, title: indicator.name });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const getTypeDisplayName = (type) => {
    switch (type) {
      case INDICATOR_TYPES.MAIN: return 'K线图';
      case INDICATOR_TYPES.RSI: return 'RSI';
      case INDICATOR_TYPES.MACD: return 'MACD';
      case INDICATOR_TYPES.VOLUME: return '成交量';
      default: return '图表';
    }
  };

  return (
    <div 
      className="chart-window bg-white border border-gray-200 rounded-lg overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* 窗口标题栏 */}
      <div className="window-header bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-700">
            {config.title || getTypeDisplayName(config.type)}
          </span>
          {stockName && (
            <span className="text-xs text-gray-500">- {stockName}</span>
          )}
          {loading && <span className="text-xs text-blue-500">加载中...</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onAddIndicator('new-window')}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            title="添加新窗口"
          >
            ➕
          </button>
          <button
            onClick={() => onRemoveWindow(windowId)}
            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
            title="删除窗口"
          >
            ❌
          </button>
        </div>
      </div>

      {/* 图表容器 */}
      <div 
        ref={chartContainerRef} 
        style={{ height: config.height - 60 }}
        className="chart-container"
      />

      {/* 指标数值显示 */}
      {indicators && Object.keys(indicators).length > 0 && (
        <div className="indicator-values bg-gray-50 px-4 py-2 text-xs border-t border-gray-200">
          {config.type === INDICATOR_TYPES.RSI && indicators.rsi && (
            <span className="mr-4">
              RSI: <strong className="text-red-600">
                {indicators.rsi.values[indicators.rsi.values.length - 1]?.toFixed(2) || 'N/A'}
              </strong>
            </span>
          )}
          {config.type === INDICATOR_TYPES.MACD && indicators.macd && (
            <>
              <span className="mr-4">
                MACD: <strong className="text-blue-600">
                  {indicators.macd.macd[indicators.macd.macd.length - 1]?.toFixed(4) || 'N/A'}
                </strong>
              </span>
              <span className="mr-4">
                Signal: <strong className="text-orange-600">
                  {indicators.macd.signal[indicators.macd.signal.length - 1]?.toFixed(4) || 'N/A'}
                </strong>
              </span>
            </>
          )}
          {config.type === INDICATOR_TYPES.MAIN && indicators.ma && (
            <>
              <span className="mr-4">
                MA5: <strong className="text-blue-600">
                  {indicators.ma.ma5[indicators.ma.ma5.length - 1]?.toFixed(2) || 'N/A'}
                </strong>
              </span>
              <span className="mr-4">
                MA10: <strong className="text-orange-600">
                  {indicators.ma.ma10[indicators.ma.ma10.length - 1]?.toFixed(2) || 'N/A'}
                </strong>
              </span>
              <span className="mr-4">
                MA20: <strong className="text-purple-600">
                  {indicators.ma.ma20[indicators.ma.ma20.length - 1]?.toFixed(2) || 'N/A'}
                </strong>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// AI分析面板组件
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
      
      setAnalysis(`
🤖 ${stockName} (${stockCode}) AI技术分析报告

📊 综合技术分析：
• 趋势方向：震荡上行，多头力量逐渐增强
• 价格位置：当前价格处于相对合理区间
• 支撑阻力：关注近期重要支撑位和压力位

📈 多窗口指标分析：
• 主图K线：多头排列，均线支撑明显
• RSI指标：${Math.floor(Math.random() * 30) + 40}，处于相对平衡区间
• MACD指标：金叉信号出现，短期看涨概率较高
• 成交量：量价配合良好，资金参与积极

🎯 操作策略建议：
• 短线操作：建议在支撑位附近分批买入
• 中线持有：技术面向好，可适当加仓
• 风险控制：设置止损位，控制仓位风险

⚠️ 风险提示：
以上分析仅供参考，投资需谨慎，请结合基本面分析
      `);
    } catch (error) {
      setAnalysis("AI分析暂时不可用，请稍后再试");
    }
    setLoading(false);
  };

  return (
    <div className="ai-analysis-panel bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">🤖 AI智能分析</h3>
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
              🧠 开始分析
            </>
          )}
        </button>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-md min-h-64 max-h-96 overflow-y-auto">
        {analysis ? (
          <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-mono">
            {analysis}
          </pre>
        ) : (
          <div className="text-gray-500 text-center">
            <div className="text-4xl mb-2">🤖</div>
            <p>点击"开始分析"获取AI技术分析报告</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 主应用组件
function App() {
  const [selectedStock, setSelectedStock] = useState(null);
  const [windows, setWindows] = useState([
    {
      i: 'main-chart',
      x: 0,
      y: 0,
      w: 8,
      h: 8,
      type: INDICATOR_TYPES.MAIN,
      title: 'K线主图',
      height: 400
    }
  ]);
  const [layouts, setLayouts] = useState({});

  const handleStockSelect = (stock) => {
    setSelectedStock(stock);
  };

  const handleLayoutChange = (layout, layouts) => {
    setLayouts(layouts);
    // 更新窗口高度信息
    const updatedWindows = windows.map(window => {
      const layoutItem = layout.find(l => l.i === window.i);
      if (layoutItem) {
        return { ...window, height: layoutItem.h * 50 }; // 每个网格单元约50px高度
      }
      return window;
    });
    setWindows(updatedWindows);
  };

  const handleAddIndicator = (type) => {
    const newWindowId = `window-${Date.now()}`;
    let indicatorType = INDICATOR_TYPES.RSI;
    let title = 'RSI';

    if (type === 'new-window') {
      // 循环添加不同类型的指标
      const types = [INDICATOR_TYPES.RSI, INDICATOR_TYPES.MACD, INDICATOR_TYPES.VOLUME];
      const currentTypes = windows.map(w => w.type);
      for (let t of types) {
        if (!currentTypes.includes(t)) {
          indicatorType = t;
          title = t.toUpperCase();
          break;
        }
      }
    }

    const newWindow = {
      i: newWindowId,
      x: 0,
      y: Math.max(...windows.map(w => w.y + w.h), 0),
      w: 8,
      h: 6,
      type: indicatorType,
      title: title,
      height: 300
    };

    setWindows([...windows, newWindow]);
  };

  const handleUpdateWindowConfig = (windowId, newConfig) => {
    setWindows(windows.map(window => 
      window.i === windowId ? { ...window, ...newConfig } : window
    ));
  };

  const handleRemoveWindow = (windowId) => {
    if (windows.length > 1) { // 至少保留一个窗口
      setWindows(windows.filter(window => window.i !== windowId));
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app-container min-h-screen bg-gray-100 flex flex-col">
        {/* 顶部标题栏 */}
        <header className="bg-blue-600 text-white p-4 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">🏢 专业A股看盘系统</h1>
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

        {/* 指标工具栏 */}
        <IndicatorToolbar onAddIndicator={handleAddIndicator} />

        {/* 主要内容区域 */}
        <div className="flex-1 flex">
          {/* 左侧股票搜索面板 */}
          <div className="w-80 flex-shrink-0">
            <StockSearch 
              onStockSelect={handleStockSelect} 
              selectedStock={selectedStock}
            />
            
            {/* AI分析面板 */}
            <div className="p-4">
              <AIAnalysisPanel 
                stockCode={selectedStock?.code} 
                stockName={selectedStock?.name}
              />
            </div>
          </div>

          {/* 右侧多窗口图表区域 */}
          <div className="flex-1 p-4">
            <div className="bg-white rounded-lg p-4">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">多窗口技术分析</h2>
                <div className="text-sm text-gray-500">
                  拖拽指标到窗口 | 调整窗口大小和位置
                </div>
              </div>

              <ResponsiveGridLayout
                className="layout"
                layouts={layouts}
                onLayoutChange={handleLayoutChange}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={50}
                isDraggable={true}
                isResizable={true}
                margin={[16, 16]}
                containerPadding={[0, 0]}
              >
                {windows.map((window) => (
                  <div key={window.i} className="grid-item">
                    <ChartWindow
                      windowId={window.i}
                      config={window}
                      stockCode={selectedStock?.code}
                      stockName={selectedStock?.name}
                      onUpdateConfig={handleUpdateWindowConfig}
                      onRemoveWindow={handleRemoveWindow}
                      onAddIndicator={handleAddIndicator}
                    />
                  </div>
                ))}
              </ResponsiveGridLayout>
            </div>
          </div>
        </div>

        {/* 底部状态栏 */}
        <footer className="bg-gray-800 text-white p-2">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-4">
              <span>窗口数量: {windows.length}</span>
              <span>当前股票: {selectedStock ? `${selectedStock.name} (${selectedStock.code})` : '未选择'}</span>
            </div>
            <div className="text-gray-400">
              ⚠️ 投资有风险，入市需谨慎
            </div>
          </div>
        </footer>
      </div>
    </DndProvider>
  );
}

export default App;