<template>
  <div class="fixed inset-0 z-splash-screen">
    <img
      class="fixed inset-0 w-full h-full object-cover object-center z-[9990] filter brightness-[80%]"
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
      <div class="absolute top-[10vh] right-[-55px]">
        <div class="relative top-[3vh] right-[35px] animate-left-down-fast" style="z-index: 9990">
          <img class="w-[60px] rotate-[-15deg]" :src="tetherXmas" alt="tether-to-gift" />
        </div>
        <div class="relative top-[5.4vh] right-[-125px] animate-left-down-fast-xmas-tree" style="z-index: 9991">
          <img
            class="w-[70px] scale-x-[-1] scale-y-[-1] rotate-[160deg] contrast-100 brightness-0"
            :src="xmasTree"
            alt="christmas-tree"
          />
        </div>
        <div class="relative top-[4.9vh] right-[-35px] animate-left-down-fast" style="z-index: 9990">
          <img class="w-[110px] rotate-[-15deg]" :src="tetherXmas" alt="tether-to-tree" />
        </div>
        <div class="relative top-[5vh] right-[8%] animate-left-down-fast" style="z-index: 9990">
          <img class="w-[60px] opacity-70 rotate-[-10deg]" :src="rovSide" alt="Rov" />
        </div>
        <div class="relative top-[7vh] right-[2%] animate-left-down-faster" style="z-index: 9990">
          <img class="w-[30px] opacity-70 rotate-[-10deg]" :src="rovSide" alt="Rov" />
        </div>
        <div class="relative top-[9vh] right-[1%] animate-left-down-faster2" style="z-index: 9990">
          <img class="w-[35px] opacity-70 rotate-[-10deg]" :src="rovSide" alt="Rov" />
        </div>
      </div>
    </div>
    <div
      class="fixed top-1/2 left-1/2 rounded-[20px] transform -translate-x-1/2 -translate-y-1/2 z-[9992]"
      :style="[
        interfaceStore.globalGlassMenuStyles,
        {
          border: '1px solid #ffffff55',
          width: 'min(70vw, 90vw)',
          maxWidth: '1200px',
          aspectRatio: '70 / 32',
          height: 'auto',
          maxHeight: '90vh',
        },
      ]"
    >
      <div
        class="relative flex flex-col w-full h-[80%] rounded-tr-[20px] rounded-tl-[20px] items-center justify-center elevation-7 border-b-[1px] border-[#ffffff33] bg-[#FFFFFF11] px-[8%] py-[2%]"
      >
        <div class="relative h-[55%] -ml-[1vw] z-[9993] object-contain brightness-125">
          <img :src="cockpitLogoName" class="h-full" alt="Cockpit Logo" />
          <img
            v-if="!isElectron()"
            :src="lite"
            class="w-[16%] absolute right-[3%] -bottom-[22%] rotate-[-20deg]"
            alt="Cockpit-lite"
          />
        </div>
        <img
          class="absolute top-[5%] left-[2%] w-[15%] z-[9993]"
          :src="blueRoboticsWhiteNameLogo"
          alt="Blue Robotics Logo"
        />
      </div>

      <div
        class="flex flex-col w-full h-[20%] items-center justify-center text-center overflow-hidden px-6"
        style="container-type: size"
      >
        <p class="max-w-full whitespace-nowrap text-ellipsis overflow-hidden" style="font-size: 30cqh">
          {{ randomLightHeartedMessage }}
        </p>
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

import blueRoboticsWhiteNameLogo from '../assets/blue-robotics-white-name-logo.avif'
import blueROV from '../assets/blueROV-front.avif'
import blueROVXmas from '../assets/blueROV-front-santa-hat.avif'
import rovSide from '../assets/blueROV-side-dark.avif'
import cockpitLogoName from '../assets/cockpit-name-logo.avif'
import fish from '../assets/fish-transparent.avif'
import lite from '../assets/lite.avif'
import xmasTree from '../assets/pulling-xmas-tree.gif'
import splashBackground from '../assets/splash-background.avif'
import tether from '../assets/tether.avif'
import tetherXmas from '../assets/tether-xmas.avif'

const interfaceStore = useAppInterfaceStore()
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

const isDecember = (): boolean => getMonth(new Date()) === 11

import { useFullscreen } from '@vueuse/core'
import { t } from 'ttag'
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { isElectron } from '@/libs/utils'

const randomLightHeartedMessage = ref<string>('')
let timerId: ReturnType<typeof setTimeout>

const startupLightHeartedMessages: string[] = [
  t`Distributing dolphins for sonar translations...`,
  t`Observing octopuses to optimize dark mode...`,
  t`Persuading Poseidon to trade us his trident...`,
  t`Sailing the seas, in sync with the breeze...`,
  t`Jiggling jellyfish to frost up the UI...`,
  t`Corralling coral for calibration...`,
  t`Languishing in life-jackets...`,
  t`Salvaging shipwrecks...`,
  t`Searching for Nemo...`,
  t`Singing with whales...`,
  t`Tuning harps for carp...`,
  t`Stargazing with starfish...`,
  t`Recharging electric eels...`,
  t`Swaying at the seaweed disco...`,
  t`Fencing in the swordfish showdown...`,
  t`Assembling AUVs into a single-file line...`,
  t`Polishing portholes for crystal-clear viewports...`,
  t`Convincing crabs to stop double-clicking everything...`,
  t`Syncing compass with the stars (hold still, Orion)...`,
  t`Kowtowing to kelp for a greener UI theme...`,
  t`Warming up thrusters — and the coffee machine...`,
  t`Updating barnacle firmware — this might tickle...`,
  t`Deploying rubber ducks for safety certification...`,
  t`Filling ballast tanks with fresh ideas...`,
  t`Mapping ocean puns… depth-level humor detected...`,
  t`Rendering waves pixel by pixel — surf’s almost up...`,
  t`Teaching seagulls the latest hover gestures...`,
  t`Checking tide tables to schedule snack breaks...`,
  t`Swapping batteries in the sea turtles (just kidding)...`,
  t`Dusting off code gremlins  —  please keep arms inside the Cockpit...`,
  t`Aligning gyros — because spin is only fun on dance floors...`,
  t`Bribing barracudas with breadcrumbs for better bandwidth...`,
  t`Untangling anchor chains from last season’s memes...`,
  t`Coaxing clownfish into calibrating the color palette...`,
  t`Negotiating right-of-way with a pod of dolphins...`,
  t`Buffing the hull until the pixels shine...`,
  t`Herding manta rays into a tidy formation...`,
  t`Reticulating ROV tethers...`,
  t`Consulting the kraken on latency budgets...`,
  t`Waxing propellers for that extra knot of speed...`,
  t`Debugging bubbles in the ballast logic...`,
  t`Interviewing pilot whales for the beta program...`,
  t`Untying knots in the mooring lines — figuratively and literally...`,
  t`Charting a course around a very stubborn sandbar...`,
  t`Feeding the sonar pings their morning coffee...`,
  t`Asking the tide to hold still for a photo...`,
  t`Recalibrating the compass after a magnetic seahorse incident...`,
  t`Sweet-talking sea urchins into a firmware update...`,
  t`Counting bubbles for the pressure sensor...`,
  t`Teaching the autopilot to parallel park a submarine...`,
  t`Synchronizing fins with the current build...`,
  t`Politely asking the current to change direction...`,
  t`Rehearsing sea shanties for the release notes...`,
  t`Sorting seashells by checksum...`,
  t`Greasing gimbals — smooth sailing ahead...`,
  t`Untangling kelp from the camera gimbal...`,
  t`Waiting for the hermit crab to approve the deploy...`,
  t`Pressure-testing the pun database...`,
  t`Refilling the rubber duck armada...`,
  t`Convincing the tide pool to run one more test...`,
  t`Spooling up the winch — steady as she goes...`,
  t`Asking a school of fish to vote on the new icon...`,
  t`Translating sonar echoes into whale-approved subtitles...`,
  t`Hiring an octopus to handle eight tasks at once...`,
  t`Checking whether the shrimp remembered the Wi-Fi password...`,
  t`Blinking the lighthouse in binary...`,
  t`Giving the buoys a quick buoyancy pep talk...`,
  t`Asking the squid to refill the printer ink...`,
  t`Organizing plankton into scalable clusters...`,
  t`Tuning the hydrophone to the ocean’s greatest hits...`,
  t`Teaching lobsters to use version control...`,
  t`Plotting waypoints around suspiciously large puddles...`,
  t`Checking the depth gauge for deep thoughts...`,
  t`Rerouting currents around scheduled maintenance...`,
  t`Training seals to stamp the release paperwork...`,
  t`Cleaning the periscope with a microfiber manta ray...`,
  t`Converting nautical miles into nautical smiles...`,
  t`Reminding the thrusters which way is forward...`,
  t`Compiling coral reefs with extra branches...`,
  t`Requesting navigation advice from passing mermaids...`,
  t`Clearing prop wash from the browser cache...`,
  t`Packing telemetry into watertight containers...`,
  t`Asking sea cucumbers to review the accessibility settings...`,
  t`Scrubbing the deck and the debug logs...`,
  t`Teaching jellyfish to illuminate status indicators...`,
  t`Checking GPS satellites for signs of seasickness...`,
  t`Securing every hatch except the escape key...`,
  t`Benchmarking barnacles for attachment speed...`,
  t`Updating the navigation chart with here-be-dragons warnings...`,
  t`Asking a blue whale to lower the volume...`,
  t`Loading the mission one fathom at a time...`,
  t`Sending the dock a polite connection request...`,
  t`Vacuuming sand from the ocean floor cache...`,
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

@keyframes leftDownXmas {
  from {
    transform: translate(0, 0);
  }
  to {
    transform: translate(-20vw, 20vh) rotate(10deg);
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

.animate-left-down-fast-xmas-tree {
  animation: leftDownXmas 40s linear forwards;
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
  transform-origin: 0% 100%;
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
