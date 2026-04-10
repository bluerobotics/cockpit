<template>
  <GlassModal :is-visible="isVisible" position="center">
    <div class="features-modal p-4 max-w-[95vw]">
      <div class="flex justify-center items-center mb-2">
        <h2 class="text-xl font-semibold">BlueOS Extension Features</h2>
      </div>
      <div class="fixed top-1 right-1">
        <v-btn icon="mdi-close" size="small" variant="text" class="text-lg" @click="closeModal"></v-btn>
      </div>

      <v-tabs v-model="activeTab" class="mb-4">
        <v-tab value="actions">Actions</v-tab>
        <v-tab value="joystick-suggestions">Joystick Mappings</v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeTab">
        <!-- Actions Tab -->
        <v-tabs-window-item value="actions">
          <div class="actions-container">
            <div
              v-if="filteredActions.length === 0 && appliedActions.length === 0 && ignoredActions.length === 0"
              class="text-center py-8"
            >
              <v-icon size="50" color="grey" class="mb-3">mdi-lightning-bolt-outline</v-icon>
              <p class="text-grey-lighten-1">No actions available from extensions.</p>
            </div>

            <!-- New Actions -->
            <div v-if="filteredActions.length > 0" class="mb-4">
              <div class="flex items-center gap-2 mb-2">
                <v-icon size="24" color="blue">mdi-lightning-bolt-outline</v-icon>
                <h2 class="text-xl font-semibold">New Actions</h2>
              </div>
              <p class="mb-2 text-grey-lighten-1">
                The following actions are offered to be added by BlueOS extensions:
              </p>
              <v-list class="bg-transparent">
                <v-list-item v-for="action in filteredActions" :key="action.id" class="mb-3 p-0">
                  <v-card variant="outlined" class="w-full action-card">
                    <v-card-item>
                      <v-card-title class="font-medium pb-0">{{ action.name }}</v-card-title>
                      <v-card-subtitle class="text-grey-lighten-1">
                        {{ getActionTypeName(action.type) }}
                      </v-card-subtitle>
                      <v-card-text v-if="getActionDescription(action)" class="pt-1 text-sm">
                        {{ getActionDescription(action) }}
                      </v-card-text>
                      <div class="flex justify-between items-center mt-2">
                        <v-btn variant="text" prepend-icon="mdi-close" size="small" @click="ignoreAction(action)">
                          Ignore
                        </v-btn>
                        <span class="text-xs text-grey-lighten-1">from {{ action.extensionName }}</span>
                        <v-btn
                          variant="tonal"
                          prepend-icon="mdi-plus-circle-outline"
                          size="small"
                          @click="addAction(action)"
                        >
                          Add Action
                        </v-btn>
                      </div>
                    </v-card-item>
                  </v-card>
                </v-list-item>
              </v-list>
            </div>

            <!-- Applied Actions -->
            <div v-if="appliedActions.length > 0" class="mb-4">
              <v-btn
                variant="text"
                color="grey-lighten-1"
                class="opacity-70 hover:opacity-100"
                :prepend-icon="showAppliedActions ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                @click="showAppliedActions = !showAppliedActions"
              >
                {{ showAppliedActions ? 'Hide applied actions' : 'Show applied actions' }}
              </v-btn>
              <div v-if="showAppliedActions" class="mt-2">
                <v-list class="bg-transparent">
                  <v-list-item v-for="action in appliedActions" :key="action.id" class="mb-3 p-0">
                    <v-card
                      variant="outlined"
                      class="w-full"
                      :class="existingActionNames.has(action.name) ? 'border-green-500/30' : 'border-orange-500/30'"
                    >
                      <v-card-item>
                        <v-card-title class="font-medium pb-0">{{ action.name }}</v-card-title>
                        <v-card-subtitle class="text-grey-lighten-1">
                          {{ getActionTypeName(action.type) }}
                        </v-card-subtitle>
                        <div class="flex justify-between items-center mt-2">
                          <v-chip
                            v-if="existingActionNames.has(action.name)"
                            color="green"
                            variant="tonal"
                            prepend-icon="mdi-check"
                            size="small"
                          >
                            Applied
                          </v-chip>
                          <v-chip v-else color="orange" variant="tonal" prepend-icon="mdi-alert-outline" size="small">
                            Applied but removed
                          </v-chip>
                          <span class="text-xs text-grey-lighten-1">from {{ action.extensionName }}</span>
                        </div>
                        <div v-if="!existingActionNames.has(action.name)" class="flex justify-center gap-4 mt-3">
                          <v-btn
                            variant="text"
                            prepend-icon="mdi-close"
                            size="small"
                            @click="moveAppliedToIgnored(action)"
                          >
                            Ignore
                          </v-btn>
                          <v-btn
                            variant="tonal"
                            prepend-icon="mdi-plus-circle-outline"
                            size="small"
                            @click="reAddAction(action)"
                          >
                            Re-add
                          </v-btn>
                        </div>
                      </v-card-item>
                    </v-card>
                  </v-list-item>
                </v-list>
              </div>
            </div>

            <!-- Ignored Actions -->
            <div v-if="ignoredActions.length > 0" class="mb-4">
              <v-btn
                variant="text"
                color="grey-lighten-1"
                class="opacity-70 hover:opacity-100"
                :prepend-icon="showIgnoredActions ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                @click="showIgnoredActions = !showIgnoredActions"
              >
                {{ showIgnoredActions ? 'Hide ignored actions' : 'Show ignored actions' }}
              </v-btn>
              <div v-if="showIgnoredActions" class="mt-2">
                <div class="flex justify-end mb-2">
                  <v-btn
                    variant="tonal"
                    color="blue"
                    prepend-icon="mdi-restore"
                    size="small"
                    @click="restoreAllIgnoredActions"
                  >
                    Restore All
                  </v-btn>
                </div>
                <v-list class="bg-transparent">
                  <v-list-item v-for="action in ignoredActions" :key="action.id" class="mb-3 p-0">
                    <v-card variant="outlined" class="w-full border-orange-500/30">
                      <v-card-item>
                        <v-card-title class="font-medium pb-0">{{ action.name }}</v-card-title>
                        <v-card-subtitle class="text-grey-lighten-1">
                          {{ getActionTypeName(action.type) }}
                        </v-card-subtitle>
                        <div class="flex justify-between items-center mt-2">
                          <v-chip color="orange" variant="tonal" prepend-icon="mdi-close-circle" size="small">
                            Ignored
                          </v-chip>
                          <span class="text-xs text-grey-lighten-1">from {{ action.extensionName }}</span>
                          <v-btn
                            variant="tonal"
                            color="blue"
                            prepend-icon="mdi-restore"
                            size="small"
                            @click="restoreIgnoredAction(action)"
                          >
                            Restore
                          </v-btn>
                        </div>
                      </v-card-item>
                    </v-card>
                  </v-list-item>
                </v-list>
              </div>
            </div>
          </div>
        </v-tabs-window-item>

        <!-- Joystick Suggestions Tab -->
        <v-tabs-window-item value="joystick-suggestions">
          <div
            v-if="
              filteredJoystickSuggestionsByExtension.length === 0 &&
              appliedJoystickSuggestionsByExtension.length === 0 &&
              ignoredJoystickSuggestionsByExtension.length === 0
            "
            class="text-center py-8"
          >
            <v-icon size="50" color="grey" class="mb-3">mdi-gamepad-variant-outline</v-icon>
            <p class="text-grey-lighten-1">No joystick mapping suggestions available.</p>
          </div>

          <div v-else class="actions-container">
            <!-- New Suggestions Section -->
            <div v-if="filteredJoystickSuggestionsByExtension.length > 0" class="mb-8">
              <div class="flex items-center gap-2 mb-4">
                <v-icon size="24" color="blue">mdi-gamepad-variant-outline</v-icon>
                <h2 class="text-xl font-semibold">New Suggestions</h2>
              </div>
              <p class="mb-2 text-grey-lighten-1">
                The following joystick mappings are suggested by BlueOS extensions:
              </p>

              <!-- Group suggestions by extension -->
              <div
                v-for="extensionGroup in filteredJoystickSuggestionsByExtension"
                :key="extensionGroup.extensionName"
                class="mb-6"
              >
                <!-- Extension container -->
                <v-card variant="outlined" class="extension-container">
                  <!-- Extension header -->
                  <div class="flex items-center justify-between p-4 bg-slate-700/30 rounded-t-lg">
                    <div class="flex items-center gap-2">
                      <v-icon size="20" color="blue">mdi-puzzle-outline</v-icon>
                      <h3 class="text-lg font-semibold">{{ extensionGroup.extensionName }}</h3>
                    </div>
                    <v-btn
                      variant="text"
                      color="orange-lighten-1"
                      prepend-icon="mdi-close-circle-multiple-outline"
                      size="x-small"
                      @click="ignoreRemainingSuggestionsFromExtension(extensionGroup)"
                    >
                      Ignore remaining suggestions
                    </v-btn>
                  </div>

                  <!-- Suggestion groups within this extension -->
                  <v-expansion-panels class="px-2 pb-2" variant="accordion">
                    <v-expansion-panel
                      v-for="group in extensionGroup.suggestionGroups"
                      :key="group.id"
                      class="bg-transparent"
                    >
                      <v-expansion-panel-title class="py-2">
                        <div class="flex items-center gap-2 flex-grow">
                          <v-icon size="16" color="blue-lighten-2">mdi-folder-outline</v-icon>
                          <span class="text-sm font-semibold text-grey-lighten-1">{{ group.name }}</span>
                          <v-tooltip v-if="group.description" location="top" max-width="320">
                            <template #activator="{ props: tooltipProps }">
                              <v-icon v-bind="tooltipProps" size="14" color="grey-lighten-1" class="cursor-help">
                                mdi-information-outline
                              </v-icon>
                            </template>
                            <span class="text-xs">{{ group.description }}</span>
                          </v-tooltip>
                          <v-chip size="x-small" variant="tonal" class="bg-[#20538d] text-white font-bold">
                            {{ group.buttonMappingSuggestions.length }}
                          </v-chip>
                          <v-spacer />
                          <v-btn
                            variant="tonal"
                            color="green"
                            prepend-icon="mdi-check-all"
                            size="x-small"
                            class="mr-2"
                            @click.stop="acceptAllGroupSuggestions(extensionGroup.extensionName, group)"
                          >
                            Accept All
                          </v-btn>
                          <v-btn
                            variant="text"
                            color="orange-lighten-1"
                            prepend-icon="mdi-close-circle-multiple-outline"
                            size="x-small"
                            @click.stop="ignoreAllGroupSuggestions(group)"
                          >
                            Ignore all
                          </v-btn>
                        </div>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <div class="flex flex-wrap gap-2 justify-start">
                          <div
                            v-for="suggestion in group.buttonMappingSuggestions"
                            :key="suggestion.id"
                            class="suggestion-item-compact p-3 border border-gray-600 rounded-lg bg-gray-800/20 hover:bg-gray-700/30 transition-colors"
                          >
                            <div class="text-center mb-3">
                              <h4 class="font-medium text-white mb-1">{{ suggestion.actionName }}</h4>
                            </div>
                            <div class="flex justify-center mb-3">
                              <div class="joystick-svg-container-small">
                                <JoystickButtonIndicator
                                  :button-number="suggestion.button"
                                  :modifier="suggestion.modifier"
                                />
                              </div>
                            </div>
                            <div class="flex w-full justify-between">
                              <v-btn
                                variant="text"
                                prepend-icon="mdi-close"
                                size="small"
                                @click="ignoreSuggestion(suggestion)"
                              >
                                Ignore
                              </v-btn>
                              <v-btn
                                variant="tonal"
                                prepend-icon="mdi-plus-circle-outline"
                                size="small"
                                @click="openJoystickSuggestionDialog(suggestion, extensionGroup.extensionName)"
                              >
                                Apply
                              </v-btn>
                            </div>
                          </div>
                        </div>
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </v-card>
              </div>
            </div>

            <div v-if="appliedJoystickSuggestionsByExtension.length > 0" class="mb-4">
              <v-btn
                variant="text"
                color="grey-lighten-1"
                class="opacity-70 hover:opacity-100"
                :prepend-icon="showAppliedMappings ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                @click="showAppliedMappings = !showAppliedMappings"
              >
                {{ showAppliedMappings ? 'Hide applied mappings' : 'Show applied mappings' }}
              </v-btn>
            </div>

            <!-- Applied Suggestions Section -->
            <div v-if="showAppliedMappings && appliedJoystickSuggestionsByExtension.length > 0" class="mb-8">
              <div class="flex items-center gap-2 mb-4">
                <v-icon size="24" color="green">mdi-check-circle</v-icon>
                <h2 class="text-xl font-semibold">Applied Mappings</h2>
              </div>
              <p class="mb-4 text-grey-lighten-1">These joystick mappings have been applied from BlueOS extensions:</p>

              <!-- Group applied suggestions by extension -->
              <div
                v-for="extensionGroup in appliedJoystickSuggestionsByExtension"
                :key="extensionGroup.extensionName"
                class="mb-6"
              >
                <!-- Extension container -->
                <v-card variant="outlined" class="extension-container border-green-500/30">
                  <!-- Extension header -->
                  <div
                    class="flex items-center justify-between mb-4 p-4 bg-green-900/20 rounded-t-lg border-b border-green-500/30"
                  >
                    <div class="flex items-center gap-2">
                      <v-icon size="20" color="green">mdi-check-circle</v-icon>
                      <h3 class="text-lg font-semibold">{{ extensionGroup.extensionName }}</h3>
                    </div>
                  </div>

                  <!-- Applied suggestion groups from this extension -->
                  <v-expansion-panels class="px-2 pb-2" variant="accordion">
                    <v-expansion-panel
                      v-for="group in extensionGroup.suggestionGroups"
                      :key="group.id"
                      class="bg-transparent"
                    >
                      <v-expansion-panel-title class="py-2">
                        <div class="flex items-center gap-2">
                          <v-icon size="16" color="green-lighten-2">mdi-folder-outline</v-icon>
                          <span class="text-sm font-semibold text-grey-lighten-1">{{ group.name }}</span>
                          <v-tooltip v-if="group.description" location="top" max-width="320">
                            <template #activator="{ props: tooltipProps }">
                              <v-icon v-bind="tooltipProps" size="14" color="grey-lighten-1" class="cursor-help">
                                mdi-information-outline
                              </v-icon>
                            </template>
                            <span class="text-xs">{{ group.description }}</span>
                          </v-tooltip>
                          <v-chip size="x-small" variant="outlined" color="green">
                            {{ group.buttonMappingSuggestions.length }}
                          </v-chip>
                        </div>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <p v-if="group.description" class="text-sm text-grey-lighten-1 mb-3">
                          {{ group.description }}
                        </p>
                        <div class="flex flex-wrap gap-4 justify-start pt-2">
                          <div
                            v-for="suggestion in group.buttonMappingSuggestions"
                            :key="suggestion.id"
                            class="suggestion-item-compact p-3 rounded-lg"
                            :class="
                              suggestionDiffersFromCurrentMapping(suggestion)
                                ? 'border border-orange-500/30 bg-orange-900/10'
                                : 'border border-green-500/30 bg-green-900/10'
                            "
                          >
                            <div class="text-center mb-3">
                              <h4 class="font-medium text-white mb-1">{{ suggestion.actionName }}</h4>
                              <p v-if="suggestion.description" class="text-sm text-grey-lighten-1">
                                {{ suggestion.description }}
                              </p>
                            </div>
                            <div class="flex justify-center mb-3">
                              <div class="joystick-svg-container-small">
                                <JoystickButtonIndicator
                                  :button-number="suggestion.button"
                                  :modifier="suggestion.modifier"
                                />
                              </div>
                            </div>
                            <div class="flex justify-center">
                              <v-chip
                                v-if="!suggestionDiffersFromCurrentMapping(suggestion)"
                                color="green"
                                variant="tonal"
                                prepend-icon="mdi-check"
                                size="small"
                              >
                                Applied
                              </v-chip>
                              <v-chip
                                v-else
                                color="orange"
                                variant="tonal"
                                prepend-icon="mdi-alert-outline"
                                size="small"
                              >
                                Applied but changed
                              </v-chip>
                            </div>
                            <div
                              v-if="suggestionDiffersFromCurrentMapping(suggestion)"
                              class="flex justify-center gap-4 mt-3"
                            >
                              <v-btn
                                variant="text"
                                prepend-icon="mdi-close"
                                size="small"
                                @click="moveAppliedSuggestionToIgnored(suggestion)"
                              >
                                Ignore
                              </v-btn>
                              <v-btn
                                variant="tonal"
                                prepend-icon="mdi-plus-circle-outline"
                                size="small"
                                @click="openJoystickSuggestionDialog(suggestion, extensionGroup.extensionName)"
                              >
                                Re-apply
                              </v-btn>
                            </div>
                          </div>
                        </div>
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </v-card>
              </div>
            </div>

            <!-- Ignored Suggestions Section -->
            <div v-if="ignoredJoystickSuggestionsByExtension.length > 0" class="mb-4">
              <v-btn
                variant="text"
                color="grey-lighten-1"
                class="opacity-70 hover:opacity-100"
                :prepend-icon="showIgnoredMappings ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                @click="showIgnoredMappings = !showIgnoredMappings"
              >
                {{ showIgnoredMappings ? 'Hide ignored mappings' : 'Show ignored mappings' }}
              </v-btn>
            </div>

            <!-- Ignored Suggestions Section -->
            <div v-if="showIgnoredMappings && ignoredJoystickSuggestionsByExtension.length > 0" class="mb-8">
              <div class="flex items-center gap-2 mb-4">
                <v-icon size="24" color="orange">mdi-close-circle</v-icon>
                <h2 class="text-xl font-semibold">Ignored Mappings</h2>
              </div>
              <p class="mb-4 text-grey-lighten-1">These joystick mappings have been ignored:</p>

              <!-- Group ignored suggestions by extension -->
              <div
                v-for="extensionGroup in ignoredJoystickSuggestionsByExtension"
                :key="extensionGroup.extensionName"
                class="mb-6"
              >
                <!-- Extension container -->
                <v-card variant="outlined" class="extension-container border-orange-500/30">
                  <!-- Extension header -->
                  <div
                    class="flex items-center justify-between mb-4 p-4 bg-orange-900/20 rounded-t-lg border-b border-orange-500/30"
                  >
                    <div class="flex items-center gap-2">
                      <v-icon size="20" color="orange">mdi-close-circle</v-icon>
                      <h3 class="text-lg font-semibold">{{ extensionGroup.extensionName }}</h3>
                    </div>
                    <v-btn
                      variant="tonal"
                      color="blue"
                      prepend-icon="mdi-restore"
                      size="small"
                      @click="restoreAllIgnoredSuggestions(extensionGroup.extensionName)"
                    >
                      Restore All
                    </v-btn>
                  </div>

                  <!-- Ignored suggestion groups from this extension -->
                  <v-expansion-panels class="px-2 pb-2" variant="accordion">
                    <v-expansion-panel
                      v-for="group in extensionGroup.suggestionGroups"
                      :key="group.id"
                      class="bg-transparent"
                    >
                      <v-expansion-panel-title class="py-2">
                        <div class="flex items-center gap-2">
                          <v-icon size="16" color="orange-lighten-2">mdi-folder-outline</v-icon>
                          <span class="text-sm font-semibold text-grey-lighten-1">{{ group.name }}</span>
                          <v-tooltip v-if="group.description" location="top" max-width="320">
                            <template #activator="{ props: tooltipProps }">
                              <v-icon v-bind="tooltipProps" size="14" color="grey-lighten-1" class="cursor-help">
                                mdi-information-outline
                              </v-icon>
                            </template>
                            <span class="text-xs">{{ group.description }}</span>
                          </v-tooltip>
                          <v-chip size="x-small" variant="outlined" color="orange">
                            {{ group.buttonMappingSuggestions.length }}
                          </v-chip>
                        </div>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <p v-if="group.description" class="text-sm text-grey-lighten-1 mb-3">
                          {{ group.description }}
                        </p>
                        <div class="flex flex-wrap gap-4 justify-start pt-2">
                          <div
                            v-for="suggestion in group.buttonMappingSuggestions"
                            :key="suggestion.id"
                            class="suggestion-item-compact p-3 border border-orange-500/30 rounded-lg bg-orange-900/10"
                          >
                            <div class="text-center mb-3">
                              <h4 class="font-medium text-white mb-1">{{ suggestion.actionName }}</h4>
                              <p v-if="suggestion.description" class="text-sm text-grey-lighten-1">
                                {{ suggestion.description }}
                              </p>
                            </div>
                            <div class="flex justify-center mb-3">
                              <div class="joystick-svg-container-small">
                                <JoystickButtonIndicator
                                  :button-number="suggestion.button"
                                  :modifier="suggestion.modifier"
                                />
                              </div>
                            </div>
                            <div class="flex justify-center">
                              <v-btn
                                variant="tonal"
                                color="blue"
                                prepend-icon="mdi-restore"
                                size="small"
                                @click="restoreIgnoredSuggestion(suggestion)"
                              >
                                Restore
                              </v-btn>
                            </div>
                          </div>
                        </div>
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </v-card>
              </div>
            </div>
          </div>
        </v-tabs-window-item>
      </v-tabs-window>

      <!-- Joystick Suggestion Application Dialog -->
      <v-dialog v-model="joystickSuggestionDialog" max-width="700px">
        <v-card v-if="selectedSuggestion" class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
          <v-card-title class="text-center pt-4 pb-0">
            <h2 class="text-xl font-semibold">Apply Joystick Mapping Suggestion</h2>
          </v-card-title>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            class="absolute top-2 right-2 text-lg"
            @click="joystickSuggestionDialog = false"
          ></v-btn>

          <v-card-text class="px-6 pb-4">
            <div class="mb-2">
              <p class="text-center text-sm text-gray-300 mb-2">
                <strong>{{ selectedSuggestion.actionName }}</strong> from {{ selectedSuggestion.extensionName }}
              </p>
              <p v-if="selectedSuggestion.description" class="text-center text-xs text-gray-400 mb-2">
                {{ selectedSuggestion.description }}
              </p>
            </div>

            <div class="space-y-3">
              <div class="rounded-lg border border-gray-600 bg-gray-800/20 p-4">
                <p class="text-center text-xs text-gray-400 mb-2">
                  Button {{ selectedSuggestion.button }} ({{ selectedSuggestion.modifier }})
                </p>
                <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div class="text-center">
                    <p class="text-xs text-gray-400 mb-1">Current mapping</p>
                    <p class="font-medium text-gray-200">{{ selectedSuggestionCurrentActionName }}</p>
                  </div>
                  <v-icon size="20" color="green">mdi-arrow-right</v-icon>
                  <div class="text-center">
                    <p class="text-xs text-gray-400 mb-1">New mapping</p>
                    <p class="font-medium text-green-400">{{ selectedSuggestion.actionName }}</p>
                  </div>
                </div>
              </div>
            </div>
          </v-card-text>

          <div class="flex justify-center w-full px-6 pb-2">
            <v-divider style="border-color: #ffffff14"></v-divider>
          </div>

          <v-card-actions class="px-6 pb-4 justify-space-between">
            <v-btn variant="text" @click="joystickSuggestionDialog = false">Cancel</v-btn>
            <v-btn @click="applyJoystickSuggestion">Apply</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Accept All Suggestions Dialog -->
      <v-dialog v-model="acceptAllDialog" max-width="500px">
        <v-card v-if="acceptAllGroup" class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
          <v-card-title class="text-center pt-4 pb-0">
            <h2 class="text-xl font-semibold">Accept All Suggestions</h2>
          </v-card-title>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            class="absolute top-2 right-2 text-lg"
            @click="acceptAllDialog = false"
          ></v-btn>

          <v-card-text class="px-6 pb-4">
            <div class="mb-2">
              <p class="text-center text-sm text-gray-300 mb-2">
                Accept all {{ acceptAllGroupSuggestionCount }} suggestions from
                <strong>{{ acceptAllGroup.name }}</strong> ({{ acceptAllExtensionName }})?
              </p>
            </div>

            <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              <div
                v-for="row in acceptAllGroupSuggestionDiffRows"
                :key="row.id"
                class="rounded-md border border-gray-600 bg-gray-800/20 px-3 py-2"
              >
                <p class="text-[11px] text-gray-400 mb-1">{{ row.inputLabel }}</p>
                <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <p class="text-xs text-gray-300 truncate">{{ row.fromActionName }}</p>
                  <v-icon size="16" color="green">mdi-arrow-right</v-icon>
                  <p class="text-xs text-green-400 truncate">{{ row.toActionName }}</p>
                </div>
              </div>
            </div>
          </v-card-text>

          <div class="flex justify-center w-full px-6 pb-2">
            <v-divider style="border-color: #ffffff14"></v-divider>
          </div>

          <v-card-actions class="px-6 pb-4 justify-space-between">
            <v-btn variant="text" @click="acceptAllDialog = false">Cancel</v-btn>
            <v-btn :disabled="acceptAllGroupSuggestionCount === 0" @click="applyAllSuggestions">Apply All</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </GlassModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import GlassModal from '@/components/GlassModal.vue'
import JoystickButtonIndicator from '@/components/JoystickButtonIndicator.vue'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { getAllJavascriptActionConfigs, registerJavascriptActionConfig } from '@/libs/actions/free-javascript'
import { getAllHttpRequestActionConfigs, registerHttpRequestActionConfig } from '@/libs/actions/http-request'
import {
  getAllMavlinkMessageActionConfigs,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import { getActionsFromBlueOS, getJoystickSuggestionsFromBlueOS } from '@/libs/blueos'
import { allAvailableButtons } from '@/libs/joystick/protocols'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import {
  JoystickMapSuggestion,
  JoystickMapSuggestionGroup,
  JoystickMapSuggestionGroupsFromExtension,
} from '@/types/blueos'
import {
  ActionConfig,
  customActionTypes,
  customActionTypesNames,
  HttpRequestActionConfig,
  JavascriptActionConfig,
  MavlinkMessageActionConfig,
} from '@/types/cockpit-actions'

const mainVehicleStore = useMainVehicleStore()

const { openSnackbar } = useSnackbar()
const controllerStore = useControllerStore()
const interfaceStore = useAppInterfaceStore()

/**
 * Props for the component
 */
const props = defineProps<{
  /**
   * Whether to automatically check for actions on mount
   */
  autoCheckOnMount?: boolean
}>()

/**
 * Emits events from the component
 */
const emit = defineEmits(['close', 'action-added'])

/**
 * Track which actions have been handled (applied or ignored) - persistent
 */
const handledActions = useBlueOsStorage('cockpit-handled-actions', {
  applied: [] as string[],
  ignored: [] as string[],
})

/**
 * Track which joystick suggestions have been handled (applied or ignored) - persistent
 */
const handledSuggestions = useBlueOsStorage('cockpit-handled-joystick-suggestions-v2', {
  applied: [] as string[],
  ignored: [] as string[],
})

/**
 * Computed refs for easier access to applied and ignored actions
 */
const appliedActionIds = computed(() => handledActions.value.applied)
const ignoredActionIds = computed(() => handledActions.value.ignored)

/**
 * Computed refs for easier access to applied and ignored suggestions
 */
const appliedSuggestionIds = computed(() => handledSuggestions.value.applied ?? [])
const ignoredSuggestionIds = computed(() => handledSuggestions.value.ignored ?? [])

const isVisible = computed({
  get: () => interfaceStore.isExternalFeaturesModalVisible,
  set: (v: boolean) => {
    interfaceStore.isExternalFeaturesModalVisible = v
  },
})

/**
 * Active tab for the tabs component
 */
const activeTab = ref('actions')

/**
 * Controls visibility of applied mappings section
 */
const showAppliedMappings = ref(false)

/**
 * Controls visibility of ignored mappings section
 */
const showIgnoredMappings = ref(false)

/**
 * Controls visibility of applied actions section
 */
const showAppliedActions = ref(false)

/**
 * Controls visibility of ignored actions section
 */
const showIgnoredActions = ref(false)

/**
 * Action with extension name
 */
type ActionWithExtensionName = ActionConfig & {
  /**
   * Name of the extension that offered the action
   */
  extensionName: string
}

/**
 * Store discovered actions from BlueOS
 */
const discoveredActions = ref<ActionWithExtensionName[]>([])

/**
 * Store discovered joystick suggestions from BlueOS
 */
const discoveredJoystickSuggestions = ref<JoystickMapSuggestionGroupsFromExtension[]>([])

/**
 * Dialog visibility for joystick suggestion application
 */
const joystickSuggestionDialog = ref(false)

/**
 * Dialog visibility for accepting all suggestions in a group
 */
const acceptAllDialog = ref(false)

/**
 * Extension name for accept all dialog
 */
const acceptAllExtensionName = ref<string | null>(null)

/**
 * Group selected for accept all dialog
 */
const acceptAllGroup = ref<JoystickMapSuggestionGroup | null>(null)

export type JoystickSuggestionWithExtensionName = JoystickMapSuggestion & {
  /**
   * Name of the extension that suggested the suggestion
   */
  extensionName: string
}

/**
 * Currently selected suggestion for application
 */
const selectedSuggestion = ref<JoystickSuggestionWithExtensionName | null>(null)

/**
 * Add an applied suggestion id
 * @param {string} suggestionId - Suggestion id
 */
const addAppliedSuggestionId = (suggestionId: string): void => {
  if (!handledSuggestions.value.applied.includes(suggestionId)) {
    handledSuggestions.value.applied.push(suggestionId)
  }
}

/**
 * Add ignored suggestion ids
 * @param {string[]} suggestionIds - Suggestion ids
 */
const addIgnoredSuggestionIds = (suggestionIds: string[]): void => {
  const ignoredIds = new Set(handledSuggestions.value.ignored)
  suggestionIds.forEach((suggestionId) => ignoredIds.add(suggestionId))
  handledSuggestions.value.ignored = Array.from(ignoredIds)
}

/**
 * Remove ignored suggestion ids
 * @param {string[]} suggestionIds - Suggestion ids
 */
const removeIgnoredSuggestionIds = (suggestionIds: string[]): void => {
  handledSuggestions.value.ignored = handledSuggestions.value.ignored.filter((id) => !suggestionIds.includes(id))
}

/**
 * Check if a suggestion differs from the current joystick functions mapping
 * @param {JoystickMapSuggestion} suggestion - The suggestion to evaluate
 * @returns {boolean} True when suggestion differs from the current mapping
 */
const suggestionDiffersFromCurrentMapping = (suggestion: JoystickMapSuggestion): boolean => {
  const mapping = controllerStore.protocolMapping
  if (!mapping) return true

  const currentAction = mapping.buttonsCorrespondencies?.[suggestion.modifier]?.[suggestion.button]?.action
  if (!currentAction) return true

  return currentAction.id !== suggestion.actionId || currentAction.protocol !== suggestion.actionProtocol
}

/**
 * Get current action name for the given suggestion input
 * @param {JoystickMapSuggestion} suggestion - The suggestion to evaluate
 * @returns {string} Current action name
 */
const getCurrentActionNameForSuggestion = (suggestion: JoystickMapSuggestion): string => {
  const mapping = controllerStore.protocolMapping
  if (!mapping) return 'No function'

  const currentAction = mapping.buttonsCorrespondencies?.[suggestion.modifier]?.[suggestion.button]?.action
  return currentAction?.name ?? 'No function'
}

/**
 * Current action name for selected suggestion and selected profile
 */
const selectedSuggestionCurrentActionName = computed(() => {
  if (!selectedSuggestion.value) return 'No function'
  return getCurrentActionNameForSuggestion(selectedSuggestion.value)
})

/**
 * Suggestions to apply in accept-all dialog with current and new mapping labels
 */
const acceptAllGroupSuggestionDiffRows = computed(() => {
  if (!acceptAllGroup.value) return []

  return acceptAllGroup.value.buttonMappingSuggestions
    .filter(
      (s) =>
        !appliedSuggestionIds.value.includes(s.id) &&
        !ignoredSuggestionIds.value.includes(s.id) &&
        suggestionDiffersFromCurrentMapping(s)
    )
    .map((suggestion) => ({
      id: suggestion.id,
      inputLabel: `Button ${suggestion.button} (${suggestion.modifier})`,
      fromActionName: getCurrentActionNameForSuggestion(suggestion),
      toActionName: suggestion.actionName,
    }))
})

/**
 * Reactive trigger to force re-evaluation of existingActionNames after registration changes
 */
const actionRegistryVersion = ref(0)

/**
 * Names of actions already registered in the app
 */
const existingActionNames = computed(() => {
  void actionRegistryVersion.value
  return new Set([
    ...Object.values(getAllHttpRequestActionConfigs()).map((a) => a.name),
    ...Object.values(getAllMavlinkMessageActionConfigs()).map((a) => a.name),
    ...Object.values(getAllJavascriptActionConfigs()).map((a) => a.name),
  ])
})

/**
 * New actions not yet applied, ignored, or already registered in the app
 */
const filteredActions = computed(() => {
  return discoveredActions.value.filter(
    (action) =>
      !appliedActionIds.value.includes(action.id) &&
      !ignoredActionIds.value.includes(action.id) &&
      !existingActionNames.value.has(action.name)
  )
})

/**
 * Actions that have been applied
 */
const appliedActions = computed(() => {
  return discoveredActions.value.filter((action) => appliedActionIds.value.includes(action.id))
})

/**
 * Actions that have been ignored
 */
const ignoredActions = computed(() => {
  return discoveredActions.value.filter((action) => ignoredActionIds.value.includes(action.id))
})

/**
 * Filtered extension groups structure with suggestion groups preserved
 */
interface FilteredExtensionGroups {
  /**
   * Name of the extension
   */
  extensionName: string
  /**
   * Suggestion groups with their suggestions filtered
   */
  suggestionGroups: JoystickMapSuggestionGroup[]
}

/**
 * Check if a suggestion group is compatible with the currently connected vehicle
 * @param {JoystickMapSuggestionGroup} group - The group to evaluate
 * @returns {boolean} True when the group is universal or targets the current vehicle type
 */
const suggestionGroupMatchesCurrentVehicle = (group: JoystickMapSuggestionGroup): boolean => {
  if (!group.targetVehicleTypes?.length) return true
  const currentVehicleType = mainVehicleStore.vehicleType
  if (currentVehicleType === undefined) return true
  return group.targetVehicleTypes.includes(String(currentVehicleType))
}

/**
 * Helper to filter suggestion groups within an extension by a predicate
 * @param {JoystickMapSuggestionGroupsFromExtension} extensionGroup - The extension group to filter
 * @param {(suggestion: JoystickMapSuggestion) => boolean} predicate - Filter predicate for suggestions
 * @returns {FilteredExtensionGroups} Filtered extension group
 */
const filterExtensionGroups = (
  extensionGroup: JoystickMapSuggestionGroupsFromExtension,
  predicate: (suggestion: JoystickMapSuggestion) => boolean
): FilteredExtensionGroups => {
  const currentVehicleType = mainVehicleStore.vehicleType
  const vehicleTypeStr = currentVehicleType !== undefined ? String(currentVehicleType) : undefined

  const hasVehicleSpecificGroups =
    vehicleTypeStr !== undefined &&
    extensionGroup.suggestionGroups.some(
      (group) => group.targetVehicleTypes?.length && group.targetVehicleTypes.includes(vehicleTypeStr)
    )

  return {
    extensionName: extensionGroup.extensionName,
    suggestionGroups: extensionGroup.suggestionGroups
      .filter((group) => {
        if (hasVehicleSpecificGroups) {
          return !!group.targetVehicleTypes?.length && group.targetVehicleTypes.includes(vehicleTypeStr!)
        }
        return suggestionGroupMatchesCurrentVehicle(group)
      })
      .map((group) => ({
        ...group,
        buttonMappingSuggestions: group.buttonMappingSuggestions.filter(predicate),
      }))
      .filter((group) => group.buttonMappingSuggestions.length > 0),
  }
}

/**
 * Get all suggestions across all groups for an extension
 * @param {FilteredExtensionGroups} extensionGroup - The filtered extension group
 * @returns {JoystickMapSuggestion[]} All suggestions from all groups
 */
const getAllSuggestionsFromExtension = (extensionGroup: FilteredExtensionGroups): JoystickMapSuggestion[] => {
  return extensionGroup.suggestionGroups.flatMap((group) => group.buttonMappingSuggestions)
}

/**
 * Filter out joystick suggestions that have already been applied or ignored, preserving group structure
 */
const filteredJoystickSuggestionsByExtension = computed(() => {
  return discoveredJoystickSuggestions.value
    .map((ext) =>
      filterExtensionGroups(
        ext,
        (s) =>
          !appliedSuggestionIds.value.includes(s.id) &&
          !ignoredSuggestionIds.value.includes(s.id) &&
          suggestionDiffersFromCurrentMapping(s)
      )
    )
    .filter((ext) => ext.suggestionGroups.length > 0)
})

/**
 * Get applied joystick suggestions grouped by extension, preserving group structure
 */
const appliedJoystickSuggestionsByExtension = computed(() => {
  return discoveredJoystickSuggestions.value
    .map((ext) => filterExtensionGroups(ext, (s) => appliedSuggestionIds.value.includes(s.id)))
    .filter((ext) => ext.suggestionGroups.length > 0)
})

/**
 * Get ignored joystick suggestions grouped by extension, preserving group structure
 */
const ignoredJoystickSuggestionsByExtension = computed(() => {
  return discoveredJoystickSuggestions.value
    .map((ext) => filterExtensionGroups(ext, (s) => ignoredSuggestionIds.value.includes(s.id)))
    .filter((ext) => ext.suggestionGroups.length > 0)
})

/**
 * Whether there are new extension features that still need user action
 */
const hasPendingBlueOSFeatures = computed(() => {
  return filteredActions.value.length > 0 || filteredJoystickSuggestionsByExtension.value.length > 0
})

/**
 * Get the human-readable name for an action type
 * @param {customActionTypes} type - The action type
 * @returns {string} The human-readable name for the action type
 */
const getActionTypeName = (type: customActionTypes): string => {
  return customActionTypesNames[type] || 'Unknown'
}

/**
 * Get the description from an action if available
 * @param {ActionConfig} action - The action
 * @returns {string|null} The description or null
 */
const getActionDescription = (action: ActionConfig): string | null => {
  // Handle the description property which might be in different locations depending on the action structure
  return (action as any).description || null
}

/**
 * Get the count of filtered suggestions in the selected group
 * @returns {number} Number of suggestions
 */
const acceptAllGroupSuggestionCount = computed((): number => {
  return acceptAllGroupSuggestionDiffRows.value.length
})

/**
 * Ignore a joystick suggestion
 * @param {JoystickMapSuggestion} suggestion - The suggestion to ignore
 */
const ignoreSuggestion = (suggestion: JoystickMapSuggestion): void => {
  addIgnoredSuggestionIds([suggestion.id])
  openSnackbar({
    message: `Suggestion "${suggestion.actionName}" has been ignored.`,
    variant: 'info',
  })
}

/**
 * Move an applied suggestion to the ignored list
 * @param {JoystickMapSuggestion} suggestion - The suggestion to move
 */
const moveAppliedSuggestionToIgnored = (suggestion: JoystickMapSuggestion): void => {
  handledSuggestions.value.applied = handledSuggestions.value.applied.filter((id) => id !== suggestion.id)
  addIgnoredSuggestionIds([suggestion.id])
  openSnackbar({
    message: `Mapping "${suggestion.actionName}" moved to ignored.`,
    variant: 'info',
  })
}

/**
 * Ignore all currently visible suggestions from an extension
 * @param {FilteredExtensionGroups} extensionGroup - Extension with filtered remaining suggestions
 */
const ignoreRemainingSuggestionsFromExtension = (extensionGroup: FilteredExtensionGroups): void => {
  const suggestionsToIgnore = getAllSuggestionsFromExtension(extensionGroup)
  if (suggestionsToIgnore.length === 0) return

  addIgnoredSuggestionIds(suggestionsToIgnore.map((suggestion) => suggestion.id))

  openSnackbar({
    message: `Ignored ${suggestionsToIgnore.length} remaining suggestion(s) from ${extensionGroup.extensionName}.`,
    variant: 'info',
  })
}

/**
 * Ignore all currently visible suggestions from a group
 * @param {JoystickMapSuggestionGroup} group - Filtered suggestion group
 */
const ignoreAllGroupSuggestions = (group: JoystickMapSuggestionGroup): void => {
  const suggestionsToIgnore = group.buttonMappingSuggestions
  if (suggestionsToIgnore.length === 0) return

  addIgnoredSuggestionIds(suggestionsToIgnore.map((suggestion) => suggestion.id))

  openSnackbar({
    message: `Ignored ${suggestionsToIgnore.length} suggestion(s) from group "${group.name}".`,
    variant: 'info',
  })
}

/**
 * Open the accept all suggestions dialog for a specific group
 * @param {string} extensionName - Extension name
 * @param {JoystickMapSuggestionGroup} group - The suggestion group
 */
const acceptAllGroupSuggestions = (extensionName: string, group: JoystickMapSuggestionGroup): void => {
  acceptAllExtensionName.value = extensionName
  acceptAllGroup.value = group
  acceptAllDialog.value = true
}

/**
 * Apply all suggestions from the selected group
 */
const applyAllSuggestions = (): void => {
  if (!acceptAllExtensionName.value || !acceptAllGroup.value) return

  const availableActions = allAvailableButtons()
  let appliedCount = 0

  const suggestions = acceptAllGroup.value.buttonMappingSuggestions.filter(
    (s) =>
      !appliedSuggestionIds.value.includes(s.id) &&
      !ignoredSuggestionIds.value.includes(s.id) &&
      suggestionDiffersFromCurrentMapping(s)
  )

  const failedSuggestionNames: string[] = []

  suggestions.forEach((suggestion) => {
    const matchingAction = availableActions.find(
      (action) => action.id === suggestion.actionId && action.protocol === suggestion.actionProtocol
    )
    if (matchingAction) {
      const buttonKey = suggestion.button as number
      const modifier = suggestion.modifier
      controllerStore.protocolMapping.buttonsCorrespondencies[modifier][buttonKey] = {
        action: matchingAction,
      }

      addAppliedSuggestionId(suggestion.id)
      appliedCount++
    } else {
      failedSuggestionNames.push(suggestion.actionName)
    }
  })

  const groupName = acceptAllGroup.value.name
  acceptAllDialog.value = false
  acceptAllExtensionName.value = null
  acceptAllGroup.value = null

  if (appliedCount > 0) {
    openSnackbar({
      message: `Applied ${appliedCount} joystick mapping(s) from "${groupName}".`,
      variant: 'success',
      duration: 5000,
    })
  }

  if (failedSuggestionNames.length > 0) {
    openSnackbar({
      message: `Could not apply ${failedSuggestionNames.length} mapping(s) from "${groupName}". Please add the necessary actions first.`,
      variant: 'warning',
      duration: 10000,
    })
  }
}

/**
 * Open the joystick suggestion dialog
 * @param {JoystickMapSuggestion} suggestion - The suggestion to apply
 * @param {string} extensionName - Extension name
 */
const openJoystickSuggestionDialog = (suggestion: JoystickMapSuggestion, extensionName: string): void => {
  selectedSuggestion.value = {
    ...suggestion,
    extensionName,
  }
  joystickSuggestionDialog.value = true
}

/**
 * Apply joystick suggestion to the current functions mapping
 */
const applyJoystickSuggestion = (): void => {
  if (!selectedSuggestion.value) return

  const availableActions = allAvailableButtons()
  const matchingAction = availableActions.find(
    (action) =>
      action.id === selectedSuggestion.value!.actionId && action.protocol === selectedSuggestion.value!.actionProtocol
  )

  if (!matchingAction) {
    openSnackbar({
      message: `Could not find a matching action for "${selectedSuggestion.value.actionName}". Please add the action first.`,
      variant: 'warning',
    })
    return
  }

  const buttonKey = selectedSuggestion.value!.button as number
  const modifier = selectedSuggestion.value!.modifier
  controllerStore.protocolMapping.buttonsCorrespondencies[modifier][buttonKey] = {
    action: matchingAction,
  }

  addAppliedSuggestionId(selectedSuggestion.value.id)

  joystickSuggestionDialog.value = false
  openSnackbar({
    message: `Joystick mapping "${selectedSuggestion.value.actionName}" applied successfully.`,
    variant: 'success',
  })
}

/**
 * Add an action to the application
 * @param {ActionConfig} action - The action to add
 */
const addAction = (action: ActionConfig): void => {
  try {
    switch (action.type) {
      case customActionTypes.httpRequest:
        registerHttpRequestActionConfig(action.config as HttpRequestActionConfig, action.id)
        break
      case customActionTypes.mavlinkMessage:
        registerMavlinkMessageActionConfig(action.config as MavlinkMessageActionConfig, action.id)
        break
      case customActionTypes.javascript:
        registerJavascriptActionConfig(action.config as JavascriptActionConfig, action.id)
        break
      default:
        openSnackbar({
          message: `Unknown action type: ${action.type}`,
          variant: 'error',
        })
        return
    }

    // Mark action as applied
    handledActions.value.applied.push(action.id)

    emit('action-added', action)
    openSnackbar({
      message: `Action "${action.name}" has been added successfully!`,
      variant: 'success',
    })
  } catch (error) {
    openSnackbar({
      message: `Failed to add action "${action.name}": ${error}`,
      variant: 'error',
    })
  }
}

/**
 * Re-add a previously applied action that was removed from the app
 * @param {ActionConfig} action - The action to re-add
 */
const reAddAction = (action: ActionConfig): void => {
  addAction(action)
  actionRegistryVersion.value++
}

/**
 * Move an action from the applied list to the ignored list
 * @param {ActionWithExtensionName} action - The action to move
 */
const moveAppliedToIgnored = (action: ActionWithExtensionName): void => {
  handledActions.value.applied = handledActions.value.applied.filter((id) => id !== action.id)
  handledActions.value.ignored.push(action.id)
  openSnackbar({
    message: `Action "${action.name}" moved to ignored.`,
    variant: 'info',
  })
}

/**
 * Ignore an action
 * @param {ActionConfig} action - The action to ignore
 */
const ignoreAction = (action: ActionConfig): void => {
  handledActions.value.ignored.push(action.id)
  openSnackbar({
    message: `Action "${action.name}" has been ignored.`,
    variant: 'info',
  })
}

/**
 * Restore a single ignored action back to the new actions list
 * @param {ActionWithExtensionName} action - The action to restore
 */
const restoreIgnoredAction = (action: ActionWithExtensionName): void => {
  handledActions.value.ignored = handledActions.value.ignored.filter((id) => id !== action.id)
  openSnackbar({
    message: `Action "${action.name}" restored.`,
    variant: 'success',
  })
}

/**
 * Restore all ignored actions back to the new actions list
 */
const restoreAllIgnoredActions = (): void => {
  const count = ignoredActions.value.length
  if (count === 0) return

  const idsToRestore = ignoredActions.value.map((a) => a.id)
  handledActions.value.ignored = handledActions.value.ignored.filter((id) => !idsToRestore.includes(id))
  openSnackbar({
    message: `Restored ${count} ignored action(s).`,
    variant: 'success',
  })
}

/**
 * Restore all ignored suggestions from an extension
 * @param {string} extensionName - Extension name
 */
const restoreAllIgnoredSuggestions = (extensionName: string): void => {
  const extensionGroup = ignoredJoystickSuggestionsByExtension.value.find(
    (group) => group.extensionName === extensionName
  )
  if (!extensionGroup) return

  const suggestionsToRestore = getAllSuggestionsFromExtension(extensionGroup)

  if (suggestionsToRestore.length === 0) return

  removeIgnoredSuggestionIds(suggestionsToRestore.map((suggestion) => suggestion.id))
  openSnackbar({
    message: `Restored ${suggestionsToRestore.length} ignored joystick mappings from ${extensionName}.`,
    variant: 'success',
  })
}

/**
 * Restore a single ignored suggestion
 * @param {JoystickMapSuggestion} suggestion - The suggestion to restore
 */
const restoreIgnoredSuggestion = (suggestion: JoystickMapSuggestion): void => {
  removeIgnoredSuggestionIds([suggestion.id])
  openSnackbar({
    message: `Mapping "${suggestion.actionName}" restored.`,
    variant: 'success',
  })
}

/**
 * Close the modal
 */
const closeModal = (): void => {
  isVisible.value = false
  emit('close')
}

/**
 * Check for available actions from BlueOS.
 */
const checkForBlueOSActions = async (): Promise<void> => {
  try {
    const vehicleAddress = await mainVehicleStore.getVehicleAddress()
    const actionsFromExtensions = await getActionsFromBlueOS(vehicleAddress)

    const actions = actionsFromExtensions.flatMap((extension) =>
      extension.actionConfigs.map((action) => ({
        extensionName: extension.extensionName,
        ...action,
      }))
    )

    discoveredActions.value = actions
  } catch (error) {
    console.error('Failed to fetch actions from BlueOS:', error)
  }
}

/**
 * Check for available joystick suggestions from BlueOS.
 */
const checkForBlueOSJoystickSuggestions = async (): Promise<void> => {
  try {
    const vehicleAddress = await mainVehicleStore.getVehicleAddress()
    const suggestions = await getJoystickSuggestionsFromBlueOS(vehicleAddress)
    discoveredJoystickSuggestions.value = suggestions
  } catch (error) {
    console.error('Failed to fetch joystick suggestions from BlueOS:', error)
  }
}

/**
 * Whether the modal was opened manually by the user (vs auto-opened on mount)
 */
const openedManually = ref(false)

/**
 * Guard to prevent the isVisible watcher from treating an auto-open as manual
 */
let isAutoOpening = false

/**
 * Fetch features from BlueOS without changing modal visibility
 */
const fetchBlueOSFeatures = async (): Promise<void> => {
  await Promise.all([checkForBlueOSActions(), checkForBlueOSJoystickSuggestions()])
}

onMounted(async () => {
  if (!props.autoCheckOnMount) return
  await fetchBlueOSFeatures()
  if (hasPendingBlueOSFeatures.value) {
    isAutoOpening = true
    isVisible.value = true
    if (filteredJoystickSuggestionsByExtension.value.length > 0 && filteredActions.value.length === 0) {
      activeTab.value = 'joystick-suggestions'
    }
  }
})

watch(isVisible, (visible, oldVisible) => {
  if (!visible) {
    openedManually.value = false
    return
  }
  actionRegistryVersion.value++
  if (!oldVisible && !isAutoOpening) {
    openedManually.value = true
    fetchBlueOSFeatures()
  }
  isAutoOpening = false
})

watch(activeTab, () => {
  actionRegistryVersion.value++
})

watch(hasPendingBlueOSFeatures, (hasPending) => {
  if (!hasPending && !openedManually.value) {
    isVisible.value = false
  }
})
</script>

<style scoped>
.features-modal {
  width: 600px;
  transition: width 0.2s ease;
}

.features-modal:has(.v-expansion-panels) {
  width: 760px;
}

.features-modal:has(.v-expansion-panel--active) {
  width: 1100px;
}

.actions-container {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 4px;
}

.actions-container::-webkit-scrollbar {
  width: 6px;
}

.actions-container::-webkit-scrollbar-thumb {
  background: rgba(200, 200, 200, 0.3);
  border-radius: 3px;
}

.action-card {
  margin-top: 10px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.joystick-svg-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 360px;
  height: 220px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
}

.joystick-svg-container-small {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 288 / 176;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
}

.extension-container {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(250, 250, 250, 0.2);
}

.suggestion-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  min-height: 280px;
  transition: all 0.2s ease;
}

.suggestion-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.suggestion-item-compact {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  flex: 1 1 calc(25% - 12px);
  max-width: calc(25% - 12px);
  transition: all 0.2s ease;
}

.suggestion-item-compact:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.suggestion-item-compact .text-center {
  width: 100%;
}

.suggestion-item-compact .text-center h4 {
  word-wrap: break-word;
  hyphens: auto;
}

.suggestion-item-compact .text-center p {
  word-wrap: break-word;
  hyphens: auto;
}
</style>
