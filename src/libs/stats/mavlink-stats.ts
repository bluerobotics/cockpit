import { createDataLakeVariable, setDataLakeVariableData } from '@/libs/actions/data-lake'
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

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.initializeDataLakeVariables()
    this.setupMessageListeners()
    this.startRateCalculation()
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
   * Initialize data lake variables for stats
   */
  private initializeDataLakeVariables(): void {
    try {
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
    ConnectionManager.onRead.remove(this.onIncomingMessage.bind(this))
    ConnectionManager.onWrite.remove(this.onOutgoingMessage.bind(this))
  }
}

// Initialize the service when the module is loaded
MAVLinkStatsService.getInstance()
