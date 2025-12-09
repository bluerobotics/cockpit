// Register BlueOS variables in the data lake
export const blueOsVariables = {
  cpuTemp: {
    id: 'blueos/cpu/tempC',
    name: 'BlueOS CPU Temperature',
    type: 'number',
    description: 'The average temperature of the BlueOS CPU cores in °C.',
  },
  cpuUsageAverage: {
    id: 'blueos/cpu/usageAverage',
    name: 'BlueOS CPU Usage',
    type: 'number',
    description: 'The average usage of the BlueOS CPU cores in %.',
  },
  cpuFrequencyAverage: {
    id: 'blueos/cpu/frequencyAverage',
    name: 'BlueOS CPU Frequency',
    type: 'number',
    description: 'The average frequency of the BlueOS CPU cores in Hz.',
  },
}
