import { type ComputedRef, type Ref, computed, onBeforeUnmount, ref, shallowRef, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { modifierKeyActions } from '@/libs/joystick/protocols/other'
import { type MovedAxis, JoystickInputDetector } from '@/libs/joystick/wizard/detection'
import {
  type WizardMappingRow,
  axisOccupant,
  bindAxis,
  bindButton,
  buttonOccupant,
  createWizardMapping,
  shiftButtonInMapping,
  unbindAction,
  wizardMappingRows,
} from '@/libs/joystick/wizard/mapping'
import { buildWizardSteps, wizardVehicleFromMavType, wizardVehicleNames } from '@/libs/joystick/wizard/steps'
import { type JoystickWizardStep, JoystickWizardVehicle } from '@/libs/joystick/wizard/types'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import {
  type JoystickProfileOption,
  type JoystickProtocolActionsMapping,
  type JoystickState,
  CockpitModifierKeyOption,
} from '@/types/joystick'

/**
 * An entry of the vehicle picker shown on the intro step.
 */
export interface WizardVehicleOption {
  /**
   * Flow the entry selects
   */
  value: JoystickWizardVehicle
  /**
   * Name shown to the user
   */
  title: string
}

/**
 * Which way the user is currently pushing the axis being mapped.
 */
export type WizardAxisDirection = 'positive' | 'negative' | 'neutral'

/**
 * The button press a step captured, and whether it was a chord with the shift modifier.
 */
interface DetectedButton {
  /**
   * Index of the button, in Cockpit-standard numbering
   */
  index: number
  /**
   * Whether the shift modifier was held when the button was released
   */
  withShift: boolean
}

/**
 * Whether the connected hardware lets the wizard run, and what is wrong when it does not.
 */
export type WizardControllerIssue = 'none' | 'missing' | 'multiple'

/**
 * Everything the wizard modal needs to render itself and to drive the flow.
 */
export interface JoystickWizardController {
  /**
   * Vehicle flow being mapped
   */
  vehicle: ComputedRef<JoystickWizardVehicle>
  /**
   * Entries of the vehicle picker
   */
  vehicleOptions: WizardVehicleOption[]
  /**
   * How much the selected flow asks for, shown next to the picker
   */
  flowSummary: ComputedRef<string>
  /**
   * Switch to another vehicle flow, discarding whatever the current one had mapped
   * @param {JoystickWizardVehicle} vehicle - Flow to switch to
   */
  setVehicle: (vehicle: JoystickWizardVehicle) => void
  /**
   * Step currently on screen
   */
  step: ComputedRef<JoystickWizardStep>
  /**
   * Models of every connected controller
   */
  connectedJoystickNames: ComputedRef<string[]>
  /**
   * Whether the connected hardware is keeping the wizard from reading inputs
   */
  controllerIssue: ComputedRef<WizardControllerIssue>
  /**
   * Index of the axis detected on the current step
   */
  detectedAxisIndex: ComputedRef<number | undefined>
  /**
   * Live value of the detected axis
   */
  detectedAxisValue: ComputedRef<number>
  /**
   * Which way the detected axis is being pushed right now
   */
  detectedAxisDirection: ComputedRef<WizardAxisDirection>
  /**
   * Description of the button detected on the current step, shift prefix included
   */
  detectedButtonLabel: ComputedRef<string>
  /**
   * Whether the detected button is being held right now
   */
  isDetectedButtonPressed: ComputedRef<boolean>
  /**
   * Whether the shift modifier is being held right now
   */
  isShiftPressed: Ref<boolean>
  /**
   * Whether the current step has an input ready to commit
   */
  hasDetection: ComputedRef<boolean>
  /**
   * Why the detected input cannot be bound, when it is already taken
   */
  conflictMessage: Ref<string | null>
  /**
   * Live value of every axis of the controller
   */
  liveAxes: Ref<number[]>
  /**
   * Live value of every button of the controller
   */
  liveButtons: Ref<number[]>
  /**
   * Bindings made so far, for the review screen
   */
  reviewRows: ComputedRef<WizardMappingRow[]>
  /**
   * Whether the footer's advance button should be enabled
   */
  canAdvance: ComputedRef<boolean>
  /**
   * Text of the footer's advance button, which offers to skip a mapping step nothing was detected on
   */
  advanceLabel: ComputedRef<string>
  /**
   * Whether the flow can be cut short and taken straight to the review screen
   */
  canSkipToReview: ComputedRef<boolean>
  /**
   * Whether a previous step can be returned to
   */
  canGoBack: ComputedRef<boolean>
  /**
   * Commit the detected input, if any, and move to the next step
   */
  next: () => void
  /**
   * Return to the previously visited step
   */
  back: () => void
  /**
   * Answer a question step, continuing at the step the answer names
   * @param {string} label - Text of the answer, for the interaction log
   * @param {string} goTo - Identifier of the step to continue at
   */
  choose: (label: string, goTo: string) => void
  /**
   * Which answer of a question step the controller has selected, and which the advance button would commit
   */
  highlightedOptionIndex: Ref<number>
  /**
   * Leave the remaining steps unmapped and go to the review screen
   */
  skipToReview: () => void
  /**
   * Forget the input detected on the current step, to press or move another one
   */
  clearDetection: () => void
  /**
   * Bind the detected input even though something else already uses it
   */
  overwriteConflict: () => void
  /**
   * Throw the mapping away and start the flow again, asking first when the run has bindings to lose
   */
  restart: () => void
  /**
   * Open the dialog that asks where the finished mapping should be stored
   */
  save: () => void
  /**
   * Whether that dialog is showing
   */
  isSaveDialogOpen: Ref<boolean>
  /**
   * Name to offer for a profile created out of this mapping
   */
  defaultProfileName: ComputedRef<string>
  /**
   * Saved profiles, as selector entries for the one to replace
   */
  profileOptions: ComputedRef<JoystickProfileOption[]>
  /**
   * Close the save dialog and go back to the review screen
   */
  dismissSaveDialog: () => void
  /**
   * Store the mapping as a new profile and make it active
   * @param {string} name - Name to give the new profile
   */
  saveAsNewProfile: (name: string) => void
  /**
   * Replace an existing profile's bindings with the mapping and make it active
   * @param {string} hash - Identifier of the profile to write over
   */
  saveOverProfile: (hash: string) => void
  /**
   * Throw the mapping away and close the wizard, leaving every profile as it was
   */
  discardMapping: () => void
  /**
   * Close the wizard, asking first when the run has bindings to lose
   */
  close: () => void
}

const pressedThreshold = 0.5

// Deflection past which the live readout calls the axis pushed one way rather than centered
const directionDisplayThreshold = 0.2

/**
 * Drive the guided joystick mapping flow: pick the vehicle, read the controller, bind one input per step and hand the
 * finished mapping to the controller store.
 *
 * Meant to be called from the wizard modal, which is mounted only while the wizard is open, so that closing it leaves
 * no state behind.
 * @returns {JoystickWizardController} State and commands for the wizard modal
 */
export const useJoystickWizard = (): JoystickWizardController => {
  const controllerStore = useControllerStore()
  const vehicleStore = useMainVehicleStore()
  const interfaceStore = useAppInterfaceStore()
  const route = useRoute()
  const router = useRouter()
  const { openSnackbar } = useSnackbar()
  const { showDialog, closeDialog } = useInteractionDialog()

  const selectedVehicle = ref(wizardVehicleFromMavType(vehicleStore.vehicleType))
  const vehicle = computed(() => selectedVehicle.value)
  const mappingName = (): string => `${wizardVehicleNames[vehicle.value]} (wizard)`

  const steps = shallowRef<JoystickWizardStep[]>(buildWizardSteps(vehicle.value))
  const currentStepId = ref(steps.value[0].id)
  const visitedStepIds = ref<string[]>([])
  const freshMapping = (): JoystickProtocolActionsMapping =>
    createWizardMapping(mappingName(), toRaw(controllerStore.protocolMapping))
  const mapping = ref(freshMapping())

  const liveAxes = ref<number[]>([])
  const liveButtons = ref<number[]>([])
  const isShiftPressed = ref(false)
  const conflictMessage = ref<string | null>(null)
  const isSaveDialogOpen = ref(false)

  const detectedAxis = ref<MovedAxis | undefined>(undefined)
  const detectedButton = ref<DetectedButton | undefined>(undefined)
  // Seeded from the profile the run starts on, so a user who skips the shift step still has their existing modifier
  // held back from other bindings and their chords recognised
  const shiftButtonIndex = ref<number | undefined>(shiftButtonInMapping(mapping.value))
  const advanceButtonIndex = ref<number | undefined>(undefined)
  const highlightedOptionIndex = ref(0)

  // Inputs this run has bound. The mapping starts as a copy of the profile in use, so a clash is only worth raising
  // against a binding the user just made here, never against the one they arrived with and are deliberately replacing.
  const boundThisRun = new Map<string, string>()
  const axisKey = (index: number): string => `axis:${index}`
  const buttonKey = (modifier: CockpitModifierKeyOption, index: number): string => `button:${modifier}:${index}`

  const detector = new JoystickInputDetector()

  const step = computed(() => {
    const current = steps.value.find((s) => s.id === currentStepId.value)
    if (current !== undefined) return current
    console.error(`Joystick wizard flow has no step named "${currentStepId.value}". Falling back to the first one.`)
    return steps.value[0]
  })
  const stepAfterCurrent = (): JoystickWizardStep | undefined =>
    steps.value[steps.value.findIndex((s) => s.id === currentStepId.value) + 1]

  // Read from the same collection the gate below reads, rather than from the store's main-controller pointer, which
  // is only assigned once the connection check has finished asking the vehicle about other control sources
  const joystick = computed(() => Array.from(controllerStore.joysticks.values())[0])
  const connectedJoystickNames = computed(() =>
    Array.from(controllerStore.joysticks.values()).map((js) => String(js.model ?? 'Unknown'))
  )
  const controllerIssue = computed<WizardControllerIssue>(() => {
    if (controllerStore.joysticks.size === 0) return 'missing'
    return controllerStore.joysticks.size > 1 ? 'multiple' : 'none'
  })

  const detectedAxisIndex = computed(() => detectedAxis.value?.index)
  const detectedAxisValue = computed(() => {
    const index = detectedAxis.value?.index
    return index === undefined ? 0 : liveAxes.value[index] ?? 0
  })
  // Read from the deflection that will be bound rather than from where the stick is now, so the arrow cannot show the
  // opposite sign to the one the step is about to record. The live bar beside it already says where the stick is.
  const detectedAxisDirection = computed<WizardAxisDirection>(() => {
    const deflection = detectedAxis.value?.deflection
    if (deflection === undefined || Math.abs(deflection) < directionDisplayThreshold) return 'neutral'
    return deflection > 0 ? 'positive' : 'negative'
  })
  const detectedButtonLabel = computed(() => {
    if (detectedButton.value === undefined) return 'Press a button'
    const prefix = detectedButton.value.withShift ? 'Shift + ' : ''
    return `${prefix}Button ${detectedButton.value.index}`
  })
  const isDetectedButtonPressed = computed(() => {
    const index = detectedButton.value?.index
    return index === undefined ? false : (liveButtons.value[index] ?? 0) > pressedThreshold
  })

  const hasDetection = computed(() => {
    if (step.value.kind === 'axis') return detectedAxis.value !== undefined
    if (step.value.kind === 'button') return detectedButton.value !== undefined
    return false
  })

  const isMappingStep = computed(() => step.value.kind === 'axis' || step.value.kind === 'button')
  const canAdvance = computed(() => {
    if (controllerIssue.value !== 'none' || conflictMessage.value !== null) return false
    return isMappingStep.value || step.value.kind === 'vehicle'
  })
  const advanceLabel = computed(() => {
    if (!isMappingStep.value) return 'Next'
    if (!hasDetection.value) return 'Skip'
    // Named rather than called "start": whichever button left the intro is the one that advances, and leaving with
    // the mouse leaves none adopted at all
    return advanceButtonIndex.value === undefined ? 'Next' : `Next (button ${advanceButtonIndex.value})`
  })
  const canSkipToReview = computed(() => isMappingStep.value || step.value.kind === 'question')
  const canGoBack = computed(() => visitedStepIds.value.length > 0)

  const reviewRows = computed(() => wizardMappingRows(mapping.value))

  const vehicleOptions = Object.values(JoystickWizardVehicle).map((value) => ({
    value,
    title: wizardVehicleNames[value],
  }))

  // Numbered past whatever is already saved, so a second run on the same vehicle is not offered a name the dialog
  // will refuse
  const defaultProfileName = computed(() => {
    const taken = controllerStore.joystickProfileOptions.map((option) => option.title)
    const base = mappingName()
    if (!taken.includes(base)) return base
    let suffix = 2
    while (taken.includes(`${base} ${suffix}`)) suffix += 1
    return `${base} ${suffix}`
  })
  const profileOptions = computed(() => controllerStore.joystickProfileOptions)

  const flowSummary = computed(() => {
    const axes = steps.value.filter((s) => s.kind === 'axis').length
    const buttons = steps.value.filter((s) => s.kind === 'button').length
    const branches = steps.value.filter((s) => s.kind === 'question').length
    const shortened = branches === 0 ? '' : ', fewer once you rule out hardware the vehicle does not carry'
    return `Asks about ${axes} axes and ${buttons} buttons${shortened}.`
  })

  // Takes the current stick positions as rest and ignores buttons still held, so the press that reached this step is
  // not read again as the binding for it
  const armDetection = (): void => {
    conflictMessage.value = null
    detectedAxis.value = undefined
    detectedButton.value = undefined
    highlightedOptionIndex.value = 0
    if (joystick.value !== undefined) detector.startStep(joystick.value.state)
  }

  const goTo = (id: string): void => {
    visitedStepIds.value.push(currentStepId.value)
    currentStepId.value = id
    armDetection()
  }

  // Why the input detected on a step cannot take its action, or undefined when it can. Kept apart from the binding
  // below so that deciding, reporting and overriding a refusal are three separate calls rather than one pass.
  const refusalFor = (current: JoystickWizardStep): string | undefined => {
    if (current.kind === 'axis' && detectedAxis.value !== undefined) {
      const { index } = detectedAxis.value
      const occupant = axisOccupant(mapping.value, index)
      if (!boundThisRun.has(axisKey(index))) return undefined
      if (occupant === undefined || occupant.id === current.action.id) return undefined
      return `Axis ${index} already drives ${occupant.name}`
    }

    if (current.kind === 'button' && detectedButton.value !== undefined) {
      const { index, withShift } = detectedButton.value
      const isShiftStep = current.action.id === modifierKeyActions.shift.id
      if (!isShiftStep && !withShift && index === shiftButtonIndex.value) {
        return `Button ${index} is your shift modifier. Using it here removes the second layer of controls.`
      }

      const modifier = withShift ? CockpitModifierKeyOption.shift : CockpitModifierKeyOption.regular
      const occupant = buttonOccupant(mapping.value, modifier, index)
      if (!boundThisRun.has(buttonKey(modifier, index))) return undefined
      if (occupant === undefined || occupant.id === current.action.id) return undefined
      return `${withShift ? 'Shift + ' : ''}Button ${index} already triggers ${occupant.name}`
    }

    return undefined
  }

  // Binds what the step detected, or reports why it cannot. Skipping a step commits nothing and is always allowed.
  const commitCurrentStep = (force = false): boolean => {
    const current = step.value

    const refusal = force ? undefined : refusalFor(current)
    if (refusal !== undefined) {
      conflictMessage.value = refusal
      return false
    }

    if (current.kind === 'axis' && detectedAxis.value !== undefined) {
      const { index, deflection } = detectedAxis.value
      bindAxis(mapping.value, index, current, deflection)
      boundThisRun.set(axisKey(index), current.action.id)
      return true
    }

    if (current.kind === 'button' && detectedButton.value !== undefined) {
      const { index, withShift } = detectedButton.value
      // The modifier always goes on the regular layout, since the store unmaps a modifier that sits in its own layer
      const isShiftStep = current.action.id === modifierKeyActions.shift.id
      const modifier = withShift && !isShiftStep ? CockpitModifierKeyOption.shift : CockpitModifierKeyOption.regular
      bindButton(mapping.value, modifier, index, current.action)
      boundThisRun.set(buttonKey(modifier, index), current.action.id)
      // Re-read rather than assigned, so the pointer cannot name a button the binding just took the modifier off
      shiftButtonIndex.value = shiftButtonInMapping(mapping.value)
      return true
    }

    return true
  }

  const next = (): void => {
    if (!commitCurrentStep()) return
    const following = stepAfterCurrent()
    if (following === undefined) return
    const outcome = hasDetection.value ? '' : ' unmapped'
    logUserAction(`Left the joystick wizard "${step.value.id}" step${outcome}`)
    goTo(following.id)
  }

  const back = (): void => {
    const previous = visitedStepIds.value.pop()
    if (previous === undefined) return
    logUserAction(`Went back to the joystick wizard "${previous}" step`)
    currentStepId.value = previous
    armDetection()
  }

  const choose = (label: string, destination: string): void => {
    logUserAction(`Answered "${label}" on the joystick wizard "${step.value.id}" step`)
    goTo(destination)
  }

  const skipToReview = (): void => {
    if (!commitCurrentStep()) return
    logUserAction('Skipped ahead to the joystick wizard mapping review')
    goTo('review')
  }

  const clearDetection = (): void => {
    logUserAction(`Cleared the input detected on the joystick wizard "${step.value.id}" step`)
    const current = step.value
    // Only takes back what this run bound: on a step the user has not answered, what is bound is what they arrived
    // with, and the flow promises a skipped step keeps it
    if (current.kind === 'axis' || current.kind === 'button') {
      const boundHere = [...boundThisRun].find(([, actionId]) => actionId === current.action.id)?.[0]
      if (boundHere !== undefined) {
        boundThisRun.delete(boundHere)
        unbindAction(mapping.value, current.action.id)
      }
    }
    if (current.kind === 'button' && current.action.id === modifierKeyActions.shift.id) {
      shiftButtonIndex.value = shiftButtonInMapping(mapping.value)
    }
    armDetection()
  }

  const overwriteConflict = (): void => {
    logUserAction(`Overwrote the binding the joystick wizard "${step.value.id}" step clashed with`)
    conflictMessage.value = null
    if (!commitCurrentStep(true)) return
    const following = stepAfterCurrent()
    if (following !== undefined) goTo(following.id)
  }

  // Landing on a step the user is already standing on keeps their history, since the steps before the vehicle choice
  // are the same in every flow
  const resetFlow = (landOnStepId?: string): void => {
    steps.value = buildWizardSteps(vehicle.value)
    mapping.value = freshMapping()
    boundThisRun.clear()
    shiftButtonIndex.value = shiftButtonInMapping(mapping.value)
    if (landOnStepId === undefined) {
      visitedStepIds.value = []
      currentStepId.value = steps.value[0].id
      advanceButtonIndex.value = undefined
    } else {
      currentStepId.value = landOnStepId
    }
    armDetection()
  }

  const dismissWizard = (): void => {
    interfaceStore.isJoystickWizardVisible = false
  }

  // The bindings made in this run live nowhere but here until they are saved, so both controls that throw them away
  // ask first
  const confirmDiscardingRun = (title: string, confirmText: string, discard: () => void): void => {
    if (boundThisRun.size === 0) {
      discard()
      return
    }
    logUserAction(`Opened the joystick wizard "${title}" confirmation`)
    showDialog({
      title,
      variant: 'warning',
      maxWidth: 520,
      backdrop: true,
      message: 'Every input mapped in this run is lost. The profiles you already saved are left as they are.',
      actions: [
        {
          text: 'Cancel',
          action: () => {
            logUserAction('Kept the joystick wizard mapping')
            closeDialog()
          },
        },
        {
          text: confirmText,
          class: 'bg-[#FFFFFF33] text-white',
          action: () => {
            closeDialog()
            discard()
          },
        },
      ],
    })
  }

  const restart = (): void => {
    confirmDiscardingRun('Restart the wizard?', 'Restart', () => {
      logUserAction('Restarted the joystick wizard mapping')
      resetFlow()
    })
  }

  const setVehicle = (newVehicle: JoystickWizardVehicle): void => {
    if (newVehicle === selectedVehicle.value) return
    confirmDiscardingRun('Change the vehicle?', 'Change vehicle', () => {
      logUserAction(`Selected the "${wizardVehicleNames[newVehicle]}" flow in the joystick wizard`)
      selectedVehicle.value = newVehicle
    })
  }

  const close = (): void => {
    confirmDiscardingRun('Close the wizard?', 'Close wizard', () => {
      logUserAction('Closed the joystick wizard')
      dismissWizard()
    })
  }

  const save = (): void => {
    logUserAction('Opened the joystick wizard save dialog')
    isSaveDialogOpen.value = true
  }

  const dismissSaveDialog = (): void => {
    logUserAction('Went back to the joystick wizard review from the save dialog')
    isSaveDialogOpen.value = false
  }

  const saveAsNewProfile = (name: string): void => {
    controllerStore.addJoystickProfile({ ...structuredClone(toRaw(mapping.value)), name })
    logUserAction(`Saved the joystick wizard mapping as the new profile "${name}"`)
    openSnackbar({ variant: 'success', message: `"${name}" is now your joystick profile.`, duration: 4000 })
    dismissWizard()
  }

  const saveOverProfile = (hash: string): void => {
    const name = controllerStore.joystickProfileName(hash)
    controllerStore.replaceJoystickProfile(hash, structuredClone(toRaw(mapping.value)))
    logUserAction(`Replaced the "${name}" joystick profile with the wizard mapping`)
    openSnackbar({ variant: 'success', message: `"${name}" now holds the mapping you just made.`, duration: 4000 })
    dismissWizard()
  }

  const discardMapping = (): void => {
    confirmDiscardingRun('Discard the mapping?', 'Discard', () => {
      logUserAction('Discarded the joystick wizard mapping')
      openSnackbar({ variant: 'info', message: 'The mapping was discarded.', duration: 4000 })
      dismissWizard()
    })
  }

  let liveUpdateHandle: number | undefined = undefined
  const scheduleLiveUpdate = (state: JoystickState): void => {
    if (liveUpdateHandle !== undefined) return
    liveUpdateHandle = requestAnimationFrame(() => {
      liveUpdateHandle = undefined
      liveAxes.value = state.axes.map((value) => value ?? 0)
      liveButtons.value = state.buttons.map((value) => value ?? 0)
    })
  }

  // The button that leaves the intro becomes the one that advances the wizard from there on. Leaving the intro with
  // the mouse names none, so whichever button the user releases on a later step is adopted then instead.
  const adoptAdvanceButton = (releases: number[]): void => {
    const first = releases[0]
    if (advanceButtonIndex.value !== undefined || first === undefined) return
    advanceButtonIndex.value = first
    logUserAction(`Took button ${first} as the one that advances the joystick wizard`)
  }

  const onControllerFrame = (state: JoystickState): void => {
    // Kept in sync even while blocked, so unplugging the extra controller does not surface a release the user made
    // behind the warning. Everything past this point assumes the single controller the warning is asking for.
    const frame = detector.update(state)
    if (controllerIssue.value !== 'none') return

    scheduleLiveUpdate(state)
    if (shiftButtonIndex.value !== undefined) isShiftPressed.value = detector.isPressed(shiftButtonIndex.value)

    adoptAdvanceButton(frame.releases)

    const current = step.value
    const advancesNow = advanceButtonIndex.value !== undefined && frame.releases.includes(advanceButtonIndex.value)

    if (current.kind === 'intro') {
      if (advancesNow) next()
      return
    }

    // Keeps the intro's promise that the adopted button carries the whole flow: every branch offers two answers side
    // by side, so a stick pushed left or right picks between them and the button commits the one on screen. Read
    // live rather than from the step's largest deflection, so the user can push back the other way and change answer.
    if (current.kind === 'question') {
      const deflection = frame.liveAxis?.deflection
      if (deflection !== undefined) highlightedOptionIndex.value = deflection < 0 ? 0 : current.options.length - 1
      if (!advancesNow) return
      const answer = current.options[highlightedOptionIndex.value]
      choose(answer.label, answer.goTo)
      return
    }

    if (current.kind === 'axis') detectedAxis.value = frame.movedAxis

    // Reading the release rather than the press commits a chord with the modifier the user was actually holding. The
    // shift button is detected like any other, so refusalFor can say why it is unavailable instead of the step
    // appearing to ignore the press.
    if (current.kind === 'button' && detectedButton.value === undefined) {
      const candidate = frame.releases[0]
      if (candidate !== undefined) {
        detectedButton.value = { index: candidate, withShift: isShiftPressed.value }
        conflictMessage.value = null
        return
      }
    }

    if (advancesNow && canAdvance.value) next()
  }

  // The controller store refreshes the gamepad on every frame whether or not forwarding is on, so watching the derived
  // state reads the controller without the half-built mapping ever reaching the vehicle
  watch(
    () => joystick.value?.state,
    (state) => {
      if (state !== undefined) onControllerFrame(state)
    }
  )

  watch(vehicle, () => resetFlow(step.value.kind === 'intro' ? 'intro' : 'vehicle'))

  // The step is only usable once the warning clears, so it re-takes rest from whichever controller is current by then
  // rather than presenting whatever was moved behind it
  watch(controllerIssue, (issue) => {
    if (issue === 'none') armDetection()
  })

  // Follow the vehicle while the user has not reached the picker, so a late heartbeat still preselects the right one
  watch(
    () => vehicleStore.vehicleType,
    (mavType) => {
      if (step.value.kind !== 'intro') return
      selectedVehicle.value = wizardVehicleFromMavType(mavType)
    }
  )

  // The wizard is opened from a panel inside the main menu, which would otherwise sit over it. Hiding the menu takes
  // a sub-menu address back to the base view, so the page it was opened from is remembered and restored on close.
  const pageBehindWizard = route.fullPath
  interfaceStore.isMainMenuVisible = false

  controllerStore.isCapturingInputsForMapping = true

  onBeforeUnmount(() => {
    if (liveUpdateHandle !== undefined) cancelAnimationFrame(liveUpdateHandle)
    controllerStore.isCapturingInputsForMapping = false
    if (route.fullPath !== pageBehindWizard) router.replace(pageBehindWizard)
  })

  return {
    vehicle,
    vehicleOptions,
    flowSummary,
    setVehicle,
    step,
    connectedJoystickNames,
    controllerIssue,
    detectedAxisIndex,
    detectedAxisValue,
    detectedAxisDirection,
    detectedButtonLabel,
    isDetectedButtonPressed,
    isShiftPressed,
    hasDetection,
    conflictMessage,
    liveAxes,
    liveButtons,
    reviewRows,
    canAdvance,
    advanceLabel,
    canSkipToReview,
    canGoBack,
    next,
    back,
    choose,
    highlightedOptionIndex,
    skipToReview,
    clearDetection,
    overwriteConflict,
    restart,
    save,
    isSaveDialogOpen,
    defaultProfileName,
    profileOptions,
    dismissSaveDialog,
    saveAsNewProfile,
    saveOverProfile,
    discardMapping,
    close,
  }
}
