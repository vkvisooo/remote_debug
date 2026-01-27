/**
 * Session Model
 */

import { SESSION_CONFIG, EVENT_TYPES } from '../constants.js';

export class Session {
  constructor(deviceId, deviceName = null, modelName = null, drmSupport = null) {
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.modelName = modelName;
    this.drmSupport = drmSupport;
    this.status = SESSION_CONFIG.STATUS.ACTIVE;
    this.timestamp = Date.now();
    this.metrics = [];
    this.events = [];
    this.errorCount = 0;
  }

  updateDeviceInfo(deviceName, modelName, drmSupport) {
    if (deviceName) this.deviceName = deviceName;
    if (modelName) this.modelName = modelName;
    if (drmSupport) this.drmSupport = drmSupport;
  }

  addEvent(event) {
    this.events.push(event);
    if (event.type === EVENT_TYPES.ERROR) {
      this.errorCount++;
      this.status = SESSION_CONFIG.STATUS.ERROR;
    }
  }

  markSuccess() {
    if (this.status === SESSION_CONFIG.STATUS.ACTIVE) {
      this.status = SESSION_CONFIG.STATUS.SUCCESS;
    }
  }
}


