<template>
  <GlassModal :is-visible="isVisible" position="center" no-close-on-outside-click @outside-click="requestCloseModal">
    <div class="features-modal p-4 max-w-[95vw]">
      <div class="flex justify-center items-center mb-2">
        <h2 class="text-xl font-semibold">{{ $t('BlueOS Extension Features') }}</h2>
      </div>
      <div class="fixed top-1 right-1">
        <v-btn icon="mdi-close" size="small" variant="text" class="text-lg" @click="requestCloseModal"></v-btn>
      </div>

      <v-tabs v-model="activeTab" class="mb-4">
        <v-tab value="actions" :class="{ 'tab-blink': activeTab !== 'actions' && hasPendingActions }">
          {{ $t('Actions') }}
        </v-tab>
        <v-tab
          value="joystick-suggestions"
          :class="{ 'tab-blink': activeTab !== 'joystick-suggestions' && hasPendingJoystickSuggestions }"
        >
          {{ $t('Joystick Mappings') }}
        </v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeTab">
        <!-- Actions Tab -->
        <v-tabs-window-item value="actions">
          <div class="actions-container">
            <div
              v-if="filteredActions.length === 0 && appliedActions.length === 0 && ignoredActions.length === 0"
              class="text-center py-8"
            >
              <v-icon size="50" class="mb-3 opacity-50">mdi-lightning-bolt-outline</v-icon>
              <p class="opacity-70">
                {{ $t('No actions available from extensions.') }}
              </p>
            </div>

            <div v-else-if="filteredActions.length === 0" class="text-center py-6">
              <v-icon size="40" class="mb-2 opacity-50">mdi-check-circle-outline</v-icon>
              <p class="opacity-70 max-w-[70%] mx-auto">
                {{ $t('No new actions — all extension actions have been reviewed.') }}
              </p>
            </div>

            <!-- New Actions -->
            <div v-if="filteredActions.length > 0" class="mb-4">
              <div class="flex items-center gap-2 mb-2">
                <v-icon size="24">mdi-lightning-bolt-outline</v-icon>
                <h2 class="text-xl font-semibold">{{ $t('New Actions') }}</h2>
              </div>
              <p class="mb-2 opacity-70">
                {{ $t('The following actions are offered to be added by BlueOS extensions:') }}
              </p>
              <v-list class="bg-transparent">
                <v-list-item v-for="action in filteredActions" :key="action.id" class="mb-3 p-0">
                  <v-card variant="outlined" class="w-full action-card">
                    <v-card-item>
                      <v-card-title class="font-medium pb-0">{{ action.name }}</v-card-title>
                      <v-card-subtitle class="opacity-70">
                        {{ getActionTypeName(action.type) }}
                      </v-card-subtitle>
                      <v-card-text v-if="getActionDescription(action)" class="pt-1 text-sm">
                        {{ getActionDescription(action) }}
                      </v-card-text>
                      <div class="flex justify-between items-center my-2">
                        <v-btn
                          class="bg-[#FFFFFF22]"
                          variant="flat"
                          prepend-icon="mdi-close"
                          size="small"
                          @click="ignoreAction(action)"
                        >
                          {{ $t('Ignore') }}
                        </v-btn>
                        <span class="text-xs opacity-70">{{ $t('from {name}', { name: action.extensionName }) }}</span>
                        <v-btn
                          class="bg-[#FFFFFF22]"
                          variant="flat"
                          prepend-icon="mdi-plus-circle-outline"
                          size="small"
                          @click="addAction(action)"
                        >
                          {{ $t('Add Action') }}
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
                :prepend-icon="showAppliedActions ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                size="small"
                @click="showAppliedActions = !showAppliedActions"
              >
                {{ showAppliedActions ? $t('Hide applied actions') : $t('Show applied actions') }}
              </v-btn>
              <div v-if="showAppliedActions" class="mt-2">
                <v-list class="bg-transparent">
                  <v-list-item v-for="action in appliedActions" :key="action.id" class="mb-3 p-0">
                    <v-card variant="outlined" class="w-full">
                      <v-card-item>
                        <v-card-title class="font-medium pb-0">{{ action.name }}</v-card-title>
                        <v-card-subtitle class="opacity-70">
                          {{ getActionTypeName(action.type) }}
                        </v-card-subtitle>
                        <div class="flex justify-between items-center mt-2">
                          <v-chip
                            v-if="existingActionNames.has(action.name)"
                            class="bg-[#FFFFFF22]"
                            variant="flat"
                            prepend-icon="mdi-check"
                            size="small"
                          >
                            {{ $t('Applied') }}
                          </v-chip>
                          <v-chip
                            v-else
                            class="bg-[#FFFFFF22]"
                            variant="flat"
                            prepend-icon="mdi-alert-outline"
                            size="small"
                          >
                            {{ $t('Applied but removed') }}
                          </v-chip>
                          <span class="text-xs opacity-70">{{
                            $t('from {name}', {
                              name: action.extensionName,
                            })
                          }}</span>
                        </div>
                        <div v-if="!existingActionNames.has(action.name)" class="flex justify-center gap-4 my-2">
                          <v-btn
                            class="bg-[#FFFFFF22]"
                            variant="flat"
                            prepend-icon="mdi-close"
                            size="small"
                            @click="moveAppliedToIgnored(action)"
                          >
                            {{ $t('Ignore') }}
                          </v-btn>
                          <v-btn
                            class="bg-[#FFFFFF22]"
                            variant="flat"
                            prepend-icon="mdi-plus-circle-outline"
                            size="small"
                            @click="reAddAction(action)"
                          >
                            {{ $t('Re-add') }}
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
                :prepend-icon="showIgnoredActions ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                size="small"
                @click="showIgnoredActions = !showIgnoredActions"
              >
                {{ showIgnoredActions ? $t('Hide ignored actions') : $t('Show ignored actions') }}
              </v-btn>
              <div v-if="showIgnoredActions" class="mt-2">
                <div class="flex justify-end mb-2">
                  <v-btn
                    class="bg-[#FFFFFF22]"
                    variant="flat"
                    prepend-icon="mdi-restore"
                    size="small"
                    @click="restoreAllIgnoredActions"
                  >
                    {{ $t('Restore All') }}
                  </v-btn>
                </div>
                <v-list class="bg-transparent">
                  <v-list-item v-for="action in ignoredActions" :key="action.id" class="mb-3 p-0">
                    <v-card variant="outlined" class="w-full">
                      <v-card-item>
                        <v-card-title class="font-medium pb-0">{{ action.name }}</v-card-title>
                        <v-card-subtitle class="opacity-70">
                          {{ getActionTypeName(action.type) }}
                        </v-card-subtitle>
                        <div class="flex justify-between items-center my-2">
                          <v-chip class="bg-[#FFFFFF22]" variant="flat" prepend-icon="mdi-close-circle" size="small">
                            {{ $t('Ignored') }}
                          </v-chip>
                          <span class="text-xs opacity-70">{{
                            $t('from {name}', {
                              name: action.extensionName,
                            })
                          }}</span>
                          <v-btn
                            class="bg-[#FFFFFF22]"
                            variant="flat"
                            prepend-icon="mdi-restore"
                            size="small"
                            @click="restoreIgnoredAction(action)"
                          >
                            {{ $t('Restore') }}
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
            <v-icon size="50" class="mb-3 opacity-50">mdi-gamepad-variant-outline</v-icon>
            <p class="opacity-70">
              {{ $t('No joystick mapping suggestions available.') }}
            </p>
          </div>

          <div v-else class="actions-container">
            <div v-if="filteredJoystickSuggestionsByExtension.length === 0" class="text-center py-6">
              <v-icon size="40" class="mb-2 opacity-50">mdi-check-circle-outline</v-icon>
              <p class="opacity-70 max-w-[70%] mx-auto">
                No new suggestions — all joystick mapping suggestions have been reviewed.
              </p>
            </div>

            <!-- New Suggestions Section -->
            <div v-if="filteredJoystickSuggestionsByExtension.length > 0" class="mb-8">
              <div class="flex items-center gap-2 mb-4">
                <v-icon size="24">mdi-gamepad-variant-outline</v-icon>
                <h2 class="text-xl font-semibold">
                  {{ $t('New Suggestions') }}
                </h2>
              </div>
              <p class="mb-2 opacity-70">
                {{ $t('The following joystick mappings are suggested by BlueOS extensions:') }}
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
                      <v-icon size="20">mdi-puzzle-outline</v-icon>
                      <h3 class="text-lg font-semibold">{{ extensionGroup.extensionName }}</h3>
                    </div>
                    <v-btn
                      class="bg-[#FFFFFF22]"
                      variant="flat"
                      prepend-icon="mdi-close-circle-multiple-outline"
                      size="x-small"
                      @click="ignoreRemainingSuggestionsFromExtension(extensionGroup)"
                    >
                      {{ $t('Ignore remaining suggestions') }}
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
                          <v-icon size="16">mdi-folder-outline</v-icon>
                          <span class="text-sm font-semibold opacity-70">{{ group.name }}</span>
                          <v-tooltip v-if="group.description" location="top" max-width="320">
                            <template #activator="{ props: tooltipProps }">
                              <v-icon v-bind="tooltipProps" size="14" class="cursor-help opacity-70">
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
                            class="bg-[#FFFFFF22] mr-2"
                            variant="flat"
                            prepend-icon="mdi-check-all"
                            size="x-small"
                            @click.stop="acceptAllGroupSuggestions(extensionGroup.extensionName, group)"
                          >
                            {{ $t('Accept All') }}
                          </v-btn>
                          <v-btn
                            class="bg-[#FFFFFF22]"
                            variant="flat"
                            prepend-icon="mdi-close-circle-multiple-outline"
                            size="x-small"
                            @click.stop="ignoreAllGroupSuggestions(group)"
                          >
                            {{ $t('Ignore all') }}
                          </v-btn>
                        </div>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <div class="flex flex-wrap gap-2 justify-start">
                          <div
                            v-for="suggestion in group.buttonMappingSuggestions"
                            :key="suggestion.id"
                            class="suggestion-item-compact px-5 py-3 border border-gray-600 rounded-lg bg-gray-800/20 hover:bg-gray-700/30 transition-colors"
                          >
                            <div class="text-center mb-3">
                              <h4 class="font-medium text-white mb-1">{{ suggestion.actionName }}</h4>
                            </div>
                            <div class="flex justify-center mt-auto mb-5">
                              <div class="joystick-svg-container-small">
                                <JoystickButtonIndicator
                                  :button-number="suggestion.button"
                                  :modifier="suggestion.modifier"
                                />
                              </div>
                            </div>
                            <div class="flex w-full justify-between">
                              <v-btn
                                class="bg-[#FFFFFF22]"
                                variant="flat"
                                prepend-icon="mdi-close"
                                size="small"
                                @click="ignoreSuggestion(suggestion)"
                              >
                                {{ $t('Ignore') }}
                              </v-btn>
                              <v-btn
                                class="bg-[#FFFFFF22]"
                                variant="flat"
                                prepend-icon="mdi-plus-circle-outline"
                                size="small"
                                @click="openJoystickSuggestionDialog(suggestion, extensionGroup.extensionName)"
                              >
                                {{ $t('Apply') }}
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
                :prepend-icon="showAppliedMappings ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                size="small"
                @click="showAppliedMappings = !showAppliedMappings"
              >
                {{ showAppliedMappings ? $t('Hide applied mappings') : $t('Show applied mappings') }}
              </v-btn>
            </div>

            <!-- Applied Suggestions Section -->
            <div v-if="showAppliedMappings && appliedJoystickSuggestionsByExtension.length > 0" class="mb-8">
              <div class="flex items-center gap-2 mb-4">
                <v-icon size="24">mdi-check-circle</v-icon>
                <h2 class="text-xl font-semibold">
                  {{ $t('Applied Mappings') }}
                </h2>
              </div>
              <p class="mb-4 opacity-70">
                {{ $t('These joystick mappings have been applied from BlueOS extensions:') }}
              </p>

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
                      <v-icon size="20">mdi-check-circle</v-icon>
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
                          <v-icon size="16">mdi-folder-outline</v-icon>
                          <span class="text-sm font-semibold opacity-70">{{ group.name }}</span>
                          <v-tooltip v-if="group.description" location="top" max-width="320">
                            <template #activator="{ props: tooltipProps }">
                              <v-icon v-bind="tooltipProps" size="14" class="cursor-help opacity-70">
                                mdi-information-outline
                              </v-icon>
                            </template>
                            <span class="text-xs">{{ group.description }}</span>
                          </v-tooltip>
                          <v-chip size="x-small" variant="flat" class="bg-[#FFFFFF22] font-bold">
                            {{ group.buttonMappingSuggestions.length }}
                          </v-chip>
                        </div>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <p v-if="group.description" class="text-sm opacity-70 mb-3">
                          {{ group.description }}
                        </p>
                        <div class="flex flex-wrap gap-4 justify-start pt-2">
                          <div
                            v-for="suggestion in group.buttonMappingSuggestions"
                            :key="suggestion.id"
                            class="suggestion-item-compact px-5 py-3 rounded-lg"
                            :class="
                              suggestionDiffersFromCurrentMapping(suggestion)
                                ? 'border border-orange-500/30 bg-orange-900/10'
                                : 'border border-green-500/30 bg-green-900/10'
                            "
                          >
                            <div class="text-center mb-3">
                              <h4 class="font-medium text-white mb-1">{{ suggestion.actionName }}</h4>
                              <p v-if="suggestion.description" class="text-sm opacity-70">
                                {{ suggestion.description }}
                              </p>
                            </div>
                            <div class="flex justify-center mt-auto mb-5">
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
                                class="bg-[#FFFFFF22]"
                                variant="flat"
                                prepend-icon="mdi-check"
                                size="small"
                              >
                                {{ $t('Applied') }}
                              </v-chip>
                              <v-chip
                                v-else
                                class="bg-[#FFFFFF22]"
                                variant="flat"
                                prepend-icon="mdi-alert-outline"
                                size="small"
                              >
                                {{ $t('Applied but changed') }}
                              </v-chip>
                            </div>
                            <div
                              class="flex justify-center gap-4 mt-5"
                              :class="{ invisible: !suggestionDiffersFromCurrentMapping(suggestion) }"
                            >
                              <v-btn
                                class="bg-[#FFFFFF22]"
                                variant="flat"
                                prepend-icon="mdi-close"
                                size="small"
                                @click="moveAppliedSuggestionToIgnored(suggestion)"
                              >
                                {{ $t('Ignore') }}
                              </v-btn>
                              <v-btn
                                class="bg-[#FFFFFF22]"
                                variant="flat"
                                prepend-icon="mdi-plus-circle-outline"
                                size="small"
                                @click="openJoystickSuggestionDialog(suggestion, extensionGroup.extensionName)"
                              >
                                {{ $t('Re-apply') }}
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
                :prepend-icon="showIgnoredMappings ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                size="small"
                @click="showIgnoredMappings = !showIgnoredMappings"
              >
                {{ showIgnoredMappings ? $t('Hide ignored mappings') : $t('Show ignored mappings') }}
              </v-btn>
            </div>

            <!-- Ignored Suggestions Section -->
            <div v-if="showIgnoredMappings && ignoredJoystickSuggestionsByExtension.length > 0" class="mb-8">
              <div class="flex items-center gap-2 mb-4">
                <v-icon size="24">mdi-close-circle</v-icon>
                <h2 class="text-xl font-semibold">
                  {{ $t('Ignored Mappings') }}
                </h2>
              </div>
              <p class="mb-4 opacity-70">
                {{ $t('These joystick mappings have been ignored:') }}
              </p>

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
                      <v-icon size="20">mdi-close-circle</v-icon>
                      <h3 class="text-lg font-semibold">{{ extensionGroup.extensionName }}</h3>
                    </div>
                    <v-btn
                      class="bg-[#FFFFFF22]"
                      variant="flat"
                      prepend-icon="mdi-restore"
                      size="small"
                      @click="restoreAllIgnoredSuggestions(extensionGroup.extensionName)"
                    >
                      {{ $t('Restore All') }}
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
                          <v-icon size="16">mdi-folder-outline</v-icon>
                          <span class="text-sm font-semibold opacity-70">{{ group.name }}</span>
                          <v-tooltip v-if="group.description" location="top" max-width="320">
                            <template #activator="{ props: tooltipProps }">
                              <v-icon v-bind="tooltipProps" size="14" class="cursor-help opacity-70">
                                mdi-information-outline
                              </v-icon>
                            </template>
                            <span class="text-xs">{{ group.description }}</span>
                          </v-tooltip>
                          <v-chip size="x-small" variant="flat" class="bg-[#FFFFFF22] font-bold">
                            {{ group.buttonMappingSuggestions.length }}
                          </v-chip>
                        </div>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <p v-if="group.description" class="text-sm opacity-70 mb-3">
                          {{ group.description }}
                        </p>
                        <div class="flex flex-wrap gap-4 justify-start pt-2">
                          <div
                            v-for="suggestion in group.buttonMappingSuggestions"
                            :key="suggestion.id"
                            class="suggestion-item-compact px-5 py-3 border border-orange-500/30 rounded-lg bg-orange-900/10"
                          >
                            <div class="text-center mb-3">
                              <h4 class="font-medium text-white mb-1">{{ suggestion.actionName }}</h4>
                              <p v-if="suggestion.description" class="text-sm opacity-70">
                                {{ suggestion.description }}
                              </p>
                            </div>
                            <div class="flex justify-center mt-auto mb-5">
                              <div class="joystick-svg-container-small">
                                <JoystickButtonIndicator
                                  :button-number="suggestion.button"
                                  :modifier="suggestion.modifier"
                                />
                              </div>
                            </div>
                            <div class="flex justify-center">
                              <v-btn
                                class="bg-[#FFFFFF22]"
                                variant="flat"
                                prepend-icon="mdi-restore"
                                size="small"
                                @click="restoreIgnoredSuggestion(suggestion)"
                              >
                                {{ $t('Restore') }}
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
            <h2 class="text-xl font-semibold">
              {{ $t('Apply Joystick Mapping Suggestion') }}
            </h2>
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
                <strong>{{ selectedSuggestion.actionName }}</strong>
                {{
                  $t('from {name}', {
                    name: selectedSuggestion.extensionName,
                  })
                }}
              </p>
              <p v-if="selectedSuggestion.description" class="text-center text-xs text-gray-400 mb-2">
                {{ selectedSuggestion.description }}
              </p>
            </div>

            <div class="space-y-3">
              <div class="rounded-lg border border-gray-600 bg-gray-800/20 p-4">
                <p class="text-center text-xs text-gray-400 mb-2">
                  {{
                    $t('Button {button} ({modifier})', {
                      button: selectedSuggestion.button,
                      modifier: selectedSuggestion.modifier,
                    })
                  }}
                </p>
                <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div class="text-center">
                    <p class="text-xs text-gray-400 mb-1">
                      {{ $t('Current mapping') }}
                    </p>
                    <p class="font-medium text-gray-200">{{ selectedSuggestionCurrentActionName }}</p>
                  </div>
                  <v-icon size="20" color="green">mdi-arrow-right</v-icon>
                  <div class="text-center">
                    <p class="text-xs text-gray-400 mb-1">
                      {{ $t('New mapping') }}
                    </p>
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
            <v-btn variant="text" @click="joystickSuggestionDialog = false">{{ $t('Cancel') }}</v-btn>
            <v-btn @click="applyJoystickSuggestion">{{ $t('Apply') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Accept All Suggestions Dialog -->
      <v-dialog v-model="acceptAllDialog" max-width="500px">
        <v-card v-if="acceptAllGroup" class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
          <v-card-title class="text-center pt-4 pb-0">
            <h2 class="text-xl font-semibold">
              {{ $t('Accept All Suggestions') }}
            </h2>
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
                {{
                  $t('Accept all {count} suggestions from {name} ({extension})?', {
                    count: acceptAllGroupSuggestionCount,
                    name: acceptAllGroup.name,
                    extension: acceptAllExtensionName,
                  })
                }}
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
            <v-btn variant="text" @click="acceptAllDialog = false">{{ $t('Cancel') }}</v-btn>
            <v-btn :disabled="acceptAllGroupSuggestionCount === 0" @click="applyAllSuggestions">{{
              $t('Apply All')
            }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Close Confirmation Dialog -->
      <v-dialog v-model="closeConfirmationDialog" max-width="500px">
        <v-card class="rounded-lg" :style="interfaceStore.globalGlassMenuStyles">
          <v-card-title class="text-center pt-4 pb-0">
            <div class="flex items-center justify-center gap-2">
              <v-icon color="warning" size="24">mdi-alert</v-icon>
              <h2 class="text-xl font-semibold">{{ $t('Pending Extension Features') }}</h2>
            </div>
          </v-card-title>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            class="absolute top-2 right-2 text-lg"
            @click="closeConfirmationDialog = false"
          ></v-btn>

          <v-card-text class="px-6 pb-4">
            <p class="text-center text-sm text-gray-300 mb-4">
              {{
                $t(
                  'There are still extension features pending your decision. Please accept or ignore each suggestion from your BlueOS extensions. Otherwise, this dialog will open automatically again the next time you start Cockpit.'
                )
              }}
            </p>

            <div class="max-h-[260px] overflow-y-auto pr-1 space-y-3">
              <div v-if="filteredActions.length > 0">
                <div class="flex items-center gap-2 mb-1">
                  <v-icon size="16">mdi-lightning-bolt-outline</v-icon>
                  <h3 class="text-sm font-semibold">
                    {{ $t('Pending actions ({n})', { n: filteredActions.length }) }}
                  </h3>
                </div>
                <ul class="list-disc list-inside text-xs text-gray-300 space-y-0.5">
                  <li v-for="action in filteredActions" :key="action.id">
                    {{ action.name }} <span class="opacity-60">— {{ $t('from') }} {{ action.extensionName }}</span>
                  </li>
                </ul>
              </div>

              <div v-if="pendingJoystickSuggestions.length > 0">
                <div class="flex items-center gap-2 mb-1">
                  <v-icon size="16">mdi-gamepad-variant-outline</v-icon>
                  <h3 class="text-sm font-semibold">
                    {{ $t('Pending joystick mappings ({n})', { n: pendingJoystickSuggestions.length }) }}
                  </h3>
                </div>
                <ul class="list-disc list-inside text-xs text-gray-300 space-y-0.5">
                  <li v-for="item in pendingJoystickSuggestions" :key="item.id">
                    {{ item.actionName }} <span class="opacity-60">— {{ $t('from') }} {{ item.extensionName }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </v-card-text>

          <div class="flex justify-center w-full px-6 pb-2">
            <v-divider style="border-color: #ffffff14"></v-divider>
          </div>

          <v-card-actions class="px-6 pb-4 justify-space-between">
            <v-btn variant="text" @click="confirmCloseModal">{{ $t('Close anyway') }}</v-btn>
            <v-btn @click="closeConfirmationDialog = false">{{ $t('Keep reviewing') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </GlassModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
 * Whether there are new actions pending user action
 */
const hasPendingActions = computed(() => filteredActions.value.length > 0)

/**
 * Whether there are new joystick suggestions pending user action
 */
const hasPendingJoystickSuggestions = computed(() => filteredJoystickSuggestionsByExtension.value.length > 0)

/**
 * Whether there are new extension features that still need user action
 */
const hasPendingBlueOSFeatures = computed(() => {
  return hasPendingActions.value || hasPendingJoystickSuggestions.value
})

/**
 * Flat list of pending joystick suggestions with their extension names
 */
const pendingJoystickSuggestions = computed((): JoystickSuggestionWithExtensionName[] => {
  return filteredJoystickSuggestionsByExtension.value.flatMap((ext) =>
    ext.suggestionGroups.flatMap((group) =>
      group.buttonMappingSuggestions.map((suggestion) => ({
        ...suggestion,
        extensionName: ext.extensionName,
      }))
    )
  )
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
  logUserAction('Applied all discovered joystick mapping suggestions')

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
  logUserAction('Applied a discovered joystick mapping suggestion')

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
  logUserAction(`Added discovered action '${action.name}'`)
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
  logUserAction(`Ignored discovered action '${action.name}'`)
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
  logUserAction(`Restored ignored action '${action.name}'`)
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
  logUserAction('Restored all ignored discovered actions')

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
 * Controls visibility of the close confirmation dialog
 */
const closeConfirmationDialog = ref(false)

/**
 * Close the modal
 */
const closeModal = (): void => {
  isVisible.value = false
  emit('close')
}

/**
 * Request to close the modal. If there are still pending items to decide upon, ask the user to confirm first.
 */
const requestCloseModal = (): void => {
  if (hasPendingBlueOSFeatures.value) {
    closeConfirmationDialog.value = true
    return
  }
  closeModal()
}

/**
 * Confirm closing the modal from the confirmation dialog
 */
const confirmCloseModal = (): void => {
  closeConfirmationDialog.value = false
  closeModal()
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
 * Guard to prevent the isVisible watcher from re-fetching when auto-opened on mount
 */
let isAutoOpening = false

/**
 * Whether the modal has already been auto-opened in this session, so transient
 * vehicle reconnections don't re-pop the modal after the user has dismissed it.
 */
let hasAutoOpened = false

/**
 * Fetch features from BlueOS without changing modal visibility
 */
const fetchBlueOSFeatures = async (): Promise<void> => {
  await Promise.all([checkForBlueOSActions(), checkForBlueOSJoystickSuggestions()])
}

/**
 * Auto-open the modal if there are pending features and it has not been auto-opened yet
 */
const autoOpenIfPending = (): void => {
  if (hasAutoOpened || !hasPendingBlueOSFeatures.value) return
  hasAutoOpened = true
  isAutoOpening = true
  isVisible.value = true
  if (filteredJoystickSuggestionsByExtension.value.length > 0 && filteredActions.value.length === 0) {
    activeTab.value = 'joystick-suggestions'
  }
}

// Wait for settings sync before auto-opening; vehicle-online alone can show stale pending state.
const onVehicleSyncComplete = async (): Promise<void> => {
  if (!props.autoCheckOnMount) return
  await fetchBlueOSFeatures()
  autoOpenIfPending()
}

onMounted(() => {
  if (!props.autoCheckOnMount) return
  window.addEventListener('vehicle-sync-complete', onVehicleSyncComplete)
})

onBeforeUnmount(() => {
  window.removeEventListener('vehicle-sync-complete', onVehicleSyncComplete)
})

watch(isVisible, (visible, oldVisible) => {
  if (!visible) return
  actionRegistryVersion.value++
  if (!oldVisible && !isAutoOpening) {
    fetchBlueOSFeatures()
  }
  isAutoOpening = false
})

watch(activeTab, () => {
  actionRegistryVersion.value++
})
</script>

<style scoped>
.features-modal {
  width: 600px;
  transition: width 0.2s ease;
}

.tab-blink {
  position: relative;
}

.tab-blink::before {
  content: '';
  position: absolute;
  inset: 0;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  background-color: #ffffff22;
  animation: tab-blink 1.2s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

@keyframes tab-blink {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
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
