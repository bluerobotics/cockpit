<template>
  <v-dialog v-model="isVisible" class="dialog">
    <div class="flex">
      <div class="video-modal" :style="interfaceStore.globalGlassMenuStyles">
        <div class="modal-content">
          <!-- Left Vertical Menu -->
          <div class="flex flex-col justify-between h-full px-5 py-3 align-center">
            <div class="flex flex-col justify-between pt-2 align-center gap-y-8">
              <button
                v-for="button in menuButtons"
                :key="button.name"
                :disabled="button.disabled"
                class="flex flex-col justify-center align-center"
                @click="currentTab = button.name.toLowerCase()"
              >
                <v-tooltip v-if="button.tooltip !== ''" open-delay="600" activator="parent" location="top">
                  {{ button.tooltip }}
                </v-tooltip>
                <div
                  class="mb-1 text-2xl rounded-full"
                  :class="[
                    button.disabled ? 'frosted-button-disabled' : 'frosted-button',
                    currentTab === button.name.toLowerCase() ? 'w-[58px] h-[58px]' : 'w-[40px] h-[40px]',
                  ]"
                >
                  <v-icon
                    :size="currentTab === button.name.toLowerCase() ? 40 : 24"
                    :class="{ 'ml-1': button.name.toLowerCase() === 'videos' }"
                  >
                    {{ button.icon }}
                  </v-icon>
                </div>
                <div class="text-sm" :class="{ 'text-white/30': !button.disabled }">
                  {{ button.name }}
                </div>
              </button>
            </div>
            <div>
              <div class="flex flex-col justify-center py-2 mb-[10px] align-center">
                <button
                  class="frosted-button text-[#ffffffaa] flex flex-col justify-center align-center w-[28px] h-[28px] rounded-full mb-[4px]"
                  @click="showHelpTooltip = !showHelpTooltip"
                >
                  <v-icon class="text-[24px]">mdi-help-circle-outline</v-icon>
                  <v-tooltip
                    v-model="showHelpTooltip"
                    :open-on-hover="false"
                    activator="parent"
                    location="top"
                    arrow
                    content-class="border-[#ffffff55] border-2"
                    @click:outside="showHelpTooltip = false"
                  >
                    <div class="flex flex-col p-2 gap-y-2">
                      <div>
                        <strong>Computer:</strong> Command+click, Ctrl+click or Long click to select multiple videos.
                      </div>

                      <div><strong>Mobile:</strong> Long press to select multiple videos.</div>
                      <div class="flex flex-row mt-4 gap-x-10">
                        <div class="ml-[-8px]">
                          <v-icon size="10" class="text-green-500 ml-2 mb-[2px] mr-1">mdi-circle</v-icon> Processed MP4
                        </div>
                        <div><v-icon size="10" class="text-orange-500 mb-[2px] mr-1">mdi-circle</v-icon> Raw WebM</div>
                      </div>
                    </div>
                  </v-tooltip>
                </button>
              </div>
              <v-divider class="opacity-[0.1] ml-[-5px] w-[120%]"></v-divider>
              <button class="flex flex-col justify-center py-2 mt-4 align-center" @click="closeModal">
                <div
                  class="frosted-button flex flex-col justify-center align-center w-[28px] h-[28px] rounded-full mb-1"
                >
                  <v-icon class="text-[18px]">mdi-close</v-icon>
                </div>
                <div class="text-sm">Close</div>
              </button>
            </div>
          </div>
          <v-divider vertical class="h-[92%] mt-4 opacity-[0.1]"></v-divider>
          <!-- Right Content -->
          <template v-if="currentTab === 'snapshots'">
            <div v-if="availablePictures.length > 0" class="flex flex-col justify-start py-6 px-4 flex-1 h-full">
              <div
                class="grid gap-4 overflow-y-auto w-full h-full px-2 content-start"
                style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))"
              >
                <div
                  v-for="picture in availablePictures"
                  :key="picture.filename"
                  class="relative"
                  @click="onPictureClick(picture.filename)"
                >
                  <div
                    :class="[
                      'w-[178px] aspect-video overflow-hidden',
                      'border-4 border-white rounded-md cursor-pointer transition duration-75 ease-in',
                      selectedPicSet.has(picture.filename) ? 'border-opacity-40' : 'border-opacity-10',
                    ]"
                  >
                    <img
                      v-if="picture.thumbnail"
                      :src="(picture as any).thumbUrl"
                      class="w-full h-full object-cover"
                      alt="Picture thumbnail"
                    />
                    <div reactive class="fullscreen-button" @click="openPicInFullScreen(picture)">
                      <v-icon size="40" class="text-white"> mdi-fullscreen </v-icon>
                    </div>
                    <div reactive class="delete-button" @click="handleDeletePictures(picture)">
                      <v-icon size="16" class="text-white"> mdi-delete </v-icon>
                    </div>
                    <div reactive class="download-button" @click="downloadPictures(picture.filename)">
                      <v-icon size="16" class="text-white"> mdi-download </v-icon>
                    </div>
                    <div
                      v-if="isMultipleSelectionMode"
                      class="checkmark-button"
                      :class="selectedPicSet.has(picture.filename) ? 'bg-green' : 'bg-white'"
                      @click.stop="togglePictureIntoSelectionArray(picture.filename)"
                    >
                      <v-icon size="15" class="text-white">
                        {{ selectedPicSet.has(picture.filename) ? 'mdi-check-circle-outline' : 'mdi-radiobox-blank' }}
                      </v-icon>
                    </div>
                  </div>
                  <div class="flex justify-center mt-1 text-xs text-white/80 truncate">
                    <v-tooltip open-delay="300" activator="parent" location="top">
                      {{ picture.filename }}
                    </v-tooltip>
                    {{ picture.filename }}
                  </div>
                </div>
              </div>
              <div
                v-if="availablePictures.length > 1"
                class="flex flex-row align-center justify-between h-[40px] w-full mb-[-19px] border-t-[1px] border-t-[#ffffff06]"
              >
                <div>
                  <v-btn variant="text" size="small" class="mt-[5px]" @click="toggleSelectionMode">
                    <v-tooltip open-delay="500" activator="parent" location="bottom">
                      Select {{ isMultipleSelectionMode ? 'single' : 'multiple' }} files
                    </v-tooltip>
                    {{ isMultipleSelectionMode ? 'Single selection' : 'Multi selection' }}
                  </v-btn>
                  <v-btn
                    variant="text"
                    size="small"
                    class="mt-[5px]"
                    @click="
                      selectedPicSet.size === availablePictures.length ? deselectAllPictures() : selectAllPictures()
                    "
                  >
                    <v-tooltip open-delay="500" activator="parent" location="bottom">
                      Select {{ selectedPicSet.size === availablePictures.length ? 'none' : 'all files' }}
                    </v-tooltip>
                    {{ selectedPicSet.size === availablePictures.length ? 'None' : 'All' }}
                  </v-btn>
                </div>
                <div>
                  <v-btn
                    variant="text"
                    size="small"
                    class="mt-[5px]"
                    :disabled="selectedPictures.length === 0"
                    @click="downloadPictures()"
                  >
                    Download
                  </v-btn>
                  <v-btn
                    variant="text"
                    size="small"
                    class="mt-[5px] ml-2"
                    :disabled="selectedPictures.length === 0"
                    @click="handleDeletePictures()"
                  >
                    Delete
                  </v-btn>
                </div>
              </div>
            </div>
            <div v-else class="flex justify-center items-center w-full h-full text-xl text-center">
              {{ loadingData ? 'Loading' : 'No pictures found' }}
            </div>
          </template>
          <template v-if="currentTab === 'videos'">
            <!-- Videos Tab with Sub-tabs -->
            <div class="flex flex-col h-full w-full">
              <!-- Sub-tabs Navigation -->
              <div class="px-4 pt-2 pb-2">
                <v-tabs v-model="currentVideoSubTab" color="white" fixed-tabs class="video-sub-tabs">
                  <v-tab
                    v-for="tab in videoSubTabs"
                    :key="tab.name"
                    :value="tab.name"
                    :disabled="tab.disabled"
                    class="text-white"
                  >
                    <v-tooltip v-if="tab.tooltip" open-delay="600" activator="parent" location="top">
                      {{ tab.tooltip }}
                    </v-tooltip>
                    <v-icon class="mr-2" size="18">{{ tab.icon }}</v-icon>
                    {{ tab.label }}
                  </v-tab>
                </v-tabs>
              </div>

              <!-- Sub-tab Content -->
              <div class="flex-1 overflow-hidden">
                <!-- Final Videos Tab (Electron only) -->
                <template v-if="currentVideoSubTab === 'processed'">
                  <div class="flex flex-col h-full">
                    <div class="mx-5 pt-4">
                      <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium">Processed Videos</h3>
                        <div class="flex items-center gap-4">
                          <span class="text-sm text-white/70">Final videos with telemetry overlay</span>
                        </div>
                      </div>
                    </div>

                    <!-- Scrollable Videos List -->
                    <div v-if="availableVideos.length > 0" class="flex-1 overflow-y-auto px-4 py-2">
                      <div class="space-y-3">
                        <div
                          v-for="video in availableVideos"
                          :id="`video-library-thumbnail-${video.fileName}`"
                          :key="video.fileName"
                          class="flex items-center p-4 rounded-lg transition-colors cursor-pointer"
                          :class="getVideoCardClasses(video)"
                        >
                          <!-- Thumbnail -->
                          <div class="w-24 h-16 rounded-md overflow-hidden bg-black flex-shrink-0">
                            <img
                              v-if="videoThumbnailURLs[video.fileName]"
                              :src="videoThumbnailURLs[video.fileName] || undefined"
                              class="w-full h-full object-cover"
                            />
                            <div v-else class="w-full h-full flex justify-center items-center">
                              <v-icon size="32" class="text-white/30">mdi-video</v-icon>
                            </div>
                          </div>

                          <!-- Video Info -->
                          <div class="flex-1 ml-4">
                            <div class="font-medium text-white">
                              {{ parseDateFromTitle(video.fileName) || 'Cockpit video' }}
                            </div>
                            <div class="text-sm text-white/70 mt-1">
                              {{ video.fileName }}
                            </div>
                            <div class="flex items-center mt-1">
                              <v-icon
                                size="10"
                                :class="
                                  video.isProcessed
                                    ? 'text-green-500'
                                    : isRecordingOngoing()
                                    ? 'text-yellow-300 animate-pulse'
                                    : 'text-orange-500'
                                "
                                >mdi-circle</v-icon
                              >
                              <span class="text-xs text-white/60 ml-1">
                                {{
                                  video.isProcessed
                                    ? 'Processed'
                                    : isRecordingOngoing()
                                    ? 'Recording ongoing'
                                    : 'Raw format'
                                }}
                              </span>
                            </div>
                          </div>

                          <!-- Action Buttons -->
                          <div class="flex items-center gap-2 ml-4">
                            <v-btn
                              icon
                              variant="outlined"
                              size="small"
                              @click.stop="playVideoInDefaultPlayer(video.fileName)"
                            >
                              <v-tooltip open-delay="500" activator="parent" location="bottom"> Play video </v-tooltip>
                              <v-icon size="22">mdi-play</v-icon>
                            </v-btn>
                            <v-btn
                              icon
                              variant="outlined"
                              size="small"
                              :disabled="isPreparingDownload"
                              @click.stop="handleDeleteVideos([video])"
                            >
                              <v-tooltip open-delay="500" activator="parent" location="bottom">
                                Delete video
                              </v-tooltip>
                              <v-icon>mdi-delete</v-icon>
                            </v-btn>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Fixed Bottom Controls -->
                    <div
                      v-if="availableVideos.length > 0"
                      class="flex justify-between items-center px-4 py-3 border-t border-white/10"
                    >
                      <div class="flex items-center gap-2">
                        <v-btn variant="text" size="small" @click="toggleSelectionMode">
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Select {{ isMultipleSelectionMode ? 'single' : 'multiple' }} files
                          </v-tooltip>
                          {{ isMultipleSelectionMode ? 'Single' : 'Multi' }}
                        </v-btn>
                        <v-btn
                          variant="text"
                          size="small"
                          @click="
                            selectedVideos.length === availableVideos.length ? deselectAllVideos() : selectAllVideos()
                          "
                        >
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Select {{ selectedVideos.length === availableVideos.length ? 'none' : 'all files' }}
                          </v-tooltip>
                          {{ selectedVideos.length === availableVideos.length ? 'None' : 'All' }}
                        </v-btn>
                      </div>

                      <!-- Action Buttons -->
                      <div class="flex items-center gap-2">
                        <!-- Selection Count Text -->
                        <span v-if="selectedVideos.length > 1" class="text-sm text-white/70">
                          {{ selectedVideos.length }} videos selected
                        </span>

                        <!-- Delete Selected Button (only visible when multiple videos selected) -->
                        <v-btn
                          v-if="selectedVideos.length > 1"
                          icon
                          variant="outlined"
                          size="small"
                          :disabled="isPreparingDownload"
                          @click="handleDeleteVideos(selectedVideos)"
                        >
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Delete {{ selectedVideos.length }} selected videos
                          </v-tooltip>
                          <v-icon>mdi-delete</v-icon>
                        </v-btn>

                        <!-- Open Folder Button (always visible) -->
                        <v-btn icon variant="outlined" size="small" @click="openVideoFolder">
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Open videos folder
                          </v-tooltip>
                          <v-icon>mdi-folder-open-outline</v-icon>
                        </v-btn>
                      </div>
                    </div>

                    <!-- No Videos Message with Open Folder Button -->
                    <div v-else class="flex flex-col h-full">
                      <!-- Empty State Message -->
                      <div class="flex justify-center items-center flex-1 text-xl text-center">
                        {{ loadingData ? 'Loading' : 'No videos on storage' }}
                      </div>

                      <!-- Fixed Bottom Controls (always visible) -->
                      <div class="flex justify-end items-center px-4 py-3 border-t border-white/10">
                        <v-btn icon variant="outlined" size="small" @click="openVideoFolder">
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Open videos folder
                          </v-tooltip>
                          <v-icon>mdi-folder-outline</v-icon>
                        </v-btn>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Raw Tab -->
                <template v-if="currentVideoSubTab === 'raw'">
                  <div v-if="!isElectron()" class="flex flex-col h-full">
                    <!-- Fixed Header with Expandable Instructions -->
                    <div class="px-4 pt-6 pb-3">
                      <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium">Raw Video Chunks</h3>
                        <div
                          class="flex items-center gap-2 cursor-pointer"
                          @click="isInstructionsExpanded = !isInstructionsExpanded"
                        >
                          <span class="text-sm text-white/70">Browser Version Instructions</span>
                          <v-icon
                            class="text-white/70 transition-transform duration-200"
                            :class="{ 'rotate-180': isInstructionsExpanded }"
                            size="20"
                          >
                            mdi-chevron-down
                          </v-icon>
                        </div>
                      </div>

                      <!-- Expandable Instructions Content -->
                      <v-expand-transition>
                        <div
                          v-show="isInstructionsExpanded"
                          class="mb-4 p-4 border border-white/20 rounded-lg bg-white/5"
                        >
                          <div class="flex items-start gap-3">
                            <v-icon class="text-white/70 mt-1">mdi-information</v-icon>
                            <div class="text-white/80 text-sm space-y-1">
                              <p>
                                These are raw video chunks that need to be processed. The processing can be done
                                exclusively in the standalone version of Cockpit. The browser version can only record
                                the video chunks.
                              </p>
                              <div>
                                <p class="font-medium mb-2">To process your videos:</p>
                                <ol class="space-y-0">
                                  <li class="flex items-start gap-2">
                                    <span class="text-white font-bold">1.</span>
                                    <span>Download your video chunks using the download buttons</span>
                                  </li>
                                  <li class="flex items-start gap-2">
                                    <span class="text-white font-bold">2.</span>
                                    <span>Open the standalone version of Cockpit (desktop app)</span>
                                  </li>
                                  <li class="flex items-start gap-2">
                                    <span class="text-white font-bold">3.</span>
                                    <span>Go to the "Processing" tab in the video library</span>
                                  </li>
                                  <li class="flex items-start gap-2">
                                    <span class="text-white font-bold">4.</span>
                                    <span>Select and process your downloaded ZIP files</span>
                                  </li>
                                  <li class="flex items-start gap-2">
                                    <span class="text-white font-bold">5.</span>
                                    <span>Once sure the video is processed, delete the raw video chunks from here</span>
                                  </li>
                                </ol>
                              </div>
                            </div>
                          </div>
                        </div>
                      </v-expand-transition>
                    </div>

                    <!-- Scrollable Content -->
                    <div v-if="chunkGroups.length > 0" class="flex-1 overflow-y-auto px-4">
                      <div
                        v-for="group in chunkGroups"
                        :key="group.hash"
                        class="mb-2 px-4 py-2 border border-white/20 rounded-lg bg-white/5"
                      >
                        <div class="flex justify-between items-start mb-2">
                          <div class="flex-1">
                            <div class="font-medium text-white">{{ group.fileName || group.hash }}</div>
                            <div class="text-sm text-white/70 mt-1">
                              {{ formatDate(group.firstChunkDate) }}
                            </div>
                            <div class="text-sm text-white/50 mt-1">
                              {{ group.chunkCount }} chunks • ~{{ group.estimatedDuration }}s duration •
                              {{ formatBytes(group.totalSize) }}
                            </div>
                          </div>
                          <div class="flex gap-2 mt-5">
                            <v-btn
                              icon
                              variant="outlined"
                              size="small"
                              :disabled="isProcessingChunks"
                              @click="downloadChunkGroup(group)"
                            >
                              <v-tooltip open-delay="500" activator="parent" location="bottom">
                                Download chunk group
                              </v-tooltip>
                              <v-icon>mdi-download</v-icon>
                            </v-btn>
                            <v-btn
                              icon
                              variant="outlined"
                              size="small"
                              :disabled="isProcessingChunks"
                              @click="deleteChunkGroup(group)"
                            >
                              <v-tooltip open-delay="500" activator="parent" location="bottom">
                                Delete chunk group
                              </v-tooltip>
                              <v-icon>mdi-delete</v-icon>
                            </v-btn>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Empty State -->
                    <div v-else class="flex flex-col justify-center items-center flex-1 text-center px-4">
                      <div class="max-w-md mx-auto">
                        <template v-if="chunkLoadingData">
                          <v-progress-circular indeterminate color="white" size="60" width="3" class="mb-4" />
                          <h4 class="text-lg font-medium text-white mb-2">Loading Video Chunks</h4>
                          <p class="text-white/70 text-sm">Counting chunks and calculating sizes...</p>
                        </template>
                        <template v-else>
                          <v-icon size="60" class="text-white/30 mb-4">mdi-folder-multiple-outline</v-icon>
                          <h4 class="text-lg font-medium text-white mb-2">No Video Chunks Found</h4>
                          <p class="text-white/70 text-sm">
                            Start recording videos to create chunks that can be downloaded.
                          </p>
                        </template>
                      </div>
                    </div>

                    <!-- Fixed Bottom Controls (always visible) -->
                    <div class="flex justify-end items-center gap-4 px-4 py-3 border-t border-white/10">
                      <span class="text-sm text-white/70">Total: {{ formatBytes(totalChunkSize) }}</span>
                      <v-btn
                        icon
                        variant="outlined"
                        size="small"
                        :disabled="isProcessingChunks"
                        @click="deleteAllChunks"
                      >
                        <v-tooltip open-delay="500" activator="parent" location="bottom">
                          Delete all raw chunks
                        </v-tooltip>
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>
                    </div>
                  </div>

                  <!-- Electron Version -->
                  <div v-else class="flex flex-col h-full">
                    <div v-if="chunkGroups.length > 0" class="flex flex-col h-full">
                      <!-- Fixed Header -->
                      <div class="mx-5 pt-4">
                        <div class="flex justify-between items-center mb-4">
                          <h3 class="text-lg font-medium">Raw Video Chunks</h3>
                          <div class="flex items-center gap-4">
                            <span class="text-sm text-white/70">Backup raw data</span>
                          </div>
                        </div>
                      </div>

                      <!-- Scrollable Content -->
                      <div class="flex-1 overflow-y-auto px-4">
                        <div
                          v-for="group in chunkGroups"
                          :key="group.hash"
                          class="mb-2 px-4 pt-3 pb-1 border border-white/20 rounded-lg bg-white/5"
                        >
                          <div class="flex justify-between items-start mb-2">
                            <div class="flex-1">
                              <div class="font-medium text-white">{{ group.fileName || group.hash }}</div>
                              <div class="text-sm text-white/70 mt-1">
                                {{ formatDate(group.firstChunkDate) }}
                              </div>
                              <div class="text-sm text-white/50 mt-1">
                                {{ group.chunkCount }} chunks • ~{{ group.estimatedDuration }}s duration •
                                {{ formatBytes(group.totalSize) }}
                              </div>
                            </div>
                            <div class="flex gap-2 mt-4">
                              <v-btn
                                icon
                                variant="outlined"
                                size="small"
                                :disabled="isProcessingChunks"
                                @click="processChunkGroup(group)"
                              >
                                <v-tooltip open-delay="500" activator="parent" location="bottom">
                                  Process video chunks
                                </v-tooltip>
                                <v-icon>mdi-file-cog</v-icon>
                              </v-btn>
                              <v-btn
                                icon
                                variant="outlined"
                                size="small"
                                :disabled="isProcessingChunks"
                                @click="downloadChunkGroup(group)"
                              >
                                <v-tooltip open-delay="500" activator="parent" location="bottom">
                                  Download chunk group as ZIP
                                </v-tooltip>
                                <v-icon>mdi-download</v-icon>
                              </v-btn>
                              <v-btn
                                icon
                                variant="outlined"
                                size="small"
                                :disabled="isProcessingChunks"
                                @click="deleteChunkGroup(group)"
                              >
                                <v-tooltip open-delay="500" activator="parent" location="bottom">
                                  Delete chunk group
                                </v-tooltip>
                                <v-icon>mdi-delete</v-icon>
                              </v-btn>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Fixed Bottom Controls -->
                      <div class="flex justify-end items-center gap-4 px-4 py-3 border-t border-white/10">
                        <span class="text-sm text-white/70">Total: {{ formatBytes(totalChunkSize) }}</span>
                        <v-btn
                          icon
                          variant="outlined"
                          size="small"
                          :disabled="isProcessingChunks"
                          @click="deleteAllChunks"
                        >
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Delete all raw chunks
                          </v-tooltip>
                          <v-icon>mdi-delete</v-icon>
                        </v-btn>
                        <v-btn icon variant="outlined" size="small" @click="openVideoChunksFolder">
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Open raw chunks folder
                          </v-tooltip>
                          <v-icon>mdi-folder-open-outline</v-icon>
                        </v-btn>
                      </div>
                    </div>

                    <!-- Empty State -->
                    <div v-else class="flex flex-col h-full">
                      <!-- Empty State Message -->
                      <div class="flex flex-col justify-center items-center flex-1 text-center px-4">
                        <div class="max-w-md mx-auto">
                          <template v-if="chunkLoadingData">
                            <v-progress-circular indeterminate color="white" size="60" width="3" class="mb-4" />
                            <h4 class="text-lg font-medium text-white mb-2">Loading Video Chunks</h4>
                            <p class="text-white/70 text-sm">Counting chunks and calculating sizes...</p>
                          </template>
                          <template v-else>
                            <v-icon size="60" class="text-white/30 mb-4">mdi-folder-multiple-outline</v-icon>
                            <h4 class="text-lg font-medium text-white mb-2">No Raw Chunks Found</h4>
                            <p class="text-white/70 text-sm">Start recording videos to create raw chunks.</p>
                          </template>
                        </div>
                      </div>

                      <!-- Fixed Bottom Controls (always visible) -->
                      <div class="flex justify-end items-center px-4 py-3 border-t border-white/10">
                        <v-btn icon variant="outlined" size="small" @click="openVideoChunksFolder">
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Open raw chunks folder
                          </v-tooltip>
                          <v-icon>mdi-folder-open-outline</v-icon>
                        </v-btn>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Processing Tab (Electron only) -->
                <template v-if="currentVideoSubTab === 'processing'">
                  <div class="flex flex-col h-full">
                    <!-- Processing Container (Top) -->
                    <div class="flex-1 overflow-y-auto px-4 py-6">
                      <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium">Process ZIP Files</h3>
                        <div class="flex items-center gap-4">
                          <span class="text-sm text-white/70">Process raw chunks from Cockpit Lite (web version)</span>
                        </div>
                      </div>

                      <!-- Processing Status -->
                      <div v-if="isProcessingZip" class="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-4">
                        <div class="flex items-center gap-3 mb-3">
                          <v-progress-circular indeterminate color="blue" size="24" width="2" />
                          <span class="text-blue-200 font-medium">Processing ZIP file...</span>
                        </div>
                        <div class="text-blue-100 text-sm">
                          {{ zipProcessingMessage }}
                        </div>
                        <v-progress-linear
                          :model-value="zipProcessingProgress"
                          color="blue"
                          height="8"
                          rounded
                          class="mt-3"
                        />
                        <div class="text-blue-200 text-xs mt-2">{{ zipProcessingProgress }}%</div>
                      </div>

                      <!-- Processing Complete Status -->
                      <div
                        v-if="zipProcessingComplete"
                        class="bg-green-900/30 border border-green-500/30 rounded-lg p-4 mb-4"
                      >
                        <div class="flex items-center gap-3 mb-3">
                          <v-icon color="green" size="24">mdi-check-circle</v-icon>
                          <span class="text-green-200 font-medium">Processing Complete!</span>
                        </div>
                        <div class="text-green-100 text-sm">
                          The ZIP file has been successfully processed. The video is now available in the Videos tab.
                        </div>
                        <div class="mt-4 flex gap-2">
                          <v-btn variant="outlined" size="small" @click="processAnotherZip">
                            <v-icon class="mr-2">mdi-plus</v-icon>
                            Process Another ZIP File
                          </v-btn>
                          <v-btn variant="outlined" size="small" @click="currentVideoSubTab = 'processed'">
                            <v-icon class="mr-2">mdi-video</v-icon>
                            View Videos
                          </v-btn>
                        </div>
                      </div>

                      <!-- ZIP File Selection and Processing -->
                      <div
                        v-if="!isProcessingZip && !zipProcessingComplete"
                        class="bg-slate-800/50 border border-slate-600/30 rounded-lg p-4 mb-4"
                      >
                        <div class="text-center">
                          <v-icon size="48" class="text-slate-400 mb-3">mdi-zip-box</v-icon>
                          <h4 class="text-lg font-medium text-white mb-2">Process ZIP File</h4>
                          <p class="text-white/70 text-sm mb-4">
                            Select a ZIP file containing raw video chunks downloaded from the browser version.
                          </p>
                          <v-btn variant="outlined" size="large" @click="handleProcessVideoChunksZip">
                            <v-icon class="mr-2">mdi-folder-open</v-icon>
                            Select and Process ZIP File
                          </v-btn>
                        </div>
                      </div>
                    </div>

                    <!-- Processing Instructions (Bottom) -->
                    <div class="px-4 py-3 border-t mb-4 border-white/10">
                      <div class="flex items-start gap-3">
                        <v-icon class="mt-1 text-white/70">mdi-information</v-icon>
                        <div class="flex flex-col w-full">
                          <h4 class="text-white font-medium mb-3">Processing Instructions</h4>
                          <ol class="text-white/80 text-sm space-y-2">
                            <li class="flex items-start gap-2">
                              <span class="text-white font-bold">1.</span>
                              <span>Download raw video chunks from the browser version's "Raw" tab</span>
                            </li>
                            <li class="flex items-start gap-2">
                              <span class="text-white font-bold">2.</span>
                              <span>Select the ZIP file containing the chunks</span>
                            </li>
                            <li class="flex items-start gap-2">
                              <span class="text-white font-bold">3.</span>
                              <span>Click "Process ZIP" to convert chunks to MP4 video</span>
                            </li>
                            <li class="flex items-start gap-2">
                              <span class="text-white font-bold">4.</span>
                              <span>The processed video will appear in the "Videos" tab</span>
                            </li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </v-dialog>
  <v-dialog
    v-if="showFullScreenPictureModal"
    :model-value="showFullScreenPictureModal"
    :persistent="false"
    @update:model-value="showFullScreenPictureModal = $event"
    @keydown.left.prevent="previousPicture"
    @keydown.right.prevent="nextPicture"
  >
    <div class="flex flex-col justify-center items-center w-full h-full">
      <div class="relative inline-block">
        <img
          v-if="fullScreenPicture"
          :src="fullScreenPicture.blob ? createObjectURL(fullScreenPicture.blob) : ''"
          class="block object-contain max-w-full h-[90vh]"
          alt="Full Screen Picture"
        />
        <v-btn
          class="absolute top-2 right-2 p-1 bg-[#00000055] text-white"
          size="sm"
          icon
          @click="showFullScreenPictureModal = false"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
        <v-btn
          class="absolute top-1/2 left-2 transform -translate-y-1/2 bg-[#00000055] text-white p-2 rounded-full"
          size="sm"
          icon
          @click="previousPicture"
        >
          <v-icon>mdi-chevron-left</v-icon>
        </v-btn>
        <v-btn
          class="absolute top-1/2 right-2 transform -translate-y-1/2 bg-[#00000055] text-white p-2 rounded-full"
          size="sm"
          icon
          @click="nextPicture"
        >
          <v-icon>mdi-chevron-right</v-icon>
        </v-btn>
        <div class="absolute bottom-2 right-2 flex gap-2 z-[1000]">
          <v-btn icon class="bg-[#00000055] text-white" @click="downloadPictures(fullScreenPicture?.filename)">
            <v-icon>mdi-download</v-icon>
          </v-btn>
          <v-btn icon class="bg-[#00000055] text-white" @click="deletePictures(fullScreenPicture?.filename)">
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </div>
        <div class="absolute top-2 left-2 px-2 py-1 bg-[#00000055] rounded z-[1000]">
          <p class="text-2xl text-white">
            {{ parseDateFromTitle(fullScreenPicture?.filename as string) }}
          </p>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import * as Hammer from 'hammerjs'
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { useVideoChunkManager } from '@/composables/videoChunkManager'
import { formatBytes, formatDate, isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useSnapshotStore } from '@/stores/snapshot'
import { useVideoStore } from '@/stores/video'
import { SnapshotLibraryFile } from '@/types/snapshot'
import { VideoLibraryFile, VideoLibraryLogFile } from '@/types/video'
import { videoSubtitlesFilename, videoThumbnailFilename } from '@/utils/video'

const videoStore = useVideoStore()
const interfaceStore = useAppInterfaceStore()
const snapshotStore = useSnapshotStore()
const { openSnackbar } = useSnackbar()

const { showDialog, closeDialog } = useInteractionDialog()

// Chunk management composable
const {
  chunkGroups,
  totalChunkSize,
  isProcessingChunks,
  loadingData: chunkLoadingData,
  isProcessingZip,
  zipProcessingComplete,
  zipProcessingProgress,
  zipProcessingMessage,
  fetchChunkGroups,
  deleteChunkGroup,
  deleteAllChunks,
  downloadChunkGroup,
  processChunkGroup,
  openVideoChunksFolder,
  processVideoChunksZip,
  processAnotherZip,
} = useVideoChunkManager()

/* eslint-disable jsdoc/require-jsdoc  */
interface CustomHammerInstance {
  destroy(): void
}

interface HammerInstances {
  [key: string]: CustomHammerInstance
}

/* eslint-enable jsdoc/require-jsdoc  */
const availableVideos = ref<VideoLibraryFile[]>([])
const availableLogFiles = ref<VideoLibraryLogFile[]>([])
const isVisible = ref(true)
const selectedVideos = ref<VideoLibraryFile[]>([])
const currentTab = ref(interfaceStore.videoLibraryMode || 'videos')
const currentVideoSubTab = ref(isElectron() ? 'processed' : 'raw')

const snackbarMessage = ref('')
const isMultipleSelectionMode = ref(false)
const longPressSelected = ref(false)
const recentlyLongPressed = ref(false)
const hammerInstances = ref<HammerInstances>({})
const loadingData = ref(true)
const isPreparingDownload = ref(false)
const lastSelectedVideo = ref<VideoLibraryFile | null>(null)
const deleteButtonLoading = ref(false)
const videoBlobURL = ref<string | null>(null)
const loadingVideoBlob = ref(false)
const videoLoadError = ref(false)
const videoThumbnailURLs = reactive<Record<string, string | null>>({})
const availablePictures = ref<SnapshotLibraryFile[]>([])
const thumbUrlCache = new Map<string, string>()
const showFullScreenPictureModal = ref(false)
const fullScreenPicture = ref<SnapshotLibraryFile | null>(null)
const selectedPicSet = shallowRef<Set<string>>(new Set())
const isInstructionsExpanded = ref(false)

const selectedPictures = computed({
  get: () => [...selectedPicSet.value],
  set: (arr: string[]) => {
    selectedPicSet.value.clear()
    arr.forEach((f) => selectedPicSet.value.add(f))
  },
})

const setSelectedPics = (files: string[]): void => {
  selectedPicSet.value = new Set(files) // ← one reactive hit
}

const createObjectURL = (blob: Blob): string => URL.createObjectURL(blob)

const getVideoCardClasses = (video: VideoLibraryFile): string => {
  const isSelected = selectedVideos.value.find((v) => v.fileName === video.fileName)

  if (isSelected) {
    return 'border border-white/40 bg-white/15 hover:bg-white/20'
  } else {
    return 'border border-white/20 bg-white/5 hover:bg-white/10'
  }
}

const menuButtons = [
  { name: 'Videos', icon: 'mdi-video-outline', selected: true, disabled: false, tooltip: '' },
  { name: 'Snapshots', icon: 'mdi-image-outline', selected: false, disabled: false, tooltip: '' },
]

const videoSubTabs = [
  {
    name: 'processed',
    label: 'Processed',
    icon: 'mdi-video',
    disabled: !isElectron(),
    tooltip: isElectron() ? '' : 'Only available in standalone version',
  },
  {
    name: 'raw',
    label: 'Raw',
    icon: 'mdi-folder-multiple-outline',
    disabled: false,
    tooltip: 'Manage raw video chunks',
  },
  {
    name: 'processing',
    label: 'Processing',
    icon: 'mdi-cog-outline',
    disabled: !isElectron(),
    tooltip: isElectron() ? 'Process ZIP files with raw video chunks' : 'Only available in standalone version',
  },
]

const openVideoFolder = (): void => {
  if (isElectron() && window.electronAPI) {
    window.electronAPI?.openVideoFolder()
  } else {
    openSnackbar({
      message: 'This feature is only available in the desktop version of Cockpit.',
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  }
}

const playVideoInDefaultPlayer = (fileName: string): void => {
  if (isElectron() && window.electronAPI) {
    window.electronAPI?.openVideoFile(fileName)
  } else {
    openSnackbar({ message: 'This feature is only available in the desktop version of Cockpit.', variant: 'error' })
  }
}

const openPicInFullScreen = async (picture: SnapshotLibraryFile): Promise<void> => {
  await loadAndSetFullScreenPicture(picture)
  showFullScreenPictureModal.value = true
}

const deletePictures = async (pictureFileName?: string): Promise<void> => {
  try {
    deleteButtonLoading.value = true
    await snapshotStore.deleteSnapshotFiles(pictureFileName ? [pictureFileName] : selectedPictures.value)
    openSnackbar({
      message: 'Snapshots deleted successfully.',
      duration: 3000,
      variant: 'success',
      closeButton: true,
    })
    showFullScreenPictureModal.value = false
    deselectAllPictures()
    await fetchPictures()
  } catch (error) {
    const errorMsg = `Error deleting picture: ${(error as Error).message ?? error!.toString()}`
    console.error(errorMsg)
    openSnackbar({
      message: errorMsg,
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  } finally {
    deleteButtonLoading.value = false
  }
}

const handleDeletePictures = (picture?: SnapshotLibraryFile): void => {
  showDialog({
    variant: 'warning',
    message: `Delete ${picture ? picture.filename : selectedPictures.value.length} picture(s)?`,
    actions: [
      {
        text: 'Cancel',
        size: 'small',
        action: closeDialog,
      },
      {
        text: 'Delete',
        size: 'small',
        action: () => {
          deletePictures(picture ? picture.filename : undefined)
          closeDialog()
        },
      },
    ],
  })
}

const handleDeleteVideos = (videos: VideoLibraryFile[]): void => {
  const videoCount = videos.length
  const videoText = videoCount === 1 ? 'video' : 'videos'

  showDialog({
    variant: 'warning',
    title: `Delete ${videoCount} ${videoText}?`,
    message: 'Are you sure you want to delete the selected videos?',
    actions: [
      {
        text: 'Cancel',
        size: 'small',
        action: closeDialog,
      },
      {
        text: 'Delete',
        size: 'small',
        action: () => {
          discardVideosAndUpdateDB(videos)
          closeDialog()
        },
      },
    ],
  })
}

const downloadPictures = async (pictureFileName?: string): Promise<void> => {
  try {
    await snapshotStore.downloadFilesFromSnapshotDB(pictureFileName ? [pictureFileName] : selectedPictures.value)
    openSnackbar({
      message: 'Pictures downloaded successfully.',
      duration: 3000,
      variant: 'success',
      closeButton: true,
    })
  } catch (error) {
    const errorMsg = `Error downloading picture: ${(error as Error).message ?? error!.toString()}`
    console.error(errorMsg)
    openSnackbar({
      message: errorMsg,
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  }
}

const closeModal = (): void => {
  isVisible.value = false
  currentTab.value = 'videos'
  deselectAllVideos()
  lastSelectedVideo.value = null
  isMultipleSelectionMode.value = false
  interfaceStore.videoLibraryVisibility = false
}

// Extracts a date or any string enclosed within parentheses from a given title string
const parseDateFromTitle = (title: string): string => {
  const dateRegex = /\(([^)]+)\)/
  const dateMatch = title.match(dateRegex)
  return dateMatch ? dateMatch[1] : ''
}

/**
 * Check if any stream is currently being recorded
 * @returns {boolean} True if a recording is ongoing
 */
const isRecordingOngoing = (): boolean => {
  return Object.keys(videoStore.activeStreams).some((streamName) => {
    return videoStore.isRecording(streamName)
  })
}

// Switches between single and multiple file selection modes
const toggleSelectionMode = (): void => {
  isMultipleSelectionMode.value = !isMultipleSelectionMode.value
  if (!isMultipleSelectionMode.value) {
    deselectAllVideos()
  }
}

const togglePictureIntoSelectionArray = (filename: string): void => {
  const next = new Set(selectedPicSet.value)
  if (next.has(filename)) {
    if (next.size > 1) next.delete(filename)
  } else {
    next.add(filename)
  }
  selectedPicSet.value = next
}

const onPictureClick = (filename: string): void => {
  if (isMultipleSelectionMode.value) {
    togglePictureIntoSelectionArray(filename)
  } else {
    setSelectedPics([filename])
  }
}

const selectAllVideos = (): void => {
  selectedVideos.value = [...availableVideos.value]
  isMultipleSelectionMode.value = true
}

const deselectAllVideos = (): void => {
  isMultipleSelectionMode.value = false
  longPressSelected.value = false
  recentlyLongPressed.value = false

  if (selectedVideos.value.length > 1) {
    selectedVideos.value = [selectedVideos.value[0]]
  }
}

// Add the log files to the list of files to be downloaded/discarded
const addLogDataToFileList = (fileNames: string[]): string[] => {
  const filesWithLogData = fileNames.flatMap((fileName) => {
    const subtitleFileName = videoSubtitlesFilename(fileName)
    const subtitleExists = availableLogFiles.value.some((video) => video.fileName === subtitleFileName)
    return subtitleExists ? [fileName, subtitleFileName] : [fileName]
  })
  return filesWithLogData
}

const discardVideosAndUpdateDB = async (videos?: VideoLibraryFile[]): Promise<void> => {
  deleteButtonLoading.value = true
  const videosToDiscard = videos || selectedVideos.value
  let selectedVideoArraySize = videosToDiscard.length
  let processedVideosToDiscard: string[] = []

  await videosToDiscard.forEach((video: VideoLibraryFile) => {
    processedVideosToDiscard.push(video.fileName)
    processedVideosToDiscard.push(videoThumbnailFilename(video.fileName))
  })

  const dataLogFilesAdded = addLogDataToFileList(processedVideosToDiscard)
  await videoStore.discardProcessedFilesFromVideoDB(dataLogFilesAdded)

  snackbarMessage.value = `${selectedVideoArraySize} video(s) discarded.`
  openSnackbar({
    message: snackbarMessage.value,
    duration: 3000,
    variant: 'info',
    closeButton: true,
  })
  await fetchVideosAndLogData()
  selectedVideos.value = availableVideos.value.length > 0 ? [availableVideos.value[0]] : []
  if (availableVideos.value.length === 1) isMultipleSelectionMode.value = false
  deleteButtonLoading.value = false
}

const fetchVideosAndLogData = async (): Promise<void> => {
  loadingData.value = true
  availableVideos.value = []
  const videoFilesOperations: Promise<VideoLibraryFile>[] = []
  const logFileOperations: Promise<VideoLibraryLogFile>[] = []

  // Fetch processed videos and logs
  const keys = await videoStore.videoStorage.keys()
  for (const key of keys) {
    if (videoStore.isVideoFilename(key)) {
      let thumb: Blob | undefined = undefined
      if (!isElectron()) {
        thumb = (await videoStore.videoStorage.getItem(key)) as Blob | undefined
      } else {
        thumb = new Blob([])
      }

      // In Electron, mark WebM files as unprocessed so they get special handling
      const isProcessed = !isElectron() || !key.endsWith('.webm')

      videoFilesOperations.push(Promise.resolve({ fileName: key, isProcessed: isProcessed, thumbnail: thumb }))
      const thumbnail = await videoStore.getVideoThumbnail(key, true)
      videoThumbnailURLs[key] = thumbnail ? createObjectURL(thumbnail) : null
    }
    if (key.endsWith('.ass')) {
      logFileOperations.push(Promise.resolve({ fileName: key }))
    }
  }

  const videos = await Promise.all(videoFilesOperations)
  const logFiles = await Promise.all(logFileOperations)

  // Sort videos by filename in descending order (most recent first)
  // Video filenames typically contain timestamps, so sorting by filename will give chronological order
  availableVideos.value = videos.sort((a, b) => b.fileName.localeCompare(a.fileName))
  availableLogFiles.value = logFiles

  loadingData.value = false
}

const fetchPictures = async (): Promise<void> => {
  loadingData.value = true
  // Fetches only thumb keys for now
  const thumbKeys = (await snapshotStore.snapshotThumbStorage.keys()).filter((k) => /-thumb$/i.test(k))
  const entries: SnapshotLibraryFile[] = []
  const chunkSize = 16

  for (let i = 0; i < thumbKeys.length; i += chunkSize) {
    const batch = thumbKeys.slice(i, i + chunkSize)
    const batchEntries = await Promise.all(
      batch.map(async (thumbKey) => {
        const filename = thumbKey.replace(/-thumb$/i, '')
        const thumbBlob = (await snapshotStore.snapshotThumbStorage.getItem(thumbKey)) as Blob | null
        const entry: SnapshotLibraryFile = {
          filename,
          streamName: '',
          date: new Date(),
          url: '',
          blob: new Blob(),
          thumbnail: new Blob(),
        }
        if (thumbBlob) {
          entry.thumbnail = markRaw(thumbBlob)
          let tUrl = thumbUrlCache.get(filename)
          if (!tUrl) {
            tUrl = URL.createObjectURL(thumbBlob)
            thumbUrlCache.set(filename, tUrl)
          }
          ;(entry as any).thumbUrl = tUrl
        }
        return entry
      })
    )
    entries.push(...batchEntries)
    await nextTick()
  }
  // Sorts entries by date (on the filename) in descending order
  availablePictures.value = entries.sort((a, b) => b.filename.localeCompare(a.filename))
  loadingData.value = false
}

const loadAndSetFullScreenPicture = async (picture: SnapshotLibraryFile): Promise<void> => {
  try {
    if (picture.blob.size === 0) {
      const fullBlob = (await snapshotStore.snapshotStorage.getItem(picture.filename)) as Blob | null
      if (fullBlob) {
        picture.blob = markRaw(fullBlob)
      }
    }
    fullScreenPicture.value = picture
  } catch (e) {
    console.error('Failed to load full-size snapshot', e)
    fullScreenPicture.value = picture
  }
}

const nextPicture = async (): Promise<void> => {
  if (!fullScreenPicture.value) return
  const currentIndex = availablePictures.value.findIndex((pic) => pic.filename === fullScreenPicture.value!.filename)
  const nextIndex = (currentIndex + 1) % availablePictures.value.length
  const nextPic = availablePictures.value[nextIndex]
  await loadAndSetFullScreenPicture(nextPic)
}

const previousPicture = async (): Promise<void> => {
  if (!fullScreenPicture.value) return
  const currentIndex = availablePictures.value.findIndex((pic) => pic.filename === fullScreenPicture.value!.filename)
  const previousIndex = (currentIndex - 1 + availablePictures.value.length) % availablePictures.value.length
  const prevPic = availablePictures.value[previousIndex]
  await loadAndSetFullScreenPicture(prevPic)
}

const selectAllPictures = (): void => {
  setSelectedPics(availablePictures.value.map((p) => p.filename))
  isMultipleSelectionMode.value = true
}

const deselectAllPictures = (): void => {
  setSelectedPics([])
  isMultipleSelectionMode.value = false
}

/**
 * Handle ZIP processing with callback to refresh videos
 */
const handleProcessVideoChunksZip = async (): Promise<void> => {
  await processVideoChunksZip(fetchVideosAndLogData)
}

watch(isVisible, (newValue) => {
  if (!newValue) {
    isMultipleSelectionMode.value = false
    lastSelectedVideo.value = null
    interfaceStore.videoLibraryVisibility = false
  }
})

const loadVideoBlobIntoPlayer = async (videoFileName: string): Promise<void> => {
  if (isElectron()) return

  loadingVideoBlob.value = true
  videoLoadError.value = false

  try {
    const videoPlayer = document.getElementById(`video-player`) as HTMLVideoElement
    const videoBlob = await videoStore.videoStorage.getItem(videoFileName)

    if (videoBlob instanceof Blob && videoPlayer) {
      videoBlobURL.value = createObjectURL(videoBlob)
      videoPlayer.src = videoBlobURL.value

      // Set up load error detection
      let loadTimeout: ReturnType<typeof setTimeout>
      let hasLoaded = false

      const onCanPlay = (): void => {
        hasLoaded = true
        clearTimeout(loadTimeout)
        videoPlayer.removeEventListener('canplay', onCanPlay)
        videoPlayer.removeEventListener('error', onError)
      }

      const onError = (): void => {
        if (!hasLoaded) {
          videoLoadError.value = true
          clearTimeout(loadTimeout)
          videoPlayer.removeEventListener('canplay', onCanPlay)
          videoPlayer.removeEventListener('error', onError)
        }
      }

      videoPlayer.addEventListener('canplay', onCanPlay)
      videoPlayer.addEventListener('error', onError)

      // 3-second timeout
      loadTimeout = setTimeout(() => {
        if (!hasLoaded) {
          videoLoadError.value = true
          videoPlayer.removeEventListener('canplay', onCanPlay)
          videoPlayer.removeEventListener('error', onError)
        }
      }, 3000)

      videoPlayer.load()
    }
  } catch (error) {
    const msg = 'Error loading video blob into player'
    openSnackbar({ message: msg, duration: 3000, variant: 'error', closeButton: true })
    videoLoadError.value = true
  } finally {
    loadingVideoBlob.value = false
  }
}

const unloadVideoBlob = (): void => {
  if (!videoBlobURL.value) return
  URL.revokeObjectURL(videoBlobURL.value)
  videoBlobURL.value = null
  videoLoadError.value = false
}

watch(
  selectedVideos,
  async (newVal) => {
    if (newVal.length === 1) {
      lastSelectedVideo.value = newVal[0]
      await loadVideoBlobIntoPlayer(newVal[0].fileName)
    } else {
      unloadVideoBlob()
    }
  },
  { deep: true }
)

// Keep last processed video selected after refresh
watch(
  availableVideos,
  () => {
    if (lastSelectedVideo.value) {
      const matchedVideo = availableVideos.value.find(
        (v) => parseDateFromTitle(v.fileName) === parseDateFromTitle(lastSelectedVideo.value!.fileName)
      )
      if (matchedVideo) {
        selectedVideos.value = [matchedVideo]
      }
    } else {
      selectedVideos.value = availableVideos.value.length > 0 ? [availableVideos.value[0]] : []
    }
  },
  { deep: true }
)

watch(isVisible, () => {
  if (isVisible.value) return
  lastSelectedVideo.value = null
})

watch(currentTab, async (newTab) => {
  if (newTab === 'raw') {
    await fetchChunkGroups()
  }
})

watch(currentVideoSubTab, async (newSubTab) => {
  if (newSubTab === 'processed') {
    await fetchVideosAndLogData()
  } else if (newSubTab === 'raw') {
    await fetchChunkGroups()
  }
})

// Gestures library (hammer.js) for video selection
watch(
  [availableVideos, currentVideoSubTab],
  async () => {
    await nextTick()
    availableVideos.value.forEach((video) => {
      const videoThumbnailElement = document.getElementById(`video-library-thumbnail-${video.fileName}`)
      if (videoThumbnailElement) {
        hammerInstances.value[video.fileName]?.destroy()

        const hammerManager = new Hammer.Manager(videoThumbnailElement)
        hammerManager.add(new Hammer.Tap())
        hammerManager.add(new Hammer.Press({ time: 500 }))

        hammerManager.on('tap', (ev) => {
          const isAlreadySelected = selectedVideos.value.some((v) => v.fileName === video.fileName)
          const shouldToggleSelection = isMultipleSelectionMode.value || ev.srcEvent.ctrlKey || ev.srcEvent.metaKey

          if (shouldToggleSelection) {
            isMultipleSelectionMode.value = true

            const index = selectedVideos.value.findIndex((v) => v.fileName === video.fileName)
            if (index > -1) {
              if (selectedVideos.value.length > 1) {
                selectedVideos.value.splice(index, 1)
              }
            } else {
              selectedVideos.value.push(video)
            }
          } else {
            // Always update selection for single selection mode to ensure visual feedback
            selectedVideos.value = [video]
          }

          if (selectedVideos.value.length === 1 && isAlreadySelected) {
            const videoPlayer = document.getElementById(`video-player`) as HTMLVideoElement
            if (videoPlayer) {
              videoPlayer.load()
              videoPlayer.play().catch((e: Error) => console.error('Error auto-playing video:', e))
            }
          }
        })

        hammerManager.on('press', () => {
          isMultipleSelectionMode.value = true
          if (!selectedVideos.value.some((v) => v.fileName === video.fileName)) {
            selectedVideos.value.push(video)
          }
        })

        hammerInstances.value[video.fileName] = hammerManager
      }
    })
  },
  { immediate: true, deep: true }
)

onMounted(async () => {
  await fetchVideosAndLogData()
  await fetchPictures()
  await fetchChunkGroups()
  if (availableVideos.value.length > 0) {
    await loadVideoBlobIntoPlayer(availableVideos.value[0].fileName)
  }
})

onBeforeUnmount(() => {
  currentTab.value = 'videos'
  // Properly destroy Hammer instances
  Object.values(hammerInstances.value).forEach((instance) => {
    instance.destroy()
  })
  interfaceStore.videoLibraryVisibility = false
  availablePictures.value.forEach((pic) => pic.url && URL.revokeObjectURL(pic.url))
  unloadVideoBlob()
  for (const url of thumbUrlCache.values()) URL.revokeObjectURL(url)
  thumbUrlCache.clear()
})
</script>

<style scoped>
.dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  --v-overlay-opacity: 0.1;
  z-index: 100;
}

.dialog-frame {
  display: flex;
}

.video-modal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 860px;
  height: 650px;
  min-width: 600px;
  max-width: 90%;
  border: 1px solid #cbcbcb33;
  border-radius: 12px;
  box-shadow: 0px 4px 4px 0px #0000004c, 0px 8px 12px 6px #00000026;
  z-index: 100;
}

.modal-content {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  height: 100%;
  color: #ffffff;
  z-index: 200;
}

.card-grid {
  width: 100%;
  height: 372px;
  overflow-y: auto;
  overflow-x: hidden;
  display: grid;
  justify-content: center;
  align-content: start;
  grid-template-columns: repeat(3, 200px);
  row-gap: 15px;
  column-gap: 10px;
  padding: 5px;
}

.video-card {
  border: 1px solid #cbcbcb44;
  color: white;
  background-color: #80808085;
  width: 190px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-card-dot {
  position: absolute;
  bottom: 0;
  right: 5px;
}

.frosted-button {
  display: flex;
  justify-content: center;
  align-items: center;
  /* background-color: #4f4f4f88; */
  background: rgba(203, 203, 203, 0.3);
  box-shadow: -1px -1px 1px rgba(255, 255, 255, 0.3), 1px 1px 2px rgba(0, 0, 0, 0.15);
  transition: background-color 0.2s ease;
}

.frosted-button-disabled {
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(203, 203, 203, 0.1);
  color: rgba(203, 203, 203, 0.5);
  box-shadow: -1px -1px 1px rgba(255, 255, 255, 0.3), 1px 1px 2px rgba(0, 0, 0, 0.15);
}

.frosted-button:hover {
  background: rgba(203, 203, 203, 0.5);
}

.frosted-button-disabled:hover {
  background: rgba(203, 203, 203, 0.1);
}

.play-button {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.1;
}

.play-button:hover {
  opacity: 0.8;
  transition: all;
  transition-duration: 0.4s;
}

.fullscreen-button {
  position: absolute;
  display: flex;
  justify-content: end;
  align-items: end;
  top: 32px;
  right: 65px;
  border-radius: 6px;
  background: #00000044;
  cursor: pointer;
  opacity: 0.8;
}

.fullscreen-button:hover {
  background: #00000055;
  opacity: 1;
  transition: all;
  transition-duration: 0.4s;
}

.download-button {
  position: absolute;
  display: flex;
  justify-content: end;
  align-items: end;
  top: 75px;
  right: 3%;
  padding: 3px;
  border-radius: 8px;
  background: #00000044;
  cursor: pointer;
  opacity: 0.8;
}

.download-button:hover {
  background: #00000055;
  opacity: 1;
  transition: all;
  transition-duration: 0.4s;
}

.delete-button {
  position: absolute;
  display: flex;
  justify-content: end;
  align-items: end;
  top: 5%;
  right: 3%;
  padding: 3px;
  padding-bottom: 4px;
  border-radius: 8px;
  background: #00000044;
  cursor: pointer;
  opacity: 0.8;
}

.delete-button:hover {
  background: #00000055;
  color: red;
  opacity: 1;
  transition: all;
  transition-duration: 0.4s;
}

.process-button {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #4f4f4fee;
  top: 40%;
  left: 60%;
  cursor: pointer;
  opacity: 0.9;
}

.processing-bar {
  position: relative;
  height: 0px;
  width: 632px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  bottom: 365px;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.9;
}

.checkmark-button {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 10px;
  width: 15px;
  height: 15px;
  top: 15px;
  left: 15px;
  transform: translate(-50%, -50%);
  border: 1px solid black;
  cursor: pointer;
  opacity: 1;
}

@keyframes flash {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes wobble {
  0% {
    transform: scale(0);
  }
  10% {
    transform: scale(0.4);
  }
  20% {
    transform: scale(0.8);
  }
  30% {
    transform: scale(1.2);
  }
  40% {
    transform: scale(0.95);
  }
  50% {
    transform: scale(1.2);
  }
  60% {
    transform: scale(0.98);
  }
  70% {
    transform: scale(1.1);
  }
  80% {
    transform: scale(0.99);
  }
  90% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

.wobble-effect {
  animation: wobble 1s 1;
}

@media (max-width: 640px) {
  .modal {
    width: 90%;
    height: 500px;
  }
}

@media (min-width: 768px) {
  .modal {
    width: 95%;
    height: 500px;
  }
}

@media (min-width: 1024px) {
  .modal {
    width: 1200px;
    height: 500px;
  }
}
</style>
