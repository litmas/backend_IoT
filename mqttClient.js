const mqtt = require('mqtt');
const mongoose = require('mongoose');
const { RawData, HourlyData, DailyData } = require('./models/sensorData');
require('dotenv').config();

class MQTTClient {
  constructor() {
    this.initializeMongoDB();
    this.currentHour = this.getCurrentHour();
    this.currentDay = this.getCurrentDay();
    
    this.client = mqtt.connect(process.env.MQTT_BROKER_URL, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      reconnectPeriod: 5000 
    });

    this.setupMQTTListeners();
    
    setInterval(() => this.aggregateHourlyData(), 60 * 60 * 1000);
    setInterval(() => this.aggregateDailyData(), 24 * 60 * 60 * 1000);
  }

  getCurrentHour() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  }

  getCurrentDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  async initializeMongoDB() {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000 
      });
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    }
  }

  setupMQTTListeners() {
    this.client.on('connect', () => {
      console.log('Connected to MQTT broker');
      this.client.subscribe(process.env.MQTT_TOPIC, (err) => {
        if (err) {
          console.error('Subscription error:', err);
        } else {
          console.log(`Subscribed to topic: ${process.env.MQTT_TOPIC}`);
        }
      });
    });

    this.client.on('message', async (topic, message) => {
      try {
        if (!mongoose.connection.readyState) {
          console.warn('MongoDB not connected, skipping message');
          return;
        }

        const data = JSON.parse(message.toString());
        
        if (data.temperature === undefined || data.humidity === undefined) {
          console.warn('Invalid message format, missing temperature or humidity');
          return;
        }
        
        const sensorData = new RawData({
          temperature: parseFloat(data.temperature),
          humidity: parseFloat(data.humidity),
          timestamp: new Date(data.timestamp || Date.now())
        });

        await sensorData.save();
        console.log('Raw data saved to MongoDB:', sensorData);
      } catch (error) {
        console.error('Error processing MQTT message:', error);
      }
    });

    this.client.on('error', (err) => {
      console.error('MQTT error:', err);
    });
    
    this.client.on('close', () => {
      console.log('MQTT connection closed');
    });
    
    this.client.on('offline', () => {
      console.log('MQTT client is offline');
    });
    
    this.client.on('reconnect', () => {
      console.log('Attempting to reconnect to MQTT broker');
    });
  }

  async aggregateHourlyData() {
    try {
      const now = new Date();
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const result = await RawData.aggregate([
        {
          $match: {
            timestamp: { $gte: hourStart, $lt: hourEnd }
          }
        },
        {
          $group: {
            _id: null,
            avgTemp: { $avg: "$temperature" },
            minTemp: { $min: "$temperature" },
            maxTemp: { $max: "$temperature" },
            avgHumidity: { $avg: "$humidity" },
            minHumidity: { $min: "$humidity" },
            maxHumidity: { $max: "$humidity" },
            count: { $sum: 1 }
          }
        }
      ]);

      if (result.length > 0 && result[0].count > 0) {
        const hourlyData = new HourlyData({
          temperature: {
            avg: result[0].avgTemp,
            min: result[0].minTemp,
            max: result[0].maxTemp
          },
          humidity: {
            avg: result[0].avgHumidity,
            min: result[0].minHumidity,
            max: result[0].maxHumidity
          },
          timestamp: hourStart,
          count: result[0].count
        });

        await hourlyData.save();
        console.log('Hourly data aggregated:', hourlyData);
      }
    } catch (error) {
      console.error('Error aggregating hourly data:', error);
    }
  }

  async aggregateDailyData() {
    try {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const result = await HourlyData.aggregate([
        {
          $match: {
            timestamp: { $gte: dayStart, $lt: dayEnd }
          }
        },
        {
          $group: {
            _id: null,
            avgTemp: { $avg: "$temperature.avg" },
            minTemp: { $min: "$temperature.min" },
            maxTemp: { $max: "$temperature.max" },
            avgHumidity: { $avg: "$humidity.avg" },
            minHumidity: { $min: "$humidity.min" },
            maxHumidity: { $max: "$humidity.max" },
            count: { $sum: "$count" }
          }
        }
      ]);

      if (result.length > 0 && result[0].count > 0) {
        const dailyData = new DailyData({
          temperature: {
            avg: result[0].avgTemp,
            min: result[0].minTemp,
            max: result[0].maxTemp
          },
          humidity: {
            avg: result[0].avgHumidity,
            min: result[0].minHumidity,
            max: result[0].maxHumidity
          },
          date: dayStart,
          count: result[0].count
        });

        await dailyData.save();
        console.log('Daily data aggregated:', dailyData);
      }
    } catch (error) {
      console.error('Error aggregating daily data:', error);
    }
  }
}

module.exports = new MQTTClient();