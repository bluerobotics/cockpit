<template>
  <GlassModal
    :is-visible="showTutorial"
    class="pa-5 z-[1000000]"
    :draggable="true"
    storage-key="cockpit-tutorial-modal"
    is-persistent
  >
    <div class="w-[600px]" :class="tallContent ? 'h-[350px]' : 'h-[280px]'">
      <v-window v-model="currentTutorialStep" class="w-full h-full cursor-move" reverse>
        <v-window-item v-for="step in steps" :key="step.id" :value="step.id" class="flex justify-center items-center">
          <v-timeline direction="horizontal" class="custom-timeline">
            <v-timeline-item
              :key="step.id"
              ref="timelineItems"
              fill-dot
              size="x-large"
              elevation="3"
              class="cursor-move"
              :dot-color="vehicleStore.isVehicleOnline ? '#4fa483' : '#2c614c'"
            >
              <div
                v-if="vehicleStore.isVehicleOnline && currentTutorialStep === 5"
                class="fixed left-5 top-5 h-6 pa-1 rounded-md bg-[#3b7e64] border-[1px] border-[#FFFFFF88] mb-10 elevation-1"
                :style="{ opacity: isVehicleConnectedVisible ? 1 : 0, transition: 'opacity 0.5s ease-in-out' }"
              >
                <p class="text-xs">{{ $t('tutorial.vehicleConnected') }}</p>
              </div>
              <template #icon>
                <v-avatar
                  size="x-large"
                  class="border-1 border-[#FFFFFF88]"
                  :class="vehicleStore.isVehicleOnline ? 'ripple' : ''"
                >
                  <img :src="CockpitLogo" class="p-[7px] mt-1" />
                </v-avatar>
              </template>
              <div>
                <div class="flex justify-center text-h6 text-center -mt-1">
                  {{ step.title }}
                </div>
                <p class="text-center" :class="step.content ? 'mt-3' : 'mt-0'">{{ step.content }}</p>
              </div>
              <template #opposite>
                <p class="text-center">{{ step.opposite }}</p>
              </template>
            </v-timeline-item>
          </v-timeline>
        </v-window-item>
      </v-window>
    </div>
    <div class="fixed top-1 right-1">
      <v-btn
        v-if="currentTutorialStep !== steps.length"
        icon="mdi-close"
        size="small"
        variant="text"
        class="text-lg"
        @click="closeTutorial"
      ></v-btn>
    </div>
    <div class="fixed bottom-0 flex justify-between w-full -ml-5 pa-4">
      <v-btn v-if="currentTutorialStep > 1" variant="text" @click="backTutorialStep">{{ $t('tutorial.previous') }}</v-btn>
      <v-btn
        variant="text"
        :class="{ 'mr-11 opacity-[50%]': currentTutorialStep > 1 }"
        @click="
          () => {
            interfaceStore.userHasSeenTutorial ? alwaysShowTutorialOnStartup() : dontShowTutorialAgain()
          }
        "
        >{{ interfaceStore.userHasSeenTutorial ? $t('tutorial.showOnStartup') : $t('tutorial.dontShowAgain') }}</v-btn
      >
      <v-btn
        variant="flat"
        class="bg-[#3B78A8] opacity-1 shadow-md"
        @click="nextTutorialStep"
        @keydown.enter="nextTutorialStep"
      >
        {{ currentTutorialStep === steps.length ? $t('tutorial.close') : currentTutorialStep === 1 ? $t('tutorial.start') : $t('tutorial.next') }}
      </v-btn>
    </div>
  </GlassModal>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CockpitLogo from '@/assets/cockpit-logo-minimal.png'
import { useSnackbar } from '@/composables/snackbar'
import { SubMenuComponentName, SubMenuName, useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import GlassModal from './GlassModal.vue'

const { openSnackbar } = useSnackbar()
const interfaceStore = useAppInterfaceStore()
const vehicleStore = useMainVehicleStore()
const { t } = useI18n()

const showTutorial = ref(true)
const currentTutorialStep = useStorage('cockpit-last-tutorial-step', 1)
const isVehicleConnectedVisible = ref(false)
const tallContent = ref(false)

const steps = [
  {
    id: 1,
    title: t('tutorial.step1.title'),
    content: t('tutorial.step1.content'),
    opposite: t('tutorial.step1.opposite'),
  },
  {
    id: 2,
    title: t('tutorial.step2.title'),
    content: t('tutorial.step2.content'),
    opposite: t('tutorial.step2.opposite'),
  },
  {
    id: 3,
    title: t('tutorial.step3.title'),
    opposite: t('tutorial.step3.opposite'),
  },
  {
    id: 4,
    title: t('tutorial.step4.title'),
    content: t('tutorial.step4.content'),
    opposite: t('tutorial.step4.opposite'),
  },
  {
    id: 5,
    title: t('tutorial.step5.title'),
    content: t('tutorial.step5.content'),
    opposite: t('tutorial.step5.opposite'),
  },
  {
    id: 6,
    title: t('tutorial.step6.title'),
    opposite: t('tutorial.step6.opposite'),
  },
  {
    id: 7,
    title: t('tutorial.step7.title'),
    content: t('tutorial.step7.content'),
    opposite: t('tutorial.step7.opposite'),
  },
  {
    id: 8,
    title: t('tutorial.step8.title'),
    content: t('tutorial.step8.content'),
    opposite: t('tutorial.step8.opposite'),
  },
  {
    id: 9,
    title: t('tutorial.step9.title'),
    opposite: t('tutorial.step9.opposite'),
  },
  {
    id: 10,
    title: t('tutorial.step10.title'),
    opposite: t('tutorial.step10.opposite'),
  },
  {
    id: 11,
    title: t('tutorial.step11.title'),
    content: t('tutorial.step11.content'),
    opposite: t('tutorial.step11.opposite'),
  },
  {
    id: 12,
    title: t('tutorial.step12.title'),
    opposite: t('tutorial.step12.opposite'),
  },
  {
    id: 13,
    title: t('tutorial.step13.title'),
    content: t('tutorial.step13.content'),
    opposite: t('tutorial.step13.opposite'),
  },
]

const handleStepChange = (newStep: number): void => {
  switch (newStep) {
    case 1:
      interfaceStore.isMainMenuVisible = false
      interfaceStore.mainMenuCurrentStep = 1
      interfaceStore.componentToHighlight = 'none'
      interfaceStore.currentSubMenuComponentName = null
      interfaceStore.currentSubMenuName = null
      break
    case 2:
      interfaceStore.isMainMenuVisible = false
      interfaceStore.mainMenuCurrentStep = 1
      interfaceStore.componentToHighlight = 'menu-trigger'
      interfaceStore.currentSubMenuComponentName = null
      interfaceStore.currentSubMenuName = null
      interfaceStore.userHasSeenTutorial = false
      break
    case 3:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.componentToHighlight = 'settings-menu-item'
      interfaceStore.currentSubMenuComponentName = null
      interfaceStore.userHasSeenTutorial = false
      break
    case 4:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsGeneral
      tallContent.value = true
      interfaceStore.userHasSeenTutorial = false
      interfaceStore.componentToHighlight = 'General'
      break
    case 5:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsGeneral
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = false
      interfaceStore.componentToHighlight = 'vehicle-address'
      setVehicleConnectedVisible()
      break
    case 6:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsInterface
      tallContent.value = false
      interfaceStore.userHasSeenTutorial = false
      interfaceStore.componentToHighlight = 'Interface'
      break
    case 7:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsJoystick
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = true
      interfaceStore.componentToHighlight = 'Joystick'
      break
    case 8:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsVideo
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = true
      interfaceStore.componentToHighlight = 'Video'
      break
    case 9:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsTelemetry
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = true
      interfaceStore.componentToHighlight = 'Telemetry'
      break
    case 10:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsAlerts
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = false
      interfaceStore.componentToHighlight = 'Alerts'
      break
    case 11:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsDev
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = true
      interfaceStore.isGlassModalAlwaysOnTop = false
      interfaceStore.componentToHighlight = 'Dev'
      break
    case 12:
      interfaceStore.isMainMenuVisible = true
      interfaceStore.mainMenuCurrentStep = 2
      interfaceStore.currentSubMenuName = SubMenuName.settings
      interfaceStore.currentSubMenuComponentName = SubMenuComponentName.SettingsMission
      interfaceStore.userHasSeenTutorial = false
      tallContent.value = false
      interfaceStore.isGlassModalAlwaysOnTop = false
      interfaceStore.componentToHighlight = 'Mission'
      break
    case 13:
      interfaceStore.currentSubMenuComponentName = null
      interfaceStore.componentToHighlight = 'none'
      break
    default:
      break
  }
}

const dontShowTutorialAgain = (): void => {
  interfaceStore.userHasSeenTutorial = true
  showTutorial.value = false
  currentTutorialStep.value = 1
  openSnackbar({
    message: t('tutorial.snackbarMessage'),
    variant: 'info',
    closeButton: true,
    duration: 5000,
  })
}

const alwaysShowTutorialOnStartup = (): void => {
  interfaceStore.userHasSeenTutorial = false
  showTutorial.value = true
}

const nextTutorialStep = (): void => {
  if (currentTutorialStep.value === steps.length) {
    dontShowTutorialAgain()
    closeTutorial()
    return
  }
  currentTutorialStep.value++
  handleStepChange(currentTutorialStep.value)
}

const backTutorialStep = (): void => {
  currentTutorialStep.value--
  handleStepChange(currentTutorialStep.value)
}

const closeTutorial = (): void => {
  showTutorial.value = false
  interfaceStore.componentToHighlight = 'none'
  interfaceStore.userHasSeenTutorial = true
  interfaceStore.isTutorialVisible = false
}

const setVehicleConnectedVisible = (): void => {
  setTimeout(() => {
    isVehicleConnectedVisible.value = true
  }, 900)
}

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.shiftKey && event.key === 'Enter' && showTutorial.value) {
    backTutorialStep()
  } else if (event.key === 'Enter' && showTutorial.value) {
    nextTutorialStep()
  }
}

watch(
  () => interfaceStore.isTutorialVisible,
  (val) => {
    showTutorial.value = val
  }
)

watch(showTutorial, (newVal) => {
  interfaceStore.isTutorialVisible = newVal
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  handleStepChange(currentTutorialStep.value)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
<style>
.custom-timeline .v-timeline-divider__after {
  background-color: #ffffff44;
}
.custom-timeline .v-timeline-divider__before {
  background-color: #ffffff44;
}

@keyframes rotateAndRipple {
  100% {
    transform: rotate(720deg);
  }
}

@keyframes rippleEffect {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
}

.rotate-and-ripple {
  position: relative;
  animation: rotateAndRipple 1.2s ease-in-out forwards;
}

.ripple {
  position: relative;
  animation: ripple 1.2s ease-in-out forwards;
}

.ripple::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  animation: rippleEffect 1s ease-out forwards;
  animation-delay: 1s;
  pointer-events: none;
}
</style>
