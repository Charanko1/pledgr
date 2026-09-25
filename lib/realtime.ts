/**
 * Deploy-friendly realtime cadences.
 *
 * Application state uses focused polling as a fallback while blockchain state
 * uses one shared contract listener. Keeping the cadences centralized makes it
 * easy to tune load without editing every feature hook.
 */
export const APP_REALTIME_INTERVAL_MS = 5_000;
export const APP_DATA_REFRESH_INTERVAL_MS = 15_000;
export const BLOCKCHAIN_POLLING_INTERVAL_MS = 15_000;
