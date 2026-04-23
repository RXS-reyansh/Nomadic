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
   * Whether to fall back to the config-defined fake CPU usage range
   * (fakeLowerCpuUsage / fakeUpperCpuUsage) if the real CPU measurement
   * returns 0 or fails.
   * Real measurement is always attempted first.
   */
  enableCpuFallback: true,

  /**
   * How long (ms) the CPU snapshot interval runs to compute real usage.
   * Higher = more accurate. Lower = faster command response.
   */
  cpuSampleIntervalMs: 150,
};

export default debugConfig;
