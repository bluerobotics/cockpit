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
            <div class="flex flex-col flex-1 min-h-0 min-w-0 h-full">
              <div
                v-if="availablePictures.length > 0"
                class="grid gap-4 flex-1 min-h-0 overflow-y-auto w-full pt-6 px-6 content-start"
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
                      'relative w-[178px] aspect-video overflow-hidden',
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
              <div v-else class="flex flex-1 min-h-0 pt-6 items-center justify-center text-xl text-center px-6">
                {{ loadingData ? 'Loading' : 'No pictures found' }}
              </div>
              <div class="shrink-0 h-14 flex justify-between items-center px-4 border-t border-white/10">
                <div class="flex items-center gap-2">
                  <template v-if="availablePictures.length > 1">
                    <v-btn variant="text" size="small" @click="toggleSelectionMode">
                      <v-tooltip open-delay="500" activator="parent" location="bottom">
                        Select {{ isMultipleSelectionMode ? 'single' : 'multiple' }} files
                      </v-tooltip>
                      {{ isMultipleSelectionMode ? 'Single selection' : 'Multi selection' }}
                    </v-btn>
                    <v-btn
                      variant="text"
                      size="small"
                      @click="
                        selectedPicSet.size === availablePictures.length ? deselectAllPictures() : selectAllPictures()
                      "
                    >
                      <v-tooltip open-delay="500" activator="parent" location="bottom">
                        Select {{ selectedPicSet.size === availablePictures.length ? 'none' : 'all files' }}
                      </v-tooltip>
                      {{ selectedPicSet.size === availablePictures.length ? 'None' : 'All' }}
                    </v-btn>
                  </template>
                </div>
                <div class="flex items-center gap-2">
                  <template v-if="availablePictures.length > 1">
                    <v-btn
                      variant="text"
                      size="small"
                      :disabled="selectedPictures.length === 0"
                      @click="downloadPictures()"
                    >
                      Download
                    </v-btn>
                    <v-btn
                      variant="text"
                      size="small"
                      :disabled="selectedPictures.length === 0"
                      @click="handleDeletePictures()"
                    >
                      Delete
                    </v-btn>
                  </template>
                  <v-btn icon variant="text" class="mb-1" @click="openSnapshotFolder">
                    <v-tooltip open-delay="500" activator="parent" location="bottom"> Open snapshots folder </v-tooltip>
                    <v-icon>mdi-folder-open-outline</v-icon>
                  </v-btn>
                </div>
              </div>
            </div>
          </template>
          <template v-if="currentTab === 'audio'">
            <div class="flex flex-col flex-1 min-h-0 min-w-0 h-full">
              <div class="mx-5 pt-4 shrink-0">
                <div class="flex justify-between items-center mb-4">
                  <h3 class="text-lg font-medium">Voice Recordings</h3>
                  <span class="text-sm text-white/70">Captured from this computer's microphone</span>
                </div>
              </div>
              <div v-if="availableAudios.length > 0" class="flex-1 min-h-0 overflow-y-auto px-4 py-2">
                <div class="space-y-3">
                  <div
                    v-for="audio in availableAudios"
                    :key="audio.fileName"
                    class="flex items-center p-4 rounded-lg transition-colors"
                    :class="
                      selectedAudioFiles.has(audio.fileName)
                        ? 'border border-white/40 bg-white/15 hover:bg-white/20'
                        : 'border border-white/20 bg-white/5 hover:bg-white/10'
                    "
                  >
                    <div class="w-10 flex-shrink-0 flex justify-center">
                      <v-checkbox
                        :model-value="selectedAudioFiles.has(audio.fileName)"
                        density="compact"
                        hide-details
                        theme="dark"
                        @update:model-value="toggleAudioSelection(audio.fileName)"
                      />
                    </div>
                    <div class="flex-1 ml-2 min-w-0">
                      <div class="font-medium text-white">
                        {{ parseDateFromTitle(audio.fileName) || 'Voice recording' }}
                      </div>
                      <div class="text-sm text-white/70 mt-1 truncate">
                        {{ audio.fileName }}
                      </div>
                      <div class="flex items-center gap-3 text-xs text-white/60 mt-1">
                        <span v-if="audio.durationMs !== undefined">
                          <v-icon size="12" class="mr-1">mdi-timer-outline</v-icon>
                          {{ formatAudioDuration(audio.durationMs) }}
                        </span>
                        <span v-if="audio.dateStart">
                          <v-icon size="12" class="mr-1">mdi-clock-outline</v-icon>
                          {{ formatDate(audio.dateStart) }}
                        </span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 ml-3 shrink-0">
                      <audio
                        v-if="audioBlobURLs[audio.fileName]"
                        :src="audioBlobURLs[audio.fileName]"
                        controls
                        preload="metadata"
                        class="h-10"
                      />
                      <v-btn icon variant="outlined" size="small" @click.stop="downloadAudios(audio.fileName)">
                        <v-tooltip open-delay="500" activator="parent" location="bottom">Download</v-tooltip>
                        <v-icon>mdi-download</v-icon>
                      </v-btn>
                      <v-btn icon variant="outlined" size="small" @click.stop="handleDeleteAudios(audio.fileName)">
                        <v-tooltip open-delay="500" activator="parent" location="bottom">Delete</v-tooltip>
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="flex flex-1 min-h-0 items-center justify-center text-center px-4">
                <div class="max-w-md mx-auto">
                  <v-icon size="60" class="text-white/30 mb-4">mdi-microphone-off</v-icon>
                  <h4 class="text-lg font-medium text-white mb-2">
                    {{ loadingAudios ? 'Loading' : 'No voice recordings yet' }}
                  </h4>
                  <p v-if="!loadingAudios" class="text-white/70 text-sm">
                    Add the Voice Recorder mini-widget to your view and click the red dot to start recording.
                  </p>
                </div>
              </div>
              <div class="shrink-0 h-14 flex justify-between items-center px-4 border-t border-white/10">
                <div class="flex items-center gap-2">
                  <template v-if="availableAudios.length > 1">
                    <v-btn
                      variant="text"
                      size="small"
                      @click="
                        selectedAudioFiles.size === availableAudios.length ? deselectAllAudios() : selectAllAudios()
                      "
                    >
                      {{ selectedAudioFiles.size === availableAudios.length ? 'None' : 'All' }}
                    </v-btn>
                  </template>
                </div>
                <div class="flex items-center gap-2">
                  <template v-if="selectedAudioFiles.size > 0">
                    <v-btn variant="text" size="small" @click="downloadAudios()">Download</v-btn>
                    <v-btn variant="text" size="small" @click="handleDeleteAudios()">Delete</v-btn>
                  </template>
                  <v-btn v-if="isElectron()" icon variant="text" class="mb-1" @click="openAudioFolder">
                    <v-tooltip open-delay="500" activator="parent" location="bottom">Open audio folder</v-tooltip>
                    <v-icon>mdi-folder-open-outline</v-icon>
                  </v-btn>
                </div>
              </div>
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
                  <div class="flex flex-col h-full min-h-0">
                    <div class="mx-5 pt-4 shrink-0">
                      <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium">Processed Videos</h3>
                        <div class="flex items-center gap-4">
                          <span class="text-sm text-white/70">Final videos with telemetry overlay</span>
                        </div>
                      </div>
                    </div>

                    <!-- Scrollable Videos List -->
                    <div v-if="availableVideos.length > 0" class="flex-1 min-h-0 overflow-y-auto px-4 py-2">
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
                              v-if="cloudStore.isIntegrationEnabled"
                              icon
                              variant="outlined"
                              size="small"
                              :disabled="isUploadingToCloud"
                              @click.stop="startUploadToBlueOsCloud(video)"
                            >
                              <v-tooltip open-delay="500" activator="parent" location="bottom">
                                Upload to BlueOS Cloud
                              </v-tooltip>
                              <v-icon>mdi-cloud-upload-outline</v-icon>
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

                    <div v-else class="flex flex-1 min-h-0 items-center justify-center text-xl text-center px-4">
                      {{ loadingData ? 'Loading' : 'No videos on storage' }}
                    </div>

                    <!-- Fixed Bottom Controls -->
                    <div class="shrink-0 h-14 flex justify-between items-center px-4 border-t border-white/10">
                      <div class="flex items-center gap-2">
                        <template v-if="availableVideos.length > 0">
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
                        </template>
                      </div>

                      <div class="flex items-center gap-2">
                        <template v-if="availableVideos.length > 0">
                          <span v-if="selectedVideos.length > 1" class="text-sm text-white/70">
                            {{ selectedVideos.length }} videos selected
                          </span>

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
                        </template>

                        <v-btn icon variant="text" class="mb-1" @click="openVideoFolder">
                          <v-tooltip open-delay="500" activator="parent" location="bottom">
                            Open videos folder
                          </v-tooltip>
                          <v-icon>mdi-folder-open-outline</v-icon>
                        </v-btn>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Raw Tab -->
                <template v-if="currentVideoSubTab === 'raw'">
                  <div class="flex flex-col h-full min-h-0">
                    <!-- Browser: expandable instructions header -->
                    <div v-if="!isElectron()" class="px-4 pt-6 pb-3 shrink-0">
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
                                    <span>
                                      Select and process your downloaded ZIP files (large recordings are split into
                                      multiple part-zips — pick them all together, or just one and the rest will be
                                      auto-detected if they're in the same folder)
                                    </span>
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
                    <!-- Electron: simple header -->
                    <div v-else class="mx-5 pt-4 shrink-0">
                      <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium">Raw Video Chunks</h3>
                        <span class="text-sm text-white/70">Backup raw data</span>
                      </div>
                    </div>

                    <!-- Chunk groups list -->
                    <div v-if="chunkGroups.length > 0" class="flex-1 min-h-0 overflow-y-auto px-4">
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
                              v-if="isElectron()"
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
                                {{ isElectron() ? 'Download chunk group as ZIP' : 'Download chunk group' }}
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

                    <!-- Empty state -->
                    <div v-else class="flex flex-1 min-h-0 items-center justify-center text-center px-4">
                      <div class="max-w-md mx-auto">
                        <template v-if="chunkLoadingData">
                          <v-progress-circular indeterminate color="white" size="60" width="3" class="mb-4" />
                          <h4 class="text-lg font-medium text-white mb-2">Loading Video Chunks</h4>
                          <p class="text-white/70 text-sm">Counting chunks and calculating sizes...</p>
                        </template>
                        <template v-else>
                          <v-icon size="60" class="text-white/30 mb-4">mdi-folder-multiple-outline</v-icon>
                          <h4 class="text-lg font-medium text-white mb-2">
                            {{ isElectron() ? 'No Raw Chunks Found' : 'No Video Chunks Found' }}
                          </h4>
                          <p class="text-white/70 text-sm">
                            {{
                              isElectron()
                                ? 'Start recording videos to create raw chunks.'
                                : 'Start recording videos to create chunks that can be downloaded.'
                            }}
                          </p>
                        </template>
                      </div>
                    </div>

                    <!-- Footer -->
                    <div class="shrink-0 h-14 flex justify-end items-center gap-4 px-4 border-t border-white/10">
                      <span class="text-sm text-white/70">Total: {{ formatBytes(totalChunkSize) }}</span>
                      <v-btn icon variant="text" class="mb-1" :disabled="isProcessingChunks" @click="deleteAllChunks">
                        <v-tooltip open-delay="500" activator="parent" location="bottom">
                          Delete all raw chunks
                        </v-tooltip>
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>
                      <v-btn v-if="isElectron()" icon variant="text" class="mb-1" @click="openVideoChunksFolder">
                        <v-tooltip open-delay="500" activator="parent" location="bottom">
                          Open raw chunks folder
                        </v-tooltip>
                        <v-icon>mdi-folder-open-outline</v-icon>
                      </v-btn>
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
                          <span class="text-blue-200 font-medium">Processing ZIP file(s)...</span>
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
                          The ZIP file(s) have been successfully processed. The video is now available in the Videos
                          tab.
                        </div>
                        <div class="mt-4 flex gap-2">
                          <v-btn variant="outlined" size="small" @click="processAnotherZip">
                            <v-icon class="mr-2">mdi-plus</v-icon>
                            Process More ZIP Files
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
                          <h4 class="text-lg font-medium text-white mb-2">Process ZIP File(s)</h4>
                          <p class="text-white/70 text-sm mb-4">
                            Select one or more ZIP files containing raw video chunks downloaded from Cockpit Lite.
                            Recordings larger than 1GB are split into multiple part-zips — select all of them (or just
                            one and we'll auto-detect the rest in the same folder) so we can stitch every chunk into a
                            single video.
                          </p>
                          <v-btn variant="outlined" size="large" @click="handleProcessVideoChunksZip">
                            <v-icon class="mr-2">mdi-folder-open</v-icon>
                            Select and Process ZIP File(s)
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
                              <span>
                                Select all ZIP files for the recording (recordings over 1GB are split into multiple
                                part-zips). Picking a single part-zip is fine too — sibling parts in the same folder are
                                auto-detected.
                              </span>
                            </li>
                            <li class="flex items-start gap-2">
                              <span class="text-white font-bold">3.</span>
                              <span>Click "Process ZIP" to extract every part and stitch the chunks into one MP4</span>
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
  <BlueOsCloudMissionPicker
    v-model="showCloudMissionPicker"
    title="Upload video to BlueOS Cloud"
    description="Select the mission that should receive the video, or create a new one."
    confirm-label="Upload"
    :suggested-mission-name="missionStore.missionName || ''"
    @selected="onCloudMissionSelected"
  />
  <BlueOsCloudUploadProgress
    v-model="showCloudUploadProgress"
    :file-name="cloudUploadFileName"
    :mission-name="cloudUploadMissionName"
    :progress="cloudUploadProgress"
    :is-upload-finished="isCloudUploadFinished"
    :error-message="cloudUploadError"
    @cancel="cancelCloudUpload"
  />
</template>

<script setup lang="ts">
import * as Hammer from 'hammerjs'
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'

import BlueOsCloudMissionPicker from '@/components/blueos-cloud/BlueOsCloudMissionPicker.vue'
import BlueOsCloudUploadProgress from '@/components/blueos-cloud/BlueOsCloudUploadProgress.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { useVideoChunkManager } from '@/composables/videoChunkManager'
import { getPresignedUpload, uploadFileToPresignedUrl } from '@/libs/blueos-cloud/api'
import { BlueOsCloudMission } from '@/libs/blueos-cloud/types'
import { formatBytes, formatDate, isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useAudioStore } from '@/stores/audio'
import { useBlueOsCloudStore } from '@/stores/blueOsCloud'
import { useMissionStore } from '@/stores/mission'
import { useSnapshotStore } from '@/stores/snapshot'
import { useVideoStore } from '@/stores/video'
import { AudioLibraryFile } from '@/types/audio'
import { SnapshotLibraryFile } from '@/types/snapshot'
import { VideoLibraryFile, VideoLibraryLogFile } from '@/types/video'
import { videoSubtitlesFilename, videoThumbnailFilename } from '@/utils/video'

const videoStore = useVideoStore()
const interfaceStore = useAppInterfaceStore()
const snapshotStore = useSnapshotStore()
const audioStore = useAudioStore()
const cloudStore = useBlueOsCloudStore()
const missionStore = useMissionStore()
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
const showHelpTooltip = ref(false)

const availableAudios = ref<AudioLibraryFile[]>([])
const audioBlobURLs = reactive<Record<string, string>>({})
const loadingAudios = ref(false)
const selectedAudioFiles = shallowRef<Set<string>>(new Set())

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
  { name: 'Audio', icon: 'mdi-microphone-message', selected: false, disabled: false, tooltip: '' },
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

const openElectronFolder = (opener: () => void): void => {
  if (isElectron() && window.electronAPI) {
    opener()
  } else {
    openSnackbar({
      message: 'This feature is only available in the desktop version of Cockpit.',
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  }
}

const openVideoFolder = (): void => openElectronFolder(() => window.electronAPI?.openVideoFolder())
const openSnapshotFolder = (): void => openElectronFolder(() => window.electronAPI?.openSnapshotFolder())

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
  const snapshotKeys = await snapshotStore.snapshotStorage.keys()
  const thumbKeysSet = new Set(await snapshotStore.snapshotThumbStorage.keys())
  const entries: SnapshotLibraryFile[] = []
  const chunkSize = 16

  for (let i = 0; i < snapshotKeys.length; i += chunkSize) {
    const batch = snapshotKeys.slice(i, i + chunkSize)
    const batchEntries = await Promise.all(
      batch.map(async (filename) => {
        const thumbKey = filename + '-thumb'
        let thumbBlob = thumbKeysSet.has(thumbKey)
          ? ((await snapshotStore.snapshotThumbStorage.getItem(thumbKey)) as Blob | null)
          : null

        // Legacy workspace snapshots (captured before thumbnail generation was added) exist in
        // snapshotStorage but have no corresponding thumbnail. Generate and persist one so they
        // appear in the library and don't need to be regenerated on future loads.
        if (!thumbBlob) {
          const fullBlob = (await snapshotStore.snapshotStorage.getItem(filename)) as Blob | null
          if (fullBlob) {
            try {
              thumbBlob = await snapshotStore.createThumbnail(fullBlob, 200, 113)
              await snapshotStore.snapshotThumbStorage.setItem(thumbKey, thumbBlob)
            } catch (err) {
              console.error(`Failed to create thumbnail for "${filename}"`, err)
            }
          }
        }

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

const revokeAudioBlobURL = (fileName: string): void => {
  const url = audioBlobURLs[fileName]
  if (!url) return
  URL.revokeObjectURL(url)
  delete audioBlobURLs[fileName]
}

const revokeAllAudioBlobURLs = (): void => {
  Object.keys(audioBlobURLs).forEach(revokeAudioBlobURL)
}

const fetchAudios = async (): Promise<void> => {
  loadingAudios.value = true
  try {
    const recordings = await audioStore.listAudioRecordings()
    revokeAllAudioBlobURLs()

    for (const recording of recordings) {
      const blob = (await audioStore.audioStorage.getItem(recording.fileName)) as Blob | null | undefined
      if (blob instanceof Blob) {
        audioBlobURLs[recording.fileName] = URL.createObjectURL(blob)
      }
    }

    availableAudios.value = recordings
  } catch (error) {
    console.error('Failed to fetch audio recordings:', error)
  } finally {
    loadingAudios.value = false
  }
}

const toggleAudioSelection = (fileName: string): void => {
  const next = new Set(selectedAudioFiles.value)
  if (next.has(fileName)) {
    next.delete(fileName)
  } else {
    next.add(fileName)
  }
  selectedAudioFiles.value = next
}

const selectAllAudios = (): void => {
  selectedAudioFiles.value = new Set(availableAudios.value.map((a) => a.fileName))
}

const deselectAllAudios = (): void => {
  selectedAudioFiles.value = new Set()
}

const formatAudioDuration = (durationMs?: number): string => {
  if (durationMs === undefined || isNaN(durationMs)) return ''
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

const downloadAudios = async (fileName?: string): Promise<void> => {
  const targets = fileName ? [fileName] : [...selectedAudioFiles.value]
  if (targets.length === 0) return
  try {
    await audioStore.downloadAudioFiles(targets)
    openSnackbar({
      message: 'Audio recordings downloaded successfully.',
      duration: 3000,
      variant: 'success',
      closeButton: true,
    })
  } catch (error) {
    const errorMsg = `Error downloading audio: ${(error as Error).message ?? error!.toString()}`
    console.error(errorMsg)
    openSnackbar({ message: errorMsg, duration: 3000, variant: 'error', closeButton: true })
  }
}

const performDeleteAudios = async (fileNames: string[]): Promise<void> => {
  try {
    await audioStore.deleteAudioFiles(fileNames)
    fileNames.forEach(revokeAudioBlobURL)
    openSnackbar({
      message: 'Audio recordings deleted successfully.',
      duration: 3000,
      variant: 'success',
      closeButton: true,
    })
    deselectAllAudios()
    await fetchAudios()
  } catch (error) {
    const errorMsg = `Error deleting audio: ${(error as Error).message ?? error!.toString()}`
    console.error(errorMsg)
    openSnackbar({ message: errorMsg, duration: 3000, variant: 'error', closeButton: true })
  }
}

const handleDeleteAudios = (fileName?: string): void => {
  const targets = fileName ? [fileName] : [...selectedAudioFiles.value]
  if (targets.length === 0) return

  showDialog({
    variant: 'warning',
    message: `Delete ${targets.length} audio recording(s)?`,
    actions: [
      { text: 'Cancel', size: 'small', action: closeDialog },
      {
        text: 'Delete',
        size: 'small',
        action: () => {
          performDeleteAudios(targets)
          closeDialog()
        },
      },
    ],
  })
}

const openAudioFolder = (): void => openElectronFolder(() => window.electronAPI?.openAudioFolder())

/**
 * Handle ZIP processing with callback to refresh videos
 */
const handleProcessVideoChunksZip = async (): Promise<void> => {
  await processVideoChunksZip(fetchVideosAndLogData)
}

const showCloudMissionPicker = ref(false)
const showCloudUploadProgress = ref(false)
const cloudUploadFileName = ref('')
const cloudUploadMissionName = ref('')
const cloudUploadProgress = ref(0)
const isCloudUploadFinished = ref(false)
const isUploadingToCloud = ref(false)
const cloudUploadError = ref<string | null>(null)
const pendingCloudUploadVideo = ref<VideoLibraryFile | null>(null)
let cloudUploadAbortController: AbortController | null = null

const startUploadToBlueOsCloud = (video: VideoLibraryFile): void => {
  if (!cloudStore.isAuthenticated) {
    openSnackbar({
      message: 'Sign in to BlueOS Cloud first to upload videos.',
      variant: 'warning',
      duration: 4000,
      closeButton: true,
    })
    return
  }
  pendingCloudUploadVideo.value = video
  showCloudMissionPicker.value = true
}

const onCloudMissionSelected = async (mission: BlueOsCloudMission): Promise<void> => {
  const video = pendingCloudUploadVideo.value
  if (!video) return
  await uploadVideoToBlueOsCloud(video, mission)
}

const cancelCloudUpload = (): void => {
  cloudUploadAbortController?.abort()
}

const uploadVideoToBlueOsCloud = async (video: VideoLibraryFile, mission: BlueOsCloudMission): Promise<void> => {
  cloudUploadFileName.value = video.fileName
  cloudUploadMissionName.value = mission.title
  cloudUploadProgress.value = 0
  isCloudUploadFinished.value = false
  cloudUploadError.value = null
  isUploadingToCloud.value = true
  showCloudUploadProgress.value = true
  cloudUploadAbortController = new AbortController()

  try {
    const blob = (await videoStore.videoStorage.getItem(video.fileName)) as Blob | null | undefined
    if (!blob) throw new Error('Could not read video file from local storage.')

    const accessToken = await cloudStore.ensureValidAccessToken()
    const presigned = await getPresignedUpload(mission.id, video.fileName, accessToken)
    await uploadFileToPresignedUrl(
      presigned,
      blob,
      video.fileName,
      (progress) => (cloudUploadProgress.value = progress),
      cloudUploadAbortController.signal
    )
    isCloudUploadFinished.value = true
    cloudUploadProgress.value = 100
    openSnackbar({
      message: `"${video.fileName}" uploaded to BlueOS Cloud mission "${mission.title}".`,
      variant: 'success',
      duration: 4000,
      closeButton: true,
    })
  } catch (error) {
    cloudUploadError.value = (error as Error).message
    openSnackbar({
      message: `Failed to upload video to BlueOS Cloud: ${(error as Error).message}`,
      variant: 'error',
      duration: 5000,
      closeButton: true,
    })
  } finally {
    isUploadingToCloud.value = false
    pendingCloudUploadVideo.value = null
    cloudUploadAbortController = null
  }
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
  if (newTab === 'audio') {
    await fetchAudios()
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
  await fetchAudios()
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
  revokeAllAudioBlobURLs()
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
  justify-content: center;
  align-items: center;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
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
  justify-content: center;
  align-items: center;
  bottom: 4px;
  right: 4px;
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
  justify-content: center;
  align-items: center;
  top: 4px;
  right: 4px;
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
