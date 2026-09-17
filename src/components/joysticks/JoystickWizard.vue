<template>
  <GlassModal
    :is-visible="true"
    class="px-5 pt-4 pb-3"
    draggable
    storage-key="cockpit-joystick-wizard-modal"
    is-persistent
    no-close-on-outside-click
  >
    <div class="w-[600px] flex flex-col">
      <div class="relative flex items-center justify-center w-full pb-1">
        <p class="text-h6 text-center px-10">{{ wizard.step.value.title }}</p>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          class="absolute -right-2 text-sm"
          aria-label="Close the joystick wizard"
          @click="wizard.close()"
        />
      </div>

      <div class="w-full max-h-[60vh] overflow-y-auto">
        <div class="flex flex-col justify-center min-h-[300px] py-2">
          <JoystickWizardReview
            v-if="wizard.step.value.kind === 'review' && wizard.controllerIssue.value === 'none'"
            :rows="wizard.reviewRows.value"
            :live-axes="wizard.liveAxes.value"
            :live-buttons="wizard.liveButtons.value"
          />
          <JoystickWizardStepFrame
            v-else
            :content="wizard.step.value.content"
            :opposite="wizard.controllerIssue.value === 'none' ? wizard.step.value.opposite : controllerIssueMessage"
            :active="wizard.controllerIssue.value === 'none'"
          >
            <div v-if="wizard.controllerIssue.value !== 'none'" class="flex flex-col items-center w-full mb-[10px]">
              <div
                v-if="wizard.connectedJoystickNames.value.length > 0"
                class="flex flex-col w-[400px] bg-[#C2410C44] rounded-[8px] border-[1px] border-[#F9731666] elevation-1 items-center gap-y-1 p-3"
              >
                <p class="text-center font-bold">Controllers connected</p>
                <p
                  v-for="(name, index) in wizard.connectedJoystickNames.value"
                  :key="`${name}-${index}`"
                  class="text-center"
                >
                  <v-icon class="mr-3 -mt-[1px]">mdi-controller</v-icon>{{ name }}
                </p>
              </div>
            </div>
            <JoystickWizardStepBody v-else :wizard="wizard" />
          </JoystickWizardStepFrame>
        </div>
      </div>

      <JoystickWizardSaveDialog
        v-if="wizard.isSaveDialogOpen.value"
        :default-name="wizard.defaultProfileName.value"
        :profiles="wizard.profileOptions.value"
        @save-new="wizard.saveAsNewProfile($event)"
        @replace="wizard.saveOverProfile($event)"
        @discard="wizard.discardMapping()"
        @dismiss="wizard.dismissSaveDialog()"
      />

      <v-divider />
      <div class="flex justify-between items-center w-full pt-3">
        <v-btn v-if="wizard.canGoBack.value" variant="text" size="small" @click="wizard.back()">Previous</v-btn>
        <v-spacer />
        <div class="flex items-center gap-x-10">
          <v-btn v-if="wizard.canSkipToReview.value" variant="text" size="small" @click="wizard.skipToReview()">
            Skip to review
          </v-btn>
          <v-btn
            v-if="wizard.step.value.kind === 'intro'"
            class="blink"
            variant="text"
            size="small"
            :disabled="wizard.controllerIssue.value !== 'none'"
            @click="wizard.next()"
          >
            Press start
          </v-btn>
          <template v-else-if="wizard.step.value.kind === 'review'">
            <v-btn variant="text" size="small" @click="wizard.restart()">Restart</v-btn>
            <v-btn class="bg-[#FFFFFF33]" variant="flat" size="small" @click="wizard.save()">Save mapping</v-btn>
          </template>
          <v-btn
            v-else-if="wizard.step.value.kind !== 'question'"
            variant="flat"
            size="small"
            class="bg-[#FFFFFF33]"
            :disabled="!wizard.canAdvance.value"
            @click="wizard.next()"
          >
            {{ wizard.advanceLabel.value }}
          </v-btn>
        </div>
      </div>
    </div>
  </GlassModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import GlassModal from '@/components/GlassModal.vue'
import JoystickWizardReview from '@/components/joysticks/JoystickWizardReview.vue'
import JoystickWizardSaveDialog from '@/components/joysticks/JoystickWizardSaveDialog.vue'
import JoystickWizardStepBody from '@/components/joysticks/JoystickWizardStepBody.vue'
import JoystickWizardStepFrame from '@/components/joysticks/JoystickWizardStepFrame.vue'
import { useJoystickWizard } from '@/composables/joystick/useJoystickWizard'

const wizard = useJoystickWizard()

const controllerIssueMessage = computed(() => {
  if (wizard.controllerIssue.value === 'missing') {
    return 'No controller is responding. Connect one and move a stick or press a button so the browser picks it up.'
  }
  return 'More than one controller is connected. Unplug the extras so inputs are not mixed up, and the wizard carries on.'
})
</script>

<style scoped>
.blink {
  animation: blink 2s ease-in-out infinite;
}

@keyframes blink {
  50% {
    opacity: 0.35;
  }
}
</style>
