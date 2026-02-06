import ky from 'ky'

import { createDataLakeVariable, getDataLakeVariableData, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { ConnectionManager } from '@/libs/connection/connection-manager'

/**
 * Statistics data structure
 */
interface StatsData {
  /** Total incoming messages */
  totalIncoming: number
  /** Total outgoing messages */
  totalOutgoing: number
  /** Incoming message rate per second */
  incomingRate: number
  /** Outgoing message rate per second */
  outgoingRate: number
}

/**
 * External service info structure
 */
interface ServiceInfo {
  /** Service information */
  service: {
    /** Service name */
    name: string
  }
}

/**
 * MAVLink2Rest message response structure
 */
interface MAVLink2RestMessage {
  /** Message data */
  message: {
    /** Message type */
    type: string
    /** Time since boot in milliseconds */
    time_boot_ms?: number
    /** Timestamp in microseconds */
    time_unix_usec?: number
    /** Attitude values - roll angle */
    roll?: number
    /** Attitude values - pitch angle */
    pitch?: number
    /** Attitude values - yaw angle */
    yaw?: number
  }
  /** Status information including timing */
  status: {
    /** Timing information */
    time: {
      /** Last update timestamp */
      last_update: string
      /** First update timestamp */
      first_update: string
      /** Message counter */
      counter: number
      /** Frequency in Hz */
      frequency: number
    }
  }
}

/**
 * MAVLink-Server stats structure
 */
interface MAVLinkServerStats {
  /** UUID-keyed driver stats */
  [uuid: string]: {
    /** Driver statistics */
    stats: {
      /** Input statistics */
      input: {
        /** Last message time in microseconds */
        last_message_time_us: number
      }
      /** Output statistics */
      output: {
        /** Last message time in microseconds */
        last_message_time_us: number
      }
    }
  }
}

/**
 * External component health status
 */
interface ExternalComponentHealth {
  /** Service is responding */
  isOnline: boolean
  /** Service name matches expected */
  isCorrectService: boolean
  /** Seconds since last update */
  secondsSinceLastUpdate: number
  /** Error message if any */
  error?: string
}

/**
 * Service to track MAVLink message statistics
 */
export class MAVLinkStatsService {
  private static _instance: MAVLinkStatsService | null = null
  private _totalIncoming = 0
  private _totalOutgoing = 0
  private _incomingRate = 0
  private _outgoingRate = 0
  private _lastIncomingCount = 0
  private _lastOutgoingCount = 0
  private _rateUpdateInterval: NodeJS.Timeout | null = null
  private _externalCheckInterval: NodeJS.Timeout | null = null

  // External component health tracking
  private _mavlink2restHealth: ExternalComponentHealth = {
    isOnline: false,
    isCorrectService: false,
    secondsSinceLastUpdate: -1,
  }
  private _mavlinkServerHealth: ExternalComponentHealth = {
    isOnline: false,
    isCorrectService: false,
    secondsSinceLastUpdate: -1,
  }

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.initializeDataLakeVariables()
    this.setupMessageListeners()
    this.startRateCalculation()
    this.startExternalComponentChecks()
  }

  /**
   * Get the singleton instance
   * @returns {MAVLinkStatsService} The singleton instance
   */
  static getInstance(): MAVLinkStatsService {
    if (!MAVLinkStatsService._instance) {
      MAVLinkStatsService._instance = new MAVLinkStatsService()
    }
    return MAVLinkStatsService._instance
  }

  /**
   * Get current vehicle address from data lake
   * @returns {string} Vehicle address string
   */
  private getVehicleAddress(): string {
    try {
      return (getDataLakeVariableData('vehicle-address') as string) || '192.168.0.130'
    } catch {
      return '192.168.0.130'
    }
  }

  /**
   * Get current ArduPilot system ID from data lake
   * @returns {number} ArduPilot system ID number
   */
  private getArduPilotSystemId(): number {
    try {
      return (getDataLakeVariableData('ardupilotSystemId') as number) || 1
    } catch {
      return 1
    }
  }

  /**
   * Initialize data lake variables for stats
   */
  private initializeDataLakeVariables(): void {
    try {
      // Internal stats variables (existing)
      createDataLakeVariable(
        {
          id: 'mavlink-total-incoming',
          name: 'MAVLink Total Incoming Messages',
          type: 'number',
          description: 'Total number of incoming MAVLink messages received',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        0
      )

      createDataLakeVariable(
        {
          id: 'mavlink-total-outgoing',
          name: 'MAVLink Total Outgoing Messages',
          type: 'number',
          description: 'Total number of outgoing MAVLink messages sent',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        0
      )

      createDataLakeVariable(
        {
          id: 'mavlink-incoming-rate',
          name: 'MAVLink Incoming Rate (msg/s)',
          type: 'number',
          description: 'Rate of incoming MAVLink messages per second',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        0
      )

      createDataLakeVariable(
        {
          id: 'mavlink-outgoing-rate',
          name: 'MAVLink Outgoing Rate (msg/s)',
          type: 'number',
          description: 'Rate of outgoing MAVLink messages per second',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        0
      )

      // External component health variables
      createDataLakeVariable(
        {
          id: 'mavlink2rest-online',
          name: 'MAVLink2Rest Online Status',
          type: 'boolean',
          description: 'Whether MAVLink2Rest service is online and responding',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        false
      )

      createDataLakeVariable(
        {
          id: 'mavlink2rest-correct-service',
          name: 'MAVLink2Rest Service Verification',
          type: 'boolean',
          description: 'Whether the service at the endpoint is actually MAVLink2Rest',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        false
      )

      createDataLakeVariable(
        {
          id: 'mavlink2rest-heartbeat-age',
          name: 'MAVLink2Rest Heartbeat Age (s)',
          type: 'number',
          description: 'Seconds since last heartbeat from vehicle via MAVLink2Rest',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        -1
      )

      createDataLakeVariable(
        {
          id: 'mavlink2rest-system-time-age',
          name: 'MAVLink2Rest System Time Age (s)',
          type: 'number',
          description: 'Seconds since last system time message from vehicle via MAVLink2Rest',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        -1
      )

      createDataLakeVariable(
        {
          id: 'mavlink2rest-attitude-age',
          name: 'MAVLink2Rest Attitude Age (s)',
          type: 'number',
          description: 'Seconds since last attitude message from vehicle via MAVLink2Rest',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        -1
      )

      createDataLakeVariable(
        {
          id: 'mavlink-server-online',
          name: 'MAVLink Server Online Status',
          type: 'boolean',
          description: 'Whether MAVLink Server service is online and responding',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        false
      )

      createDataLakeVariable(
        {
          id: 'mavlink-server-correct-service',
          name: 'MAVLink Server Service Verification',
          type: 'boolean',
          description: 'Whether the service at the endpoint is actually MAVLink Server',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        false
      )

      createDataLakeVariable(
        {
          id: 'mavlink-server-stats-count',
          name: 'MAVLink Server Endpoint Count',
          type: 'number',
          description: 'Number of endpoints monitored by MAVLink Server',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        0
      )

      createDataLakeVariable(
        {
          id: 'mavlink-server-soonest-input-age',
          name: 'MAVLink Server Soonest Input Age (s)',
          type: 'number',
          description: 'Seconds since last input message on the most active endpoint',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        -1
      )

      createDataLakeVariable(
        {
          id: 'mavlink-server-soonest-output-age',
          name: 'MAVLink Server Soonest Output Age (s)',
          type: 'number',
          description: 'Seconds since last output message on the most active endpoint',
          persistent: false,
          persistValue: false,
          allowUserToChangeValue: false,
        },
        -1
      )
    } catch (error) {
      console.warn('MAVLink stats variables may already exist:', error)
    }
  }

  /**
   * Setup message listeners for incoming and outgoing messages
   */
  private setupMessageListeners(): void {
    ConnectionManager.onRead.add(this.onIncomingMessage.bind(this))
    ConnectionManager.onWrite.add(this.onOutgoingMessage.bind(this))
  }

  /**
   * Handle incoming message
   */
  private onIncomingMessage(): void {
    this._totalIncoming++
    setDataLakeVariableData('mavlink-total-incoming', this._totalIncoming)
  }

  /**
   * Handle outgoing message
   */
  private onOutgoingMessage(): void {
    this._totalOutgoing++
    setDataLakeVariableData('mavlink-total-outgoing', this._totalOutgoing)
  }

  /**
   * Start calculating message rates
   */
  private startRateCalculation(): void {
    this._rateUpdateInterval = setInterval(() => {
      // Calculate rates (messages per second)
      this._incomingRate = this._totalIncoming - this._lastIncomingCount
      this._outgoingRate = this._totalOutgoing - this._lastOutgoingCount

      // Update data lake variables
      setDataLakeVariableData('mavlink-incoming-rate', this._incomingRate)
      setDataLakeVariableData('mavlink-outgoing-rate', this._outgoingRate)

      // Store current counts for next calculation
      this._lastIncomingCount = this._totalIncoming
      this._lastOutgoingCount = this._totalOutgoing
    }, 1000) // Update every second
  }

  /**
   * Get current statistics
   * @returns {StatsData} Current statistics object
   */
  getStats(): StatsData {
    return {
      totalIncoming: this._totalIncoming,
      totalOutgoing: this._totalOutgoing,
      incomingRate: this._incomingRate,
      outgoingRate: this._outgoingRate,
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this._totalIncoming = 0
    this._totalOutgoing = 0
    this._incomingRate = 0
    this._outgoingRate = 0
    this._lastIncomingCount = 0
    this._lastOutgoingCount = 0

    // Update data lake variables
    setDataLakeVariableData('mavlink-total-incoming', 0)
    setDataLakeVariableData('mavlink-total-outgoing', 0)
    setDataLakeVariableData('mavlink-incoming-rate', 0)
    setDataLakeVariableData('mavlink-outgoing-rate', 0)
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this._rateUpdateInterval) {
      clearInterval(this._rateUpdateInterval)
      this._rateUpdateInterval = null
    }
    if (this._externalCheckInterval) {
      clearInterval(this._externalCheckInterval)
      this._externalCheckInterval = null
    }
    ConnectionManager.onRead.remove(this.onIncomingMessage.bind(this))
    ConnectionManager.onWrite.remove(this.onOutgoingMessage.bind(this))
  }

  /**
   * Start external component checks
   */
  private startExternalComponentChecks(): void {
    this._externalCheckInterval = setInterval(() => {
      this.checkMavlink2restHealth()
      this.checkMavlinkServerHealth()
    }, 1000) // Update every second as requested
  }

  /**
   * Check MAVLink2Rest health
   */
  private async checkMavlink2restHealth(): Promise<void> {
    const vehicleAddress = this.getVehicleAddress()
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http'
    const baseUrl = `${protocol}://${vehicleAddress}:6040`

    try {
      // Check service info
      const infoResponse = await ky.get(`${baseUrl}/info`, { timeout: 3000 }).json<ServiceInfo>()
      const isCorrectService = infoResponse.service.name === 'mavlink2rest'

      this._mavlink2restHealth.isOnline = true
      this._mavlink2restHealth.isCorrectService = isCorrectService
      this._mavlink2restHealth.error = undefined

      // Update data lake variables
      setDataLakeVariableData('mavlink2rest-online', true)
      setDataLakeVariableData('mavlink2rest-correct-service', isCorrectService)

      if (isCorrectService) {
        // Check message timestamps
        await this.checkMavlink2restMessages(baseUrl)
      }
    } catch (error) {
      this._mavlink2restHealth.isOnline = false
      this._mavlink2restHealth.isCorrectService = false
      this._mavlink2restHealth.error = error instanceof Error ? error.message : 'Unknown error'

      // Update data lake variables
      setDataLakeVariableData('mavlink2rest-online', false)
      setDataLakeVariableData('mavlink2rest-correct-service', false)
      setDataLakeVariableData('mavlink2rest-heartbeat-age', -1)
      setDataLakeVariableData('mavlink2rest-system-time-age', -1)
      setDataLakeVariableData('mavlink2rest-attitude-age', -1)
    }
  }

  /**
   * Check MAVLink2Rest message timestamps
   * @param {string} baseUrl - Base URL for MAVLink2Rest API
   */
  private async checkMavlink2restMessages(baseUrl: string): Promise<void> {
    const systemId = this.getArduPilotSystemId()
    const componentId = 1
    const currentTime = Date.now()

    const messageTypes = ['HEARTBEAT', 'SYSTEM_TIME', 'ATTITUDE']
    const ageVariables = ['mavlink2rest-heartbeat-age', 'mavlink2rest-system-time-age', 'mavlink2rest-attitude-age']

    for (let i = 0; i < messageTypes.length; i++) {
      try {
        const messageType = messageTypes[i]
        const ageVariable = ageVariables[i]
        const url = `${baseUrl}/v1/mavlink/vehicles/${systemId}/components/${componentId}/messages/${messageType}`

        const response = await ky.get(url, { timeout: 3000 }).json<MAVLink2RestMessage>()

        let ageSeconds = -1

        if (response.status?.time?.last_update) {
          // Use the last_update timestamp from the status for all messages
          // This tells us when MAVLink2Rest last received this message type
          const lastUpdateTime = new Date(response.status.time.last_update).getTime()
          const ageMs = currentTime - lastUpdateTime
          ageSeconds = ageMs / 1000 // Keep as decimal for millisecond precision (can be negative for future timestamps)
        }

        setDataLakeVariableData(ageVariable, ageSeconds)
      } catch (error) {
        // If we can't get the message, set age to -1 (unknown)
        setDataLakeVariableData(ageVariables[i], -1)
      }
    }
  }

  /**
   * Check MAVLink Server health
   */
  private async checkMavlinkServerHealth(): Promise<void> {
    const vehicleAddress = this.getVehicleAddress()
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http'
    const baseUrl = `${protocol}://${vehicleAddress}:8080`

    try {
      // Check service info
      const infoResponse = await ky.get(`${baseUrl}/info`, { timeout: 3000 }).json<ServiceInfo>()
      const isCorrectService = infoResponse.service.name === 'mavlink-server'

      this._mavlinkServerHealth.isOnline = true
      this._mavlinkServerHealth.isCorrectService = isCorrectService
      this._mavlinkServerHealth.error = undefined

      // Update data lake variables
      setDataLakeVariableData('mavlink-server-online', true)
      setDataLakeVariableData('mavlink-server-correct-service', isCorrectService)

      if (isCorrectService) {
        // Check driver stats
        await this.checkMavlinkServerStats(baseUrl)
      }
    } catch (error) {
      this._mavlinkServerHealth.isOnline = false
      this._mavlinkServerHealth.isCorrectService = false
      this._mavlinkServerHealth.error = error instanceof Error ? error.message : 'Unknown error'

      // Update data lake variables
      setDataLakeVariableData('mavlink-server-online', false)
      setDataLakeVariableData('mavlink-server-correct-service', false)
      setDataLakeVariableData('mavlink-server-stats-count', 0)
      setDataLakeVariableData('mavlink-server-soonest-input-age', -1)
      setDataLakeVariableData('mavlink-server-soonest-output-age', -1)
    }
  }

  /**
   * Check MAVLink Server driver statistics
   * @param {string} baseUrl - Base URL for MAVLink Server API
   */
  private async checkMavlinkServerStats(baseUrl: string): Promise<void> {
    try {
      const statsResponse = await ky.get(`${baseUrl}/stats/drivers`, { timeout: 3000 }).json<MAVLinkServerStats>()
      const currentTimeUs = Date.now() * 1000 // Convert to microseconds

      let soonestInputAge = -1
      let soonestOutputAge = -1
      let endpointCount = 0

      Object.values(statsResponse).forEach((driver) => {
        if (driver.stats) {
          endpointCount++

          // Calculate input age
          if (driver.stats.input?.last_message_time_us) {
            const inputAgeUs = currentTimeUs - driver.stats.input.last_message_time_us
            const inputAgeSeconds = inputAgeUs / 1000000 // Convert to seconds with decimal precision (can be negative for future timestamps)
            if (soonestInputAge === -1 || inputAgeSeconds < soonestInputAge) {
              soonestInputAge = inputAgeSeconds
            }
          }

          // Calculate output age
          if (driver.stats.output?.last_message_time_us) {
            const outputAgeUs = currentTimeUs - driver.stats.output.last_message_time_us
            const outputAgeSeconds = outputAgeUs / 1000000 // Convert to seconds with decimal precision (can be negative for future timestamps)
            if (soonestOutputAge === -1 || outputAgeSeconds < soonestOutputAge) {
              soonestOutputAge = outputAgeSeconds
            }
          }
        }
      })

      // Update data lake variables
      setDataLakeVariableData('mavlink-server-stats-count', endpointCount)
      setDataLakeVariableData('mavlink-server-soonest-input-age', soonestInputAge)
      setDataLakeVariableData('mavlink-server-soonest-output-age', soonestOutputAge)
    } catch (error) {
      // If we can't get stats, reset to default values
      setDataLakeVariableData('mavlink-server-stats-count', 0)
      setDataLakeVariableData('mavlink-server-soonest-input-age', -1)
      setDataLakeVariableData('mavlink-server-soonest-output-age', -1)
    }
  }
}

// Initialize the service when the module is loaded
MAVLinkStatsService.getInstance()
