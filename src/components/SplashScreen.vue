<template>
  <div>
    <img
      class="fixed w-[100vw] h-[100vh] top-0 left-0 z-[9990] filter brightness-[80%]"
      :src="splashBackground"
      alt="Background"
    />
    <div class="absolute bottom-[5vh] right-[11%] opacity-70 animate-left-slow" style="z-index: 9991">
      <img class="w-[40px] contrast-100 brightness-0" :src="fish" alt="Fish" />
    </div>
    <div class="absolute bottom-[8vh] right-[17%] opacity-70 animate-left" style="z-index: 9991">
      <img class="w-[60px] contrast-100 brightness-0" :src="fish" alt="Fish" />
    </div>
    <div class="absolute bottom-[10vh] right-[24%] opacity-70 animate-left-fast" style="z-index: 9991">
      <img class="w-[60px] contrast-100 brightness-0" :src="fish" alt="Fish" />
    </div>
    <div class="absolute bottom-[9vh] right-[22%] opacity-70 animate-left-slow" style="z-index: 9991">
      <img class="w-[60px] contrast-100 brightness-0" :src="fish" alt="Fish" />
    </div>
    <div class="absolute bottom-[4vh] right-[5%] opacity-70 animate-left" style="z-index: 9991">
      <img class="w-[30px] contrast-100 brightness-0" :src="fish" alt="Fish" />
    </div>
    <div class="absolute bottom-[6vh] right-[5%] opacity-70 animate-left-fast" style="z-index: 9991">
      <img class="w-[30px] contrast-100 brightness-0" :src="fish" alt="Fish" />
    </div>

    <div v-if="isDecember()" id="tether-animation">
      <div class="absolute top-[30vh] right-[-55px] animate-left-down-fast" style="z-index: 9991">
        <img class="wiggle w-[40px] opacity-60" :src="gifts" alt="tether-to-gift" />
      </div>
      <div class="absolute top-[33vh] right-[-20px] animate-left-down-fast" style="z-index: 9990">
        <img class="w-[60px] rotate-[-15deg]" :src="tetherXmas" alt="tether-to-gift" />
      </div>
      <div class="absolute top-[31.5vh] right-0 animate-left-down-fast" style="z-index: 9991">
        <img
          class="w-[70px] scale-x-[-1] scale-y-[-1] rotate-[15deg] contrast-100 brightness-0"
          :src="xmasTree"
          alt="christmas-tree"
        />
      </div>
      <div class="absolute top-[35vh] right-[60px] animate-left-down-fast" style="z-index: 9990">
        <img class="w-[110px]" :src="tetherXmas" alt="tether-to-tree" />
      </div>
      <div class="absolute top-[35vh] right-[8%] animate-left-down-fast" style="z-index: 9990">
        <img class="w-[60px] opacity-70 rotate-[-10deg]" :src="rovSide" alt="Fish" />
      </div>
      <div class="absolute top-[37vh] right-[4%] animate-left-down-faster" style="z-index: 9990">
        <img class="w-[30px] opacity-70 rotate-[-10deg]" :src="rovSide" alt="Fish" />
      </div>
      <div class="absolute top-[39vh] right-[2%] animate-left-down-faster2" style="z-index: 9990">
        <img class="w-[35px] opacity-70 rotate-[-10deg]" :src="rovSide" alt="Fish" />
      </div>
    </div>
    <div
      class="fixed w-[70vw] h-[55vh] top-1/2 left-1/2 rounded-[20px] transform -translate-x-1/2 -translate-y-1/2 z-[9992]"
      :style="[interfaceStore.globalGlassMenuStyles, { border: '1px solid #ffffff55' }]"
    >
      <div
        class="relative flex flex-col w-full h-[80%] rounded-tr-[20px] rounded-tl-[20px] items-center justify-center elevation-7 border-b-[1px] border-[#ffffff33] bg-[#FFFFFF11] px-8"
      >
        <div class="relative h-[55%] -ml-[1vw] z-[9993] object-contain brightness-125">
          <img :src="cockpitLogoName" class="h-full" alt="Cockpit Logo" />
          <img
            v-if="!isElectron()"
            :src="lite"
            class="w-[16vh] absolute right-8 -bottom-12 rotate-[-20deg]"
            alt="Cockpit-lite"
          />
        </div>
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
      <img class="w-[130px]" style="margin-bottom: -130px" :src="isDecember() ? blueROVXmas : blueROV" alt="blueROV" />
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
import { getMonth } from 'date-fns'

import { useAppInterfaceStore } from '@/stores/appInterface'

import blueRoboticsWhiteNameLogo from '../assets/blue-robotics-white-name-logo.png'
import blueROV from '../assets/blueROV-front.png'
import blueROVXmas from '../assets/blueROV-front-santa-hat.png'
import rovSide from '../assets/blueROV-side-dark.png'
import cockpitLogoName from '../assets/cockpit-name-logo.png'
import fish from '../assets/fish-transparent.png'
import gifts from '../assets/gifts.png'
import lite from '../assets/lite.png'
import xmasTree from '../assets/pulling-xmas-tree.gif'
import splashBackground from '../assets/splash-background.png'
import tether from '../assets/tether.png'
import tetherXmas from '../assets/tether-xmas.png'

const interfaceStore = useAppInterfaceStore()
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

const isDecember = (): boolean => getMonth(new Date()) === 11

import { useFullscreen } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { isElectron } from '@/libs/utils'

const { t, tm } = useI18n()
const randomLightHeartedMessage = ref<string>('')
let timerId: ReturnType<typeof setTimeout>

const getStartupMessages = (): string[] => {
  const messages = tm('splash.messages')
  return Array.isArray(messages) ? messages : []
}

const remainingMessages = ref<string[]>([...getStartupMessages()])

const scheduleNextMessage = (): void => {
  const randomIndex = Math.floor(Math.random() * remainingMessages.value.length)
  const delay = Math.random() * 5000 + 3000

  if (remainingMessages.value.length === 0) {
    remainingMessages.value = [...getStartupMessages()]
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

.animate-left-slow {
  animation: left 40s linear forwards;
}

.animate-left-fast {
  animation: left 20s linear forwards;
}

@keyframes leftDown {
  from {
    transform: translate(0, 0);
  }
  to {
    transform: translate(-20vw, 20vh);
  }
}

@keyframes leftDown2 {
  from {
    transform: translate(0, 0);
  }
  to {
    transform: translate(-20vw, 5vh);
  }
}

.animate-left-down-faster {
  animation: leftDown 20s linear forwards;
}

.animate-left-down-faster2 {
  animation: leftDown2 24s linear forwards;
}

.animate-left-down-fast {
  animation: leftDown 40s linear forwards;
}

@keyframes ascend {
  from {
    transform: translateY(calc(0 + 150px));
  }
  to {
    transform: translateY(-350px);
  }
}

.wiggle {
  animation: wiggle 8s ease-in-out infinite;
  transform-origin: 10% 50%;
}

@keyframes wiggle {
  0% {
    transform: rotate(0deg);
  }
  8% {
    transform: rotate(-1deg);
  }
  18% {
    transform: rotate(2deg);
  }
  28% {
    transform: rotate(-3deg);
  }
  42% {
    transform: rotate(1deg);
  }
  57% {
    transform: rotate(-2deg);
  }
  72% {
    transform: rotate(1deg);
  }
  87% {
    transform: rotate(-1deg);
  }
  100% {
    transform: rotate(0deg);
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
