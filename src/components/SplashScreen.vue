<template>
  <div>
    <img
      class="fixed w-[100vw] h-[100vh] top-0 left-0 z-[9990] filter brightness-[80%]"
      :src="splashBackground"
      alt="Background"
    />
    <div id="tether-animation">
      <div
        class="fixed bg-yellow-400 opacity-50 animate-tether-grow"
        style="right: calc(18% + 15px); top: -130px; width: 1px; height: 150px; z-index: 9991"
      ></div>
      <div class="absolute top-0 right-[18%] opacity-60 animate-descend" style="z-index: 9991">
        <img class="w-[40px]" :src="spool" alt="Spool" />
      </div>
      <div class="absolute top-[5vh] right-[11%] opacity-90 animate-left" style="z-index: 9991">
        <img class="w-[60px]" :src="fish" alt="Fish" />
      </div>
    </div>
    <div
      class="fixed w-[70vw] h-[55vh] top-1/2 left-1/2 rounded-[20px] transform -translate-x-1/2 -translate-y-1/2 z-[9992]"
      :style="[interfaceStore.globalGlassMenuStyles, { border: '1px solid #ffffff55' }]"
    >
      <div
        class="relative flex flex-col w-full h-[80%] rounded-tr-[20px] rounded-tl-[20px] items-center justify-center elevation-7 border-b-[1px] border-[#ffffff33] bg-[#FFFFFF11] px-8"
      >
        <img
          class="h-[55%] -ml-[1vw] z-[9993] object-contain brightness-125"
          :src="cockpitLogoName"
          alt="Cockpit Logo"
        />
        <img
          class="absolute top-[2vh] left-[2vh] w-[15%] z-[9993]"
          :src="blueRoboticsWhiteNameLogo"
          alt="Blue Robotics Logo"
        />
      </div>

      <div class="flex flex-col w-full h-[20%] items-center justify-center text-center">
        <p class="text-[1.7vw]">{{ randomLightHeartedMessage }}</p>
      </div>
    </div>
    <div class="absolute bottom-0 left-[280px] animate-ascend" style="z-index: 9991">
      <img class="w-[130px]" style="margin-bottom: -130px" :src="blueROV" alt="blueROV" />
    </div>
    <div class="absolute left-[180px] mb-[-70px] opacity-50 brightness-50 animate-tether-ascend" style="z-index: 9990">
      <img
        class="w-[440px] -translate-x-1/2 rotate-[-15deg]"
        style="margin-bottom: -290px"
        :src="tether"
        alt="Tether"
      />
    </div>
    <div class="fixed top-4 right-4 z-[9993]">
      <button
        class="bg-[#FFFFFF11] text-white p-1 rounded-full elevation-1 focus:outline-none"
        @click="interfaceStore.showSplashScreen = false"
      >
        <v-icon icon="mdi-close" class="text-2xl -mt-[3px] -mr-[1px]" />
      </button>
    </div>
    <div class="fixed bottom-4 right-4 z-[9993]">
      <button
        class="bg-[#FFFFFF11] text-white p-1 rounded-full elevation-3 focus:outline-none"
        @click="toggleFullscreen"
      >
        <v-icon :icon="isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'" class="text-2xl -mt-[3px] -mr-[1px]" />
      </button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useAppInterfaceStore } from '@/stores/appInterface'

import blueRoboticsWhiteNameLogo from '../assets/blue-robotics-white-name-logo.png'
import blueROV from '../assets/blueROV-front.png'
import cockpitLogoName from '../assets/cockpit-name-logo.png'
import fish from '../assets/fish-transparent.png'
import splashBackground from '../assets/splash-background.png'
import spool from '../assets/spool.gif'
import tether from '../assets/tether.png'

const interfaceStore = useAppInterfaceStore()
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

import { useFullscreen } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const randomLightHeartedMessage = ref<string>('')
let timerId: ReturnType<typeof setTimeout>

const startupLightHeartedMessages: string[] = [
  'Distributing dolphins for sonar translations...',
  'Observing octopuses to optimize dark mode...',
  'Persuading Poseidon to trade us his trident...',
  'Sailing the seas, in sync with the breeze...',
  'Jiggling jellyfish to frost up the UI...',
  'Corralling coral for calibration...',
  'Languishing in life-jackets...',
  'Salvaging shipwrecks...',
  'Searching for Nemo...',
  'Singing with whales...',
  'Tuning harps for carp...',
  'Stargazing with starfish...',
  'Recharging electric eels...',
  'Swaying at the seaweed disco...',
  'Fencing in the swordfish showdown...',
  'Assembling AUVs into a single-file line...',
  'Polishing portholes for crystal-clear viewports...',
  'Convincing crabs to stop double-clicking everything...',
  'Syncing compass with the stars (hold still, Orion)...',
  'Kowtowing to kelp for a greener UI theme...',
  'Warming up thrusters — and the coffee machine...',
  'Updating barnacle firmware — this might tickle...',
  'Deploying rubber ducks for safety certification...',
  'Filling ballast tanks with fresh ideas...',
  'Mapping ocean puns… depth-level humor detected...',
  'Rendering waves pixel by pixel — surf’s almost up...',
  'Teaching seagulls the latest hover gestures...',
  'Checking tide tables to schedule snack breaks...',
  'Swapping batteries in the sea turtles (just kidding)...',
  'Dusting off code gremlins  —  please keep arms inside the Cockpit...',
  'Aligning gyros — because spin is only fun on dance floors...',
]

const remainingMessages = ref<string[]>([...startupLightHeartedMessages])

const scheduleNextMessage = (): void => {
  const randomIndex = Math.floor(Math.random() * remainingMessages.value.length)
  const delay = Math.random() * 5000 + 3000

  if (remainingMessages.value.length === 0) {
    remainingMessages.value = [...startupLightHeartedMessages]
  }
  randomLightHeartedMessage.value = remainingMessages.value.splice(randomIndex, 1)[0]
  timerId = setTimeout(scheduleNextMessage, delay)
}

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    interfaceStore.showSplashScreen = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  scheduleNextMessage()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  clearTimeout(timerId)
})
</script>
<style scoped>
@keyframes descend {
  from {
    transform: translateY(-150px);
  }
  to {
    transform: translateY(calc(100vh + 150px));
  }
}
.animate-descend {
  top: 0;
  animation: descend 40s linear forwards;
}

@keyframes tetherGrow {
  from {
    height: 0;
  }
  /* 100vh + 300px = total drop from -150px → (100vh +150px) */
  to {
    height: calc(100vh + 300px);
  }
}
.animate-tether-grow {
  animation: tetherGrow 40s linear forwards;
}

@keyframes left {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-10vw);
  }
}
.animate-left {
  animation: left 30s linear forwards;
}

@keyframes ascend {
  from {
    transform: translateY(calc(0 + 150px));
  }
  to {
    transform: translateY(-350px);
  }
}
.animate-ascend {
  bottom: 0;
  animation: ascend 25s ease-in-out forwards;
  animation-delay: 5s;
}

@keyframes ascend {
  0% {
    transform: translate(0, 50px);
  }
  20% {
    transform: rotate(-6deg);
  }
  25% {
    transform: translate(-8px, -100px) rotate(6deg);
  }
  40% {
    transform: translate(6px, -170px);
  }

  100% {
    transform: translate(0, -400px);
  }
}

@keyframes tetherAscend {
  0% {
    transform: translate(0, 50px);
  }
  20% {
    transform: rotate(-6deg);
  }
  25% {
    transform: translate(-8px, -100px);
  }
  40% {
    transform: translate(6px, -170px) rotate(-6deg);
  }

  100% {
    transform: translate(20px, -350px) rotate(-26deg) scaleY(3);
  }
}

.animate-tether-ascend {
  bottom: 0;
  animation: tetherAscend 25s ease-in-out forwards;
  animation-delay: 5s;
}
</style>
