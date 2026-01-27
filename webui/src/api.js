/**
 * API Client Functions
 */

/**
 * Convert WebSocket URL to HTTP URL for API calls
 */
export function getApiUrl(serverUrl) {
  if (serverUrl.startsWith('ws://')) {
    return serverUrl.replace('ws://', 'http://');
  } else if (serverUrl.startsWith('wss://')) {
    return serverUrl.replace('wss://', 'https://');
  }
  return serverUrl; // Already HTTP or fallback
}

/**
 * Fetch device info from server
 */
export async function fetchDeviceInfo(deviceId, authToken, apiUrl) {
  if (!deviceId || !authToken) {
    return { deviceName: null, modelName: null, drmSupport: [] };
  }

  try {
    const url = `${apiUrl}/api/devices/${deviceId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[WebUI] Device ${deviceId} not found`);
      } else {
        const errorText = await response.text();
        console.error(`[WebUI] Failed to fetch device info: ${response.status}`, errorText);
      }
      return { deviceName: null, modelName: null, drmSupport: [] };
    }

    const data = await response.json();
    return {
      deviceName: data.deviceName || null,
      modelName: data.modelName || null,
      drmSupport: data.drmSupport || []
    };
  } catch (error) {
    console.error('[WebUI] Error fetching device info:', error);
    return { deviceName: null, modelName: null, drmSupport: [] };
  }
}

