/**
 * In-memory F1 state store
 * Mirrors the logic from useDataStore + useDataEngine in the dashboard
 */

const isObject = (obj) =>
  obj !== null && typeof obj === 'object' && !Array.isArray(obj);

/**
 * Deep merge: mirrors dashboard's merge.ts
 * Handles partial updates from SSE `update` events
 */
export function merge(base, update) {
  if (isObject(base) && isObject(update)) {
    const result = { ...base };
    for (const [key, value] of Object.entries(update)) {
      result[key] = merge(base[key] ?? null, value);
    }
    return result;
  }

  if (Array.isArray(base) && isObject(update)) {
    const result = [...base];
    for (const [key, value] of Object.entries(update)) {
      const index = parseInt(key);
      result.splice(index, 1, merge(result[index], value));
    }
    return [...result];
  }

  return update;
}

class F1State {
  constructor() {
    this.state = null;       // Main state (SessionInfo, TimingData, etc.)
    this.listeners = new Map(); // event → Set of callbacks
  }

  /**
   * Called on SSE `initial` event — full state snapshot
   */
  handleInitial(data) {
    const { CarDataZ, PositionZ, ...rest } = data;
    this.state = rest;
    this.emit('update', this.state);
    this.emit('initial', this.state);
  }

  /**
   * Called on SSE `update` event — partial state patch
   */
  handleUpdate(data) {
    if (!this.state) return;
    const { CarDataZ, PositionZ, ...rest } = data;
    this.state = merge(this.state, rest);
    this.emit('update', this.state);
  }

  /** Subscribe to state events */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  /** Emit internal events */
  emit(event, data) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  /** Getters for convenience */
  get sessionInfo()           { return this.state?.SessionInfo; }
  get sessionStatus()         { return this.state?.SessionStatus; }
  get trackStatus()           { return this.state?.TrackStatus; }
  get weatherData()           { return this.state?.WeatherData; }
  get driverList()            { return this.state?.DriverList; }
  get timingData()            { return this.state?.TimingData; }
  get timingAppData()         { return this.state?.TimingAppData; }
  get raceControlMessages()   { return this.state?.RaceControlMessages; }
  get lapCount()              { return this.state?.LapCount; }
  get topThree()              { return this.state?.TopThree; }
  get teamRadio()             { return this.state?.TeamRadio; }
  get championshipPrediction(){ return this.state?.ChampionshipPrediction; }
  get extrapolatedClock()     { return this.state?.ExtrapolatedClock; }

  isSessionLive() {
    const status = this.sessionStatus?.Status;
    return status === 'Started';
  }
}

// Singleton
export const f1State = new F1State();
