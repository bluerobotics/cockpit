<template>
  <BaseConfigurationView>
    <template #title>Joystick configuration </template>
    <template #content>
      <div
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[88vw] max-h-[95vh]' : 'max-w-[880px] max-h-[80vh]'"
        class="overflow-y-auto"
      >
        <div
          v-if="controllerStore.joysticks && !controllerStore.joysticks.size"
          class="px-6 pb-2 flex-centered flex-column position-relative"
          :class="interfaceStore.isOnSmallScreen ? 'pt-1' : 'pt-3'"
        >
          <p class="text-base text-center font-bold mt-6 mb-4">Connect a joystick and press any key.</p>
        </div>
        <div v-else>
          <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen" compact>
            <template #title>General settings</template>
            <template #info>
              <div class="flex flex-col items-start px-5 font-medium">
                <li>
                  View and configure your controller button and joystick behaviors, in a diagram and/or table display.
                </li>
                <li>
                  Button presses and joystick movements are highlighted, and can be assigned to vehicle functions or
                  Cockpit Actions.
                </li>
                <li>Advanced configuration is available for setting axis limits.</li>
              </div>
            </template>
            <template v-if="showJoystickWarningMessage" #warning>
              <div class="text-center text-yellow-200">
                <p class="font-semibold">System update is recommended</p>
                <br />
                <p class="font-medium">
                  It seems like you're running versions of Mavlink2Rest (BlueOS) and/or ArduPilot that do not support
                  the extended MAVLink MANUAL_CONTROL message. We strongly suggest upgrading both so you can have
                  support for additional buttons and axes on the joystick. This is especially important if you sometimes
                  use other control station software, like QGroundControl, as Cockpit can preferentially use the
                  extended buttons to reduce configuration clashes. We recommend using BlueOS &ge; 1.2.0, and &ge;
                  version 4.1.2 for ArduPilot-based autopilot firmware.
                </p>
                <p />
              </div>
            </template>
            <template #content>
              <div class="flex flex-col items-center h-[200px] overflow-auto">
                <div class="flex flex-col items-center">
                  <div
                    v-if="
                      controllerStore.availableButtonActions.every((b) => b.protocol === JoystickProtocol.CockpitAction)
                    "
                    class="flex flex-col items-center px-5 py-3 m-5 font-bold border rounded-md text-blue-grey-darken-1 bg-blue-lighten-5 w-fit"
                  >
                    <p>Could not stablish communication with the vehicle.</p>
                    <p>
                      Button functions will appear as numbers. If connection is restablished, function names will
                      appear.
                    </p>
                  </div>

                  <div v-if="availableModifierKeys" class="flex flex-row items-center mt-2 mb-3">
                    <v-combobox
                      v-model="vehicleTypesAssignedToCurrentProfile"
                      :items="availableVehicleTypes"
                      label="Vehicle types that use this profile by default:"
                      chips
                      multiple
                      density="compact"
                      hide-details
                      variant="outlined"
                      class="w-10/12 scale-90"
                      theme="dark"
                    />

                    <v-switch
                      v-model="controllerStore.holdLastInputWhenWindowHidden"
                      label="Hold last joystick input when window is hidden (tab changed or window minimized)"
                      class="scale-[85%] -mb-4"
                    />
                  </div>
                  <div class="flex w-full justify-center mb-2">
                    <v-btn
                      v-for="functionMapping in controllerStore.protocolMappings"
                      :key="functionMapping.name"
                      class="m-1 text-md bg-[#FFFFFF23]"
                      :class="{
                        'bg-[#FFFFFF43]': controllerStore.protocolMapping.name === functionMapping.name,
                        'text-sm': interfaceStore.isOnSmallScreen,
                      }"
                      @click="controllerStore.loadProtocolMapping(functionMapping)"
                    >
                      {{ functionMapping.name }}
                    </v-btn>
                  </div>
                </div>
                <div class="flex w-full h-[47px]">
                  <v-tabs
                    v-model="currentTabVIew"
                    class="w-full h-full my-3 rounded-lg elevation-2 bg-[#FFFFFF23]"
                    theme="dark"
                  >
                    <v-tab value="svg">Visual</v-tab>
                    <v-tab value="table">Table</v-tab>
                    <div class="flex w-full h-[46px] justify-end align-center mr-[5px]">
                      <div />
                      <div class="flex justify-between mr-5">
                        <div
                          class="flex border-[1px] border-[#FFFFFF22] rounded-md elevation-1"
                          :style="interfaceStore.globalGlassMenuStyles"
                        >
                          <v-btn
                            v-for="button in availableModifierKeys"
                            :key="button.id"
                            variant="text"
                            size="x-small"
                            class="py-0"
                            :class="[
                              currentModifierKey.id !== button.id ? 'text-[#FFFFFF73]' : 'bg-[#FFFFFF22]',
                              {
                                'text-sm': interfaceStore.isOnSmallScreen,
                              },
                            ]"
                            @click="changeModifierKeyTab(button.id as CockpitModifierKeyOption)"
                          >
                            {{ button.name }}
                          </v-btn>
                        </div>
                      </div>
                      <div
                        class="flex border-[1px] border-[#FFFFFF22] rounded-md elevation-1 mb-[2px] mr-[4px]"
                        :style="interfaceStore.globalGlassMenuStyles"
                      >
                        <v-tooltip location="top" text="Download joystick mappings">
                          <template #activator="{ props }">
                            <v-btn
                              v-bind="props"
                              icon="mdi-tray-arrow-down"
                              variant="text"
                              size="24"
                              class="text-[12px] mx-3 mt-[2px] mb-[1px]"
                              @click="controllerStore.exportFunctionsMapping(controllerStore.protocolMapping)"
                          /></template>
                        </v-tooltip>
                        <v-divider vertical />
                        <v-tooltip location="top" text="Upload joystick mappings">
                          <template #activator="{ props }">
                            <label v-bind="props">
                              <input
                                type="file"
                                accept="application/json"
                                hidden
                                @change="(e) => controllerStore.importFunctionsMapping(e)"
                              />
                              <v-icon class="text-[16px] cursor-pointer mx-3 mt-[1px]">mdi-tray-arrow-up</v-icon>
                            </label>
                          </template>
                        </v-tooltip>
                      </div>
                    </div>
                  </v-tabs>
                </div>
              </div>
              <div v-if="currentTabVIew === 'svg'" class="flex flex-col justify-between mt-5">
                <div
                  v-for="[key, joystick] in controllerStore.joysticks"
                  :key="key"
                  class="w-[95%] h-full flex-centered flex-column position-relative"
                >
                  <p class="text-md font-semibold">{{ joystick.model }} controller</p>
                  <div class="flex items-center gap-2 -mb-4">
                    <v-switch
                      :model-value="!controllerStore.disabledJoysticks.includes(joystick.model)"
                      :label="controllerStore.disabledJoysticks.includes(joystick.model) ? 'Disabled' : 'Enabled'"
                      hide-details
                      class="-mt-2"
                      @update:model-value="toggleJoystickEnabling(joystick.model)"
                    />
                  </div>
                  <div
                    v-if="showJoystickLayout"
                    class="flex flex-col items-center justify-center"
                    :class="interfaceStore.isOnSmallScreen ? 'w-[90%]' : 'w-[80%]'"
                  >
                    <JoystickPS
                      class="w-[100%]"
                      :model="joystick.model"
                      :disabled="controllerStore.disabledJoysticks.includes(joystick.model)"
                      :left-axis-horiz="joystick.state.axes[0]"
                      :left-axis-vert="joystick.state.axes[1]"
                      :right-axis-horiz="joystick.state.axes[2]"
                      :right-axis-vert="joystick.state.axes[3]"
                      :b0="joystick.state.buttons[0]"
                      :b1="joystick.state.buttons[1]"
                      :b2="joystick.state.buttons[2]"
                      :b3="joystick.state.buttons[3]"
                      :b4="joystick.state.buttons[4]"
                      :b5="joystick.state.buttons[5]"
                      :b6="joystick.state.buttons[6]"
                      :b7="joystick.state.buttons[7]"
                      :b8="joystick.state.buttons[8]"
                      :b9="joystick.state.buttons[9]"
                      :b10="joystick.state.buttons[10]"
                      :b11="joystick.state.buttons[11]"
                      :b12="joystick.state.buttons[12]"
                      :b13="joystick.state.buttons[13]"
                      :b14="joystick.state.buttons[14]"
                      :b15="joystick.state.buttons[15]"
                      :b16="joystick.state.buttons[16]"
                      :b17="joystick.state.buttons[17]"
                      :buttons-actions-correspondency="currentButtonActions"
                      @click="(e) => setCurrentInputs(joystick, e)"
                    />
                  </div>
                </div>
              </div>
              <div v-if="currentTabVIew === 'table'" class="flex flex-col justify-between mt-5">
                <div
                  v-for="[key, joystick] in controllerStore.joysticks"
                  :key="key"
                  class="w-full flex-centered flex-column position-relative"
                >
                  <span class="text-lg font-bold w-full text-center">{{ joystick.model }} controller</span>
                  <div class="flex items-center gap-2 -mb-4">
                    <v-switch
                      :model-value="!controllerStore.disabledJoysticks.includes(joystick.model)"
                      :label="controllerStore.disabledJoysticks.includes(joystick.model) ? 'Disabled' : 'Enabled'"
                      hide-details
                      class="-mt-2 -mb-1"
                      @update:model-value="toggleJoystickEnabling(joystick.model)"
                    />
                  </div>
                  <p class="text-start text-sm font-bold w-[93%] mb-1">Axes</p>
                  <v-data-table
                    v-if="controllerStore.joysticks && controllerStore.joysticks.size"
                    :items="tableItems"
                    class="elevation-1 bg-transparent rounded-lg mb-[20px]"
                    theme="dark"
                    no-data-text=""
                    :style="interfaceStore.globalGlassMenuStyles"
                  >
                    <template #headers>
                      <tr>
                        <th class="w-[100px] text-center"><p class="text-[16px] font-bold">Name</p></th>
                        <th class="w-[120px] text-center"><p class="text-[16px] font-bold">Preview</p></th>
                        <th class="w-[50px] text-center"><p class="text-[16px] font-bold">Direction</p></th>
                        <th class="w-[110px] text-center"><p class="text-[16px] font-bold">Min</p></th>
                        <th class="w-[120px] text-center"><p class="text-[16px] font-bold">Axis</p></th>
                        <th class="w-[110px] text-center"><p class="text-[16px] font-bold">Max</p></th>
                      </tr>
                      <p v-if="tableItems.length === 0" class="fixed top-[67%] left-[40%]">
                        Press a key or move an axis
                      </p>
                    </template>
                    <template #item="{ item }">
                      <tr v-if="item.type === 'axis'">
                        <td class="w-[100px] text-center">
                          <div class="flex items-center justify-center gap-x-4">
                            <p>{{ item.type }}</p>
                            <p>{{ item.id }}</p>
                          </div>
                        </td>
                        <td class="w-[120px] text-center">
                          <AxisVisualization
                            v-if="item.type === 'axis' && joystick.state.axes"
                            :raw-value="joystick.state.axes[item.id as JoystickAxis] || 0"
                            :processed-value="scaledAxisValue(joystick, item.id as JoystickAxis)"
                          />
                        </td>
                        <td class="w-[50px] text-center">
                          <v-icon v-if="item.type === 'axis'">
                            {{
                              [JoystickAxis.A0, JoystickAxis.A2].includes(Number(item.id))
                                ? 'mdi-pan-horizontal'
                                : 'mdi-pan-vertical'
                            }}
                          </v-icon>
                        </td>
                        <td class="w-[110px] text-center">
                          <v-text-field
                            v-if="item.type === 'axis'"
                            v-model.number="controllerStore
                              .protocolMapping.axesCorrespondencies[item.id as JoystickAxis].min"
                            type="number"
                            density="compact"
                            variant="plain"
                            hide-details
                            class="ml-4"
                          />
                        </td>
                        <td class="w-[120px] text-center">
                          <v-select
                            v-if="item.type === 'axis'"
                            v-model="controllerStore
                              .protocolMapping.axesCorrespondencies[item.id as JoystickAxis].action"
                            :items="controllerStore.availableAxesActions"
                            item-title="name"
                            hide-details
                            class="mb-2"
                            density="compact"
                            variant="plain"
                            theme="dark"
                            return-object
                          />
                        </td>
                        <td class="w-[110px] text-center">
                          <v-text-field
                            v-if="item.type === 'axis'"
                            v-model.number="controllerStore
                              .protocolMapping.axesCorrespondencies[item.id as JoystickAxis].max"
                            type="number"
                            density="compact"
                            variant="plain"
                            hide-details
                            class="ml-4"
                          />
                        </td>
                      </tr>
                    </template>
                    <template #bottom>
                      <div class="h-[1px]">
                        <v-progress-linear
                          v-if="remappingAxisInput !== false"
                          v-model="remapAxisTimeProgress"
                          color="blue"
                          height="4"
                          striped
                          class="w-[98%]"
                        /></div
                    ></template>
                  </v-data-table>

                  <p class="text-start text-sm font-bold w-[93%] mb-1">Buttons</p>
                  <v-data-table
                    v-if="currentJoystick && currentJoystick?.gamepadToCockpitMap?.buttons"
                    :headers="headers"
                    :items="tableItems"
                    :items-per-page="64"
                    class="elevation-1 bg-transparent rounded-lg mt-2 mb-10"
                    theme="dark"
                    :style="interfaceStore.globalGlassMenuStyles"
                  >
                    <template #headers>
                      <tr>
                        <th class="w-[120px] text-center"><p class="text-[16px] font-bold">Name</p></th>
                        <th class="w-[120px] text-center">
                          <div
                            class="flex justify-center w-full"
                            :class="{ '-mr-3': currentModifierKey.id !== 'regular' }"
                          >
                            <p class="text-[16px] font-bold">Function</p>
                            <p v-if="currentModifierKey.id !== 'regular'" class="text-[10px] text-end ml-2">
                              ({{ currentModifierKey.id }})
                            </p>
                          </div>
                        </th>
                        <th class="w-[150px] text-center"><p class="text-[16px] font-bold">Custom label</p></th>
                        <th class="w-[50px] text-center"><p class="text-[16px] font-bold">Actions</p></th>
                      </tr>
                    </template>
                    <template #item="{ item }">
                      <tr v-if="item.type === 'button'">
                        <td class="w-[120px]">
                          <div
                            class="flex items-center justify-center gap-x-4 rounded-xl"
                            :class="
                                item.type === 'button' && isButtonPressed(item.id as JoystickButton) ? 'bg-[#2c99ce]' : 'bg-transparent'
                              "
                          >
                            <p>{{ item.type }}</p>
                            <p>{{ item.id }}</p>
                          </div>
                        </td>
                        <td class="w-[120px]">
                          <div>
                            <p class="text-center">
                              {{ currentButtonActions[item.id as JoystickButton]?.action.name }}
                            </p>
                          </div>
                        </td>
                        <td class="w-[150px]">
                          <v-text-field
                            v-model="controllerStore.protocolMapping
                              .buttonsCorrespondencies
                              [currentModifierKey.id as CockpitModifierKeyOption][item.id as JoystickButton].label"
                            dense
                            variant="plain"
                            hide-details
                            class="w-full"
                          />
                        </td>
                        <td class="text-center w-[50px]">
                          <v-btn
                            v-tooltip:top="'Unmap'"
                            icon="mdi-delete-circle"
                            variant="text"
                            @click="unbindCurrentInput(item as JoystickButtonInput)"
                          >
                          </v-btn>
                          <v-btn
                            v-tooltip="'Map function to button'"
                            icon="mdi-circle-edit-outline"
                            variant="text"
                            class="text-[16px]"
                            @click="setCurrentInputFromTable(joystick, item as JoystickInput)"
                          >
                          </v-btn>
                        </td>
                      </tr>
                    </template>
                    <template #bottom></template>
                  </v-data-table>
                </div>
              </div>
            </template>
          </ExpansiblePanel>
          <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen" compact>
            <template #title>Axis Calibration</template>
            <template #info>
              <div class="flex flex-col items-start px-5 font-medium">
                <li>Calibrate your joystick to ensure accurate axis inputs.</li>
                <li>
                  Click the button to open the calibration dialog, then follow the instructions to calibrate your
                  joystick axes.
                </li>
              </div>
            </template>
            <template #content>
              <div class="mb-6">
                <JoystickCalibration />
              </div>
            </template>
          </ExpansiblePanel>
        </div>
      </div>
    </template>
  </BaseConfigurationView>
  <teleport to="body">
    <InteractionDialog
      v-show="currentJoystick"
      :show-dialog="inputClickedDialog"
      max-width="auto"
      variant="text-only"
      persistent
    >
      <template #title>
        <div class="flex justify-center w-full font-bold mt-1">Input mapping</div>
      </template>
      <template #content>
        <div class="flex flex-col mb-3" :class="currentAxisInputs.length > 0 ? 'h-[600px]' : 'h-[430px]'">
          <div
            v-for="input in currentButtonInputs"
            :key="input.id"
            class="flex flex-row justify-between w-full h-full align-center gap-x-16"
          >
            <div class="flex flex-col w-[30%] h-full">
              <div class="flex-1"></div>
              <div class="flex-1"></div>
              <div class="flex-1"></div>
              <div class="flex flex-col gap-y-2">
                <v-btn
                  variant="elevated"
                  class="bg-[#FFFFFF33]"
                  @click="updateButtonAction(input, shiftFunction as ProtocolAction)"
                >
                  Assign as Shift
                </v-btn>
                <v-btn
                  variant="elevated"
                  class="bg-[#FFFFFF33]"
                  @click="unbindCurrentInput(input as JoystickButtonInput)"
                >
                  Unmap Input
                </v-btn>
              </div>
              <div class="flex-1"></div>
              <div class="flex flex-col items-start text-sm font-semibold gap-y-1">
                <div class="flex items-center">
                  <img src="@/assets/cockpit-logo.png" class="w-4 h-4 mr-2" alt="Cockpit" />
                  <span>Cockpit Action</span>
                </div>
                <div class="flex items-center">
                  <img src="@/assets/mavlink-logo.png" class="w-4 h-4 mr-2 ml-[1px] mt-[4px]" alt="MAVLink" />
                  <span>MAVLink Manual Control</span>
                </div>
                <div class="flex items-center">
                  <v-icon icon="mdi-database" size="small" class="mr-2" />
                  <span>Data Lake Variable</span>
                </div>
              </div>
            </div>
            <div class="flex flex-col w-[320px] justify-evenly">
              <div class="p-1">
                <v-text-field
                  v-model="searchText"
                  density="compact"
                  variant="outlined"
                  theme="dark"
                  type="text"
                  placeholder="Search actions..."
                  class="mb-1"
                  hide-details
                />
                <div class="h-[360px] p-1 overflow-y-auto">
                  <Button
                    v-for="action in filteredAndSortedJoystickActions"
                    :key="action.name"
                    class="w-full my-1 text-sm hover:bg-slate-700 flex flex-col py-2 relative align-center"
                    :class="{ 'bg-slate-700': currentButtonActions[input.id].action.id == action.id }"
                    @click="updateButtonAction(input, action as ProtocolAction)"
                  >
                    <div class="absolute left-3 top-1/2 -translate-y-1/2">
                      <img
                        v-if="action.protocol === JoystickProtocol.CockpitAction"
                        src="@/assets/cockpit-logo.png"
                        class="w-4 h-4"
                        alt="Cockpit"
                      />
                      <img
                        v-else-if="action.protocol === JoystickProtocol.MAVLinkManualControl"
                        src="@/assets/mavlink-logo.png"
                        class="w-4 h-4 ml-[2px] mt-[3px]"
                        alt="MAVLink"
                      />
                      <v-icon
                        v-else-if="action.protocol === JoystickProtocol.DataLakeVariable"
                        icon="mdi-database"
                        size="small"
                      />
                    </div>
                    <p class="text-center text-xs px-8">
                      {{ action.name }}
                    </p>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <template v-if="currentAxisInputs.length > 0">
            <p class="flex items-center justify-center w-full text-lg font-semibold mt-8">Axis mapping</p>
          </template>
          <div class="flex flex-col items-center justify-between my-2">
            <Transition>
              <p v-if="showAxisRemappingText" class="font-medium">{{ axisRemappingText }}</p>
            </Transition>
            <Transition>
              <v-progress-linear v-if="remappingAxisInput" v-model="remapAxisTimeProgress" />
            </Transition>
          </div>
          <div v-for="input in currentAxisInputs" :key="input.id" class="flex items-center justify-between p-2 mb-1">
            <v-icon class="mr-3">
              {{
                [JoystickAxis.A0, JoystickAxis.A2].includes(Number(input.id))
                  ? 'mdi-pan-horizontal'
                  : 'mdi-pan-vertical'
              }}
            </v-icon>
            <v-text-field
              v-model.number="controllerStore.protocolMapping.axesCorrespondencies[input.id].min"
              class="bg-transparent w-[110px]"
              label="Min"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
            />
            <v-select
              v-model="controllerStore.protocolMapping.axesCorrespondencies[input.id].action"
              :items="controllerStore.availableAxesActions"
              item-title="name"
              hide-details
              density="compact"
              variant="outlined"
              class="bg-transparent w-[120px] mx-2"
              theme="dark"
              return-object
            />
            <v-text-field
              v-model.number="controllerStore.protocolMapping.axesCorrespondencies[input.id].max"
              class="bg-transparent w-[110px]"
              label="Max"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
            />
          </div>
        </div>
      </template>
      <template #actions>
        <div class="flex justify-end w-full">
          <v-btn variant="text" class="m-1" @click="closeInputMappingDialog"> Close </v-btn>
        </div>
      </template>
    </InteractionDialog>
  </teleport>
</template>

<script setup lang="ts">
import semver from 'semver'
import { type Ref, computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import Button from '@/components/Button.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import InteractionDialog from '@/components/InteractionDialog.vue'
import AxisVisualization from '@/components/joysticks/AxisVisualization.vue'
import JoystickCalibration from '@/components/joysticks/JoystickCalibration.vue'
import JoystickPS from '@/components/joysticks/JoystickPS.vue'
import { useSnackbar } from '@/composables/snackbar'
import { getDataLakeVariableInfo } from '@/libs/actions/data-lake'
import { getAllTransformingFunctions } from '@/libs/actions/data-lake-transformations'
import { getArdupilotVersion, getMavlink2RestVersion } from '@/libs/blueos'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { JoystickModel } from '@/libs/joystick/manager'
import { MAVLinkButtonFunction } from '@/libs/joystick/protocols/mavlink-manual-control'
import { modifierKeyActions } from '@/libs/joystick/protocols/other'
import { mavlinkCameraFocusActionId, mavlinkCameraZoomActionId } from '@/libs/joystick/protocols/predefined-resources'
import { scale } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import {
  type Joystick,
  type JoystickInput,
  type ProtocolAction,
  CockpitModifierKeyOption,
  InputType,
  JoystickAction,
  JoystickAxis,
  JoystickAxisInput,
  JoystickButton,
  JoystickButtonInput,
  JoystickProtocol,
} from '@/types/joystick'

import BaseConfigurationView from './BaseConfigurationView.vue'

const controllerStore = useControllerStore()
const { globalAddress } = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const { openSnackbar } = useSnackbar()

const showJoystickWarningMessage = ref(false)
const searchText = ref('')

onMounted(async () => {
  controllerStore.enableForwarding = false
  warnIfJoystickDoesNotSupportExtendedManualControl()
})

// Does not let the joystick forwarding to be enabled while the user is in this page
// This could happen, for example, when the joystick is reconnected while in this page
watch(
  () => controllerStore.enableForwarding,
  () => (controllerStore.enableForwarding = false)
)

const currentJoystick = ref<Joystick>()
const currentButtonInputs = ref<JoystickButtonInput[]>([])
const currentAxisInputs = ref<JoystickAxisInput[]>([])
const remappingAxisInput = ref<false | JoystickAxis>(false)
const remapAxisTimeProgress = ref()
const showAxisRemappingText = ref(false)
const justRemappedInput = ref<boolean>()
const justRemappedAxisInput = ref<boolean>()
const inputClickedDialog = ref(false)
const currentModifierKey: Ref<ProtocolAction> = ref(modifierKeyActions.regular)
const availableModifierKeys: ProtocolAction[] = Object.values(modifierKeyActions)
const showJoystickLayout = ref(true)
const currentTabVIew = ref('table')

// Throttled button states implementation for performance optimization
const throttledButtonStates = ref<Record<number, number | undefined>>({})
const lastButtonUpdateTime = ref(0)
const buttonUpdateThrottleMs = 30

// Optimized shallow watcher instead of deep watcher
let buttonUpdateScheduled = false
watch(
  () => currentJoystick.value?.state.buttons,
  (newButtonStates) => {
    if (!newButtonStates || buttonUpdateScheduled) return

    buttonUpdateScheduled = true
    requestAnimationFrame(() => {
      const now = Date.now()
      if (now - lastButtonUpdateTime.value > buttonUpdateThrottleMs) {
        // Only update changed buttons instead of copying entire object
        for (const [buttonId, value] of Object.entries(newButtonStates)) {
          if (throttledButtonStates.value[Number(buttonId)] !== value) {
            throttledButtonStates.value[Number(buttonId)] = value
          }
        }
        lastButtonUpdateTime.value = now
      }
      buttonUpdateScheduled = false
    })
  }
)

const isButtonPressed = (buttonId: JoystickButton): boolean => {
  return (throttledButtonStates.value[buttonId] ?? 0) > 0.5
}

const shiftFunction = {
  protocol: 'cockpit-modifier-key',
  id: 'shift',
  name: 'Shift',
}

const idsExcludedJoystickActions = [
  MAVLinkButtonFunction.arm,
  MAVLinkButtonFunction.disarm,
  mavlinkCameraZoomActionId,
  mavlinkCameraFocusActionId,
]

watch(
  () => currentJoystick.value?.model,
  (newModel) => {
    if (newModel === JoystickModel.Unknown) {
      currentTabVIew.value = 'table'
      return
    }
    currentTabVIew.value = 'svg'
  }
)

const warnIfJoystickDoesNotSupportExtendedManualControl = async (): Promise<void> => {
  try {
    const m2rVersion = await getMavlink2RestVersion(globalAddress)
    const m2rSupportsExtendedManualControl = semver.gte(m2rVersion, '0.11.19')
    const ardupilotVersion = await getArdupilotVersion(globalAddress)
    const ardupilotSupportsExtendedManualControl = semver.gte(ardupilotVersion, '4.1.2')

    showJoystickWarningMessage.value = !m2rSupportsExtendedManualControl || !ardupilotSupportsExtendedManualControl
  } catch (error) {
    console.error(`Error getting Mavlink2Rest or Ardupilot version. ${error}. Will try again in 10 seconds.`)
    setTimeout(warnIfJoystickDoesNotSupportExtendedManualControl, 10000)
  }
}

const filteredAndSortedJoystickActions = computed((): JoystickAction[] => {
  const allowedProtocols = [
    JoystickProtocol.MAVLinkManualControl,
    JoystickProtocol.CockpitAction,
    JoystickProtocol.DataLakeVariable,
  ]

  return buttonActionsToShow.value
    .filter((action: JoystickAction) => action.name.toLowerCase().includes(searchText.value.toLowerCase()))
    .filter((action: JoystickAction) => allowedProtocols.includes(action.protocol as JoystickProtocol))
    .filter((action: JoystickAction) => {
      const dataLakeVariableInfo = getDataLakeVariableInfo(action.id)
      if (!dataLakeVariableInfo) return true
      return dataLakeVariableInfo.allowUserToChangeValue && dataLakeVariableInfo.type !== 'string'
    })
    .filter((action: JoystickAction) => !idsExcludedJoystickActions.includes(action.id))
    .sort((a: JoystickAction, b: JoystickAction) => a.name.localeCompare(b.name))
})

const headers = ref([
  { text: 'Type', value: 'type' },
  { text: 'Index', value: 'index' },
  { text: 'Actions', value: 'actions', sortable: false },
])

/**
 * Cache for table items to avoid recreating objects
 */
const tableItemsCache = ref<{
  /**
   * The key of the cache
   */
  key: string
  /**
   * The items of the cache
   */
  items: any[]
} | null>(null)

/**
 * Optimized table items with memoization to reduce object creation
 */
const tableItems = computed(() => {
  if (currentJoystick.value === undefined) {
    return []
  }

  const axesLength = currentJoystick.value.state.axes.length
  const buttonsLength = currentJoystick.value.state.buttons.length
  const cacheKey = `${axesLength}-${buttonsLength}`

  // Check if we can use cached items
  if (tableItemsCache.value?.key === cacheKey) {
    return tableItemsCache.value.items
  }

  // Create new items if cache is not defined yet
  const axesItems = Array.from({ length: Math.min(31, axesLength) }, (_, index) => ({ type: 'axis', id: index }))

  const buttonItems = Array.from({ length: Math.min(31, buttonsLength) }, (_, index) => ({ type: 'button', id: index }))

  const items = [...axesItems, ...buttonItems]

  // Update cache outside of computed (in nextTick to avoid side effects)
  nextTick(() => {
    tableItemsCache.value = { key: cacheKey, items }
  })

  return items
})

onUnmounted(() => {
  controllerStore.enableForwarding = true
})

watch(inputClickedDialog, () => {
  justRemappedInput.value = undefined
  justRemappedAxisInput.value = undefined
})

const setCurrentInputFromTable = (joystick: Joystick, input: JoystickInput): void => {
  const inputs = [input]
  setCurrentInputs(joystick, inputs)
}

const setCurrentInputs = (joystick: Joystick, inputs: JoystickInput[]): void => {
  currentJoystick.value = joystick

  currentButtonInputs.value = inputs
    .filter((i) => i.type === InputType.Button)
    .map((i) => new JoystickButtonInput(i.id as JoystickButton))
  currentAxisInputs.value = inputs
    .filter((i) => i.type === InputType.Axis)
    .map((i) => new JoystickAxisInput(i.id as JoystickAxis))

  inputClickedDialog.value = true
}

const currentButtonActions = computed(
  () => controllerStore.protocolMapping.buttonsCorrespondencies[currentModifierKey.value.id as CockpitModifierKeyOption]
)

const unbindCurrentInput = (input: JoystickButtonInput): void => {
  const actions: ProtocolAction = {
    id: 'no_function',
    name: 'No function',
    protocol: JoystickProtocol.CockpitAction,
  }
  updateButtonAction(input, actions)
}

const updateButtonAction = (input: JoystickButtonInput, action: ProtocolAction): void => {
  controllerStore.protocolMapping.buttonsCorrespondencies[currentModifierKey.value.id as CockpitModifierKeyOption][
    input.id
  ].action = action
  setTimeout(() => {
    showJoystickLayout.value = false
    nextTick(() => (showJoystickLayout.value = true))
  }, 1000)
  openSnackbar({ message: `Button ${input.id} remapped to function '${action.name}'.`, variant: 'success' })
}

// Automatically set the current joystick when it changes for the first time
watch(controllerStore.joysticks, () => {
  if (currentJoystick.value === undefined) {
    if (controllerStore.joysticks.size <= 0) return
    currentJoystick.value = controllerStore.joysticks.entries().next().value[1]
  }
})

let lastModTabChange = new Date().getTime()
const changeModifierKeyTab = (modKeyOption: CockpitModifierKeyOption): void => {
  if (!Object.keys(modifierKeyActions).includes(modKeyOption)) return

  // Buffer so we change tab once per button press
  if (new Date().getTime() - lastModTabChange < 200) return
  lastModTabChange = new Date().getTime()

  currentModifierKey.value = modifierKeyActions[modKeyOption]
}

const axisRemappingText = computed(() => {
  return remappingAxisInput.value
    ? 'Make a full range move on the axis you want to use for this input.'
    : justRemappedAxisInput.value === undefined
    ? ''
    : justRemappedAxisInput.value
    ? 'Axis input remapped.'
    : 'No axis detected.'
})

const buttonActionsToShow = computed(() =>
  controllerStore.availableButtonActions.filter((a) => {
    // Do not show the action to the regular modifier key, as it's the default behavior when not pressing any modifier key
    const isNotRegularAction = JSON.stringify(a) !== JSON.stringify(modifierKeyActions.regular)

    // Do not show transforming functions, as they are calculated, not to be injected
    const transformingFunctions = getAllTransformingFunctions()
    const isNotTransformingFunction = !transformingFunctions.some((v) => v.id === a.id)

    return isNotRegularAction && isNotTransformingFunction
  })
)

const availableVehicleTypes = computed(() => Object.keys(MavType))

const vehicleTypesAssignedToCurrentProfile = computed({
  get() {
    return Object.keys(controllerStore.vehicleTypeProtocolMappingCorrespondency).filter((vType) => {
      // @ts-ignore: Enums in TS such
      return controllerStore.vehicleTypeProtocolMappingCorrespondency[vType] === controllerStore.protocolMapping.hash
    })
  },
  set(selectedVehicleTypes: string[]) {
    availableVehicleTypes.value.forEach((vType) => {
      // @ts-ignore: Enums in TS such
      if (controllerStore.vehicleTypeProtocolMappingCorrespondency[vType] === controllerStore.protocolMapping.hash) {
        // @ts-ignore: Enums in TS such
        controllerStore.vehicleTypeProtocolMappingCorrespondency[vType] = undefined
      }
      if (selectedVehicleTypes.includes(vType)) {
        // @ts-ignore: Enums in TS such
        controllerStore.vehicleTypeProtocolMappingCorrespondency[vType] = controllerStore.protocolMapping.hash
      }
    })
  },
})

const closeInputMappingDialog = (): void => {
  inputClickedDialog.value = false
}

const scaledAxisValue = (joystick: Joystick, axisId: JoystickAxis): number => {
  const rawValue = joystick.state.axes[axisId] || 0
  const min = controllerStore.protocolMapping.axesCorrespondencies[axisId]?.min ?? -1
  const max = controllerStore.protocolMapping.axesCorrespondencies[axisId]?.max ?? +1
  return scale(rawValue, -1, 1, min, max)
}

const toggleJoystickEnabling = (joystickModel: string): void => {
  if (controllerStore.disabledJoysticks.includes(joystickModel)) {
    controllerStore.disabledJoysticks = controllerStore.disabledJoysticks.filter((model) => model !== joystickModel)
  } else {
    controllerStore.disabledJoysticks.push(joystickModel)
  }
}
</script>
