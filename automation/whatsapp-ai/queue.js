// convenience exporter if you want to add jobs from other scripts
const { Queue } = require('bullmq');
require('dotenv').config();
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const queue = new Queue('whatsapp-processing', { connection: { url: REDIS_URL } });

module.exports = queue;
