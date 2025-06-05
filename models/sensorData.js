const mongoose = require('mongoose');

const rawDataSchema = new mongoose.Schema({
  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true }
}, { capped: { size: 1024 * 1024 * 10, max: 5000 } }); 

const hourlyDataSchema = new mongoose.Schema({
  temperature: {
    avg: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true }
  },
  humidity: {
    avg: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true }
  },
  timestamp: { type: Date, required: true, index: true },
  count: { type: Number, required: true }
});

const dailyDataSchema = new mongoose.Schema({
  temperature: {
    avg: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true }
  },
  humidity: {
    avg: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true }
  },
  date: { type: Date, required: true, index: true },
  count: { type: Number, required: true }
});

const RawData = mongoose.model('RawData', rawDataSchema);
const HourlyData = mongoose.model('HourlyData', hourlyDataSchema);
const DailyData = mongoose.model('DailyData', dailyDataSchema);

module.exports = { RawData, HourlyData, DailyData };