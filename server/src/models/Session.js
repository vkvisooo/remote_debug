/**
 * Session Model
 */

import { SESSION_CONFIG, EVENT_TYPES } from '../constants.js';

export class Session {
  constructor(deviceId) {
    this.deviceId = deviceId;
    this.status = SESSION_CONFIG.STATUS.ACTIVE;
    this.timestamp = Date.now();
    this.metrics = [];
    this.events = [];
    this.errorCount = 0;
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


