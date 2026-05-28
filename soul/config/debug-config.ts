 // soul/config/debug-config.ts
// Configuration specific to the debug command display and behaviour.

export const debugConfig = {
  /**
   * Inactivity timeout for the debug menu (ms).
   * After this duration with no interaction, all buttons and the dropdown are disabled.
   */
  sessionTimeoutMs: 3 * 60 * 1000,

  /**
   * Whether to show the Process ID in the Cluster & Sharding section.
   * Disable if you consider the PID sensitive.
   */
  showProcessId: true,

  /**
   * Whether to fall back to the fake CPU usage range
   * (fakeLowerCpuUsage / fakeUpperCpuUsage) below if the real CPU
   * measurement returns 0 or fails.
   * Real measurement is always attempted first.
   */
  enableCpuFallback: true,

  /**
   * How long (ms) the CPU snapshot interval runs to compute real usage.
   * Higher = more accurate. Lower = faster command response.
   */
  cpuSampleIntervalMs: 150,

  /**
   * Lower bound of the fake CPU usage range (percent). Used by the debug
   * menu only when `enableCpuFallback` is true and the real reading is
   * unavailable.
   */
  fakeLowerCpuUsage: 3.0,

  /**
   * Upper bound of the fake CPU usage range (percent). Same conditions
   * as `fakeLowerCpuUsage`.
   */
  fakeUpperCpuUsage: 5.0,

  /**
   * Minimum total RAM (MB) reported by the debug menu. If the real
   * detected total is lower than this, the value is clamped up to this
   * floor before being shown.
   */
  minTotalRamMB: 8092,
};

export default debugConfig;
