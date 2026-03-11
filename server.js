/**
 * 吃什么？- 后端服务器
 * 功能：食物记录 API + JSON 文件存储 + 每日 0 点重置
 */

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'food-data.json');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 读取数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('读取数据失败:', error);
  }
  return { foods: [], lastReset: new Date().toISOString().split('T')[0] };
}

// 保存数据
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('保存数据失败:', error);
  }
}

// 获取今日日期字符串
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// 检查是否需要重置（新的一天）
function checkReset() {
  const today = getTodayDate();
  const data = loadData();
  
  if (data.lastReset !== today) {
    console.log(`🔄 检测到新的一天 (${today})，重置数据...`);
    data.foods = [];
    data.lastReset = today;
    saveData(data);
    console.log('✅ 重置完成');
  }
  
  return data;
}

// API: 提交食物
app.post('/api/food', (req, res) => {
  try {
    const { food } = req.body;
    if (!food || food.trim() === '') {
      return res.status(400).json({ error: '食物名称不能为空' });
    }
    
    const data = checkReset();
    const newFood = {
      id: Date.now(),
      food_name: food.trim(),
      created_at: new Date().toISOString()
    };
    
    data.foods.unshift(newFood); // 添加到开头
    saveData(data);
    
    res.json({ 
      success: true, 
      id: newFood.id,
      message: '提交成功！🎉'
    });
  } catch (error) {
    console.error('提交食物失败:', error);
    res.status(500).json({ error: '提交失败' });
  }
});

// API: 获取今日食物列表
app.get('/api/foods', (req, res) => {
  try {
    const data = checkReset();
    const foods = data.foods.slice(0, 100); // 限制 100 条
    
    res.json({ 
      success: true, 
      count: foods.length,
      foods 
    });
  } catch (error) {
    console.error('获取食物列表失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// API: 获取今日统计和排行
app.get('/api/stats', (req, res) => {
  try {
    const data = checkReset();
    const foods = data.foods;
    
    // 总人次
    const totalCount = foods.length;
    
    // 食物种类
    const uniqueFoods = [...new Set(foods.map(f => f.food_name))];
    const uniqueCount = uniqueFoods.length;
    
    // 排行榜
    const foodCount = {};
    foods.forEach(f => {
      foodCount[f.food_name] = (foodCount[f.food_name] || 0) + 1;
    });
    
    const rankings = Object.entries(foodCount)
      .map(([food_name, count]) => ({ food_name, count }))
      .sort((a, b) => b.count - a.count || a.food_name.localeCompare(b.food_name))
      .slice(0, 20);
    
    res.json({
      success: true,
      date: data.lastReset,
      total: totalCount,
      unique: uniqueCount,
      rankings
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ error: '获取统计失败' });
  }
});

// 定时任务：每日 0 点重置
cron.schedule('0 0 * * *', () => {
  console.log('🔄 执行每日重置任务...');
  const data = loadData();
  data.foods = [];
  data.lastReset = getTodayDate();
  saveData(data);
  console.log(`✅ 重置完成，今日日期：${data.lastReset}`);
}, {
  timezone: 'Asia/Shanghai'
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍜 吃什么？服务器已启动！`);
  console.log(`📍 访问地址：http://localhost:${PORT}`);
  console.log(`📍 公网地址：http://82.157.191.32:${PORT}`);
  console.log(`⏰ 每日 0 点自动重置数据`);
  
  // 初始化数据文件
  checkReset();
});
