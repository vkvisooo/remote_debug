/**
 * Helper Functions for Message and Event Handling
 */

import { EVENT_LIMITS, EVENT_TYPES, MESSAGE_TYPES } from './constants';
import { createInitialDeviceEvents, createResponseFingerprint, isDuplicateResponse, getEventLimit } from './utils';

/**
 * Handle session-related messages
 */
export function handleSessionMessage(message, setSessions, setSelectedDeviceId, selectedDeviceId) {
  switch (message.type) {
    case MESSAGE_TYPES.SESSIONS:
      // Deduplicate is handled in utils, but we apply it here
      const sessions = message.payload || [];
      setSessions(sessions);
      if (sessions.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(sessions[0].deviceId);
      }
      break;

    case MESSAGE_TYPES.SESSION_CREATED:
      setSessions(prev => {
        const existingIndex = prev.findIndex(s => s.deviceId === message.payload.deviceId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = message.payload;
          return updated;
        }
        return [...prev, message.payload];
      });
      if (!selectedDeviceId) {
        setSelectedDeviceId(message.payload.deviceId);
      }
      break;

    case MESSAGE_TYPES.SESSION_UPDATED:
      setSessions(prev => {
        const existingIndex = prev.findIndex(s => s.deviceId === message.payload.deviceId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = message.payload;
          return updated;
        }
        return [...prev, message.payload];
      });
      break;

    case MESSAGE_TYPES.SESSION_CLOSED:
    case MESSAGE_TYPES.SESSION_DELETED:
      setSessions(prev => {
        const updated = prev.filter(s => s.deviceId !== message.payload.deviceId);
        if (selectedDeviceId === message.payload.deviceId && updated.length > 0) {
          setSelectedDeviceId(updated[0].deviceId);
        } else if (selectedDeviceId === message.payload.deviceId && updated.length === 0) {
          setSelectedDeviceId(null);
        }
        return updated;
      });
      break;
  }
}

/**
 * Handle event storage per device
 */
export function handleEventStorage(eventsRef, deviceId, payload) {
  if (!deviceId) {
    console.warn('[WebUI] handleEventStorage called without deviceId');
    return;
  }

  // Initialize device events if not exists
  if (!eventsRef.current[deviceId]) {
    eventsRef.current[deviceId] = createInitialDeviceEvents();
  }

  const deviceEvents = eventsRef.current[deviceId];
  const { eventType, ...eventData } = payload;

  // Ensure network events have timestamp
  if (eventType === EVENT_TYPES.NETWORK && !eventData.timestamp) {
    eventData.timestamp = Date.now();
  }

  const limit = getEventLimit(eventType);

  switch (eventType) {
    case EVENT_TYPES.NETWORK:
      deviceEvents.network.push(eventData);
      deviceEvents.network = deviceEvents.network.slice(-limit);
      break;

    case EVENT_TYPES.CONSOLE:
      if (eventData.logs) {
        deviceEvents.console.push(...eventData.logs);
        deviceEvents.console = deviceEvents.console.slice(-limit);
      }
      break;

    case EVENT_TYPES.ERROR:
      deviceEvents.errors.push(eventData);
      deviceEvents.errors = deviceEvents.errors.slice(-limit);
      break;

    case EVENT_TYPES.PLAYBACK:
      deviceEvents.playback.push(eventData);
      deviceEvents.playback = deviceEvents.playback.slice(-limit);
      break;

    case EVENT_TYPES.METRIC:
      deviceEvents.metrics.push(eventData);
      deviceEvents.metrics = deviceEvents.metrics.slice(-limit);
      break;

    default:
      console.warn('[WebUI] Unknown eventType:', eventType);
      break;
  }

  return deviceEvents;
}

/**
 * Handle command response storage and deduplication
 */
export function handleCommandResponse(
  commandResponsesRef,
  message,
  selectedDeviceIdRef,
  setCommandResponses
) {
  if (!message.deviceId) return false;

  if (!commandResponsesRef.current[message.deviceId]) {
    commandResponsesRef.current[message.deviceId] = [];
  }

  const responseFingerprint = createResponseFingerprint(message.payload, message.deviceId);
  const recentResponses = commandResponsesRef.current[message.deviceId].slice(-5);
  
  if (isDuplicateResponse({ ...message.payload, deviceId: message.deviceId }, recentResponses)) {
    console.log('[WebUI] Duplicate response ignored:', message.payload);
    return false;
  }

  const responseWithTimestamp = {
    ...message.payload,
    timestamp: Date.now(),
    deviceId: message.deviceId,
    fingerprint: responseFingerprint
  };

  commandResponsesRef.current[message.deviceId].push(responseWithTimestamp);
  commandResponsesRef.current[message.deviceId] = 
    commandResponsesRef.current[message.deviceId].slice(-EVENT_LIMITS.COMMAND_RESPONSES);

  // Update UI if this is the selected device
  if (selectedDeviceIdRef.current === message.deviceId) {
    const deviceResponses = commandResponsesRef.current[message.deviceId];
    setCommandResponses([...deviceResponses]);
  }

  return true;
}

/**
 * Load events for selected device
 */
export function loadDeviceEvents(eventsRef, commandResponsesRef, deviceId) {
  const deviceEvents = eventsRef.current[deviceId] || createInitialDeviceEvents();
  const deviceResponses = commandResponsesRef.current[deviceId] || [];

  return {
    networkEvents: [...deviceEvents.network],
    consoleEvents: [...deviceEvents.console],
    errorEvents: [...deviceEvents.errors],
    playbackEvents: [...deviceEvents.playback],
    metrics: [...deviceEvents.metrics],
    commandResponses: [...deviceResponses]
  };
}

/**
 * Clear all events for a device
 */
export function clearAllDeviceEvents() {
  return {
    networkEvents: [],
    consoleEvents: [],
    errorEvents: [],
    playbackEvents: [],
    metrics: [],
    commandResponses: []
  };
}

