const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const { RawData, HourlyData, DailyData } = require('./models/sensorData');

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Update your /api/data endpoint in server.js
app.get('/api/data', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    // Validate date parameters
    if (!start || !end) {
      return res.status(400).json({ error: 'Both start and end parameters are required' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO format (e.g., 2023-06-05T12:00:00Z)' });
    }

    const range = endDate - startDate;
    
    let data;
    
    if (range <= 24 * 60 * 60 * 1000) { 
      data = await RawData.find({
        timestamp: { $gte: startDate, $lte: endDate }
      }).sort({ timestamp: 1 });
    } else if (range <= 7 * 24 * 60 * 60 * 1000) {
      data = await HourlyData.find({
        timestamp: { $gte: startDate, $lte: endDate }
      }).sort({ timestamp: 1 });
    } else {
      data = await DailyData.find({
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 });
    }
    
    res.json(data);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/data/latest', async (req, res) => {
  try {
    const data = await RawData.findOne()
      .sort({ timestamp: -1 });
    
    res.json(data);
  } catch (err) {
    console.error('Error fetching latest data:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/data/stats', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const range = endDate - startDate;
    
    let stats;
    
    if (range <= 24 * 60 * 60 * 1000) {
      stats = await RawData.aggregate([
        { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
        { 
          $group: {
            _id: null,
            avgTemp: { $avg: "$temperature" },
            maxTemp: { $max: "$temperature" },
            minTemp: { $min: "$temperature" },
            avgHumidity: { $avg: "$humidity" },
            maxHumidity: { $max: "$humidity" },
            minHumidity: { $min: "$humidity" },
            count: { $sum: 1 }
          }
        }
      ]);
    } else if (range <= 7 * 24 * 60 * 60 * 1000) {
      stats = await HourlyData.aggregate([
        { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
        { 
          $group: {
            _id: null,
            avgTemp: { $avg: "$temperature.avg" },
            maxTemp: { $max: "$temperature.max" },
            minTemp: { $min: "$temperature.min" },
            avgHumidity: { $avg: "$humidity.avg" },
            maxHumidity: { $max: "$humidity.max" },
            minHumidity: { $min: "$humidity.min" },
            count: { $sum: "$count" }
          }
        }
      ]);
    } else {
      stats = await RawData.aggregate([
        { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
        { 
          $group: {
            _id: null,
            avgTemp: { $avg: "$temperature" },
            maxTemp: { $max: "$temperature" },
            minTemp: { $min: "$temperature" },
            avgHumidity: { $avg: "$humidity" },
            maxHumidity: { $max: "$humidity" },
            minHumidity: { $min: "$humidity" },
            count: { $sum: 1 }
          }
        }
      ]);
    }
    
    res.json(stats[0] || {});
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

require('./mqttClient');

module.exports = app;
