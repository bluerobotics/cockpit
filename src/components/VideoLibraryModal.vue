<template>
  <v-dialog v-model="isVisible" class="dialog">
    <div class="dialog-frame" :style="dialogStyle">
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
                          <v-icon size="10" class="text-green-500 ml-2 mb-[2px] mr-1">mdi-circle</v-icon> Processed
                          video
                        </div>
                        <div>
                          <v-icon size="10" class="text-red-500 mb-[2px] mr-1">mdi-circle</v-icon> Unprocessed video
                        </div>
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
                    <img v-if="picture.blob" :src="createObjectURL(picture.blob)" class="w-full h-full object-cover" />
                    alt="Picture thumbnail" />
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
            <!-- Available Videos -->
            <div
              v-if="availableVideos.length > 0"
              class="flex flex-col justify-between align-center pt-8 px-2 w-[300px] h-[480px]"
            >
              <div class="flex flex-col w-full h-full px-4 overflow-auto align-center">
                <div v-for="video in availableVideos" :key="video.fileName" class="mb-4 video-container">
                  <div class="relative video-wrapper">
                    <div
                      :id="`video-library-thumbnail-${video.fileName}`"
                      class="border-4 border-white rounded-md cursor-pointer border-opacity-[0.1] hover:border-opacity-[0.4] transition duration-75 hover:ease-in aspect-video"
                      :class="
                        selectedVideos.find((v) => v.fileName === video.fileName)
                          ? ['border-opacity-[0.4]', 'w-[220px]']
                          : ['border-opacity-[0.1]', 'w-[190px]']
                      "
                    >
                      <img
                        v-if="video.isProcessed && videoThumbnailURLs[video.fileName]"
                        :src="videoThumbnailURLs[video.fileName]"
                      />
                      <img
                        v-else-if="!video.isProcessed && videoThumbnailURLs[video.hash]"
                        :src="videoThumbnailURLs[video.hash]"
                      />
                      <div v-else class="w-full h-full flex justify-center items-center bg-black">
                        <v-icon size="60" class="text-white/30">mdi-video</v-icon>
                      </div>
                    </div>
                    <div
                      v-if="selectedVideos.find((v) => v.fileName === video.fileName) && !isMultipleSelectionMode"
                      class="play-button"
                      @click="video.isProcessed ? playVideo() : processSingleVideo()"
                    >
                      <v-icon size="40" class="text-white">
                        {{ video.isProcessed ? 'mdi-play-circle-outline' : 'mdi-progress-alert' }}
                      </v-icon>
                    </div>
                    <div
                      v-if="isMultipleSelectionMode"
                      class="checkmark-button"
                      :class="selectedVideos.find((v) => v.fileName === video.fileName) ? 'bg-green' : 'bg-white'"
                      @click.stop="toggleVideoIntoSelectionArray(video)"
                    >
                      <v-icon size="15" class="text-white">
                        {{
                          selectedVideos.find((v) => v.fileName === video.fileName)
                            ? 'mdi-check-circle-outline'
                            : 'mdi-radiobox-blank'
                        }}
                      </v-icon>
                    </div>
                  </div>
                  <div class="flex flex-row justify-center w-full ml-1 overflow-hidden text-xs">
                    <v-tooltip open-delay="500" activator="parent" location="top">{{
                      video.isProcessed ? 'Processed video' : 'Unprocessed video'
                    }}</v-tooltip>
                    {{ parseDateFromTitle(video.fileName) ?? 'Cockpit video' }}
                    <v-icon
                      size="10"
                      class="ml-1 mt-[3px]"
                      :class="video.isProcessed ? 'text-green-500' : 'text-red-500'"
                    >
                      mdi-circle
                    </v-icon>
                  </div>
                </div>
              </div>
              <div
                v-if="availableVideos.length > 1"
                class="flex flex-row align-center h-[45px] w-full mb-[-15px]"
                :class="
                  availableVideos.filter((video) => !video.isProcessed).length > 0 ? 'justify-between' : 'justify-start'
                "
              >
                <div>
                  <v-btn variant="text" size="small" class="mt-[5px]" @click="toggleSelectionMode">
                    <v-tooltip open-delay="500" activator="parent" location="bottom">
                      Select {{ isMultipleSelectionMode ? 'single' : 'multiple' }} files
                    </v-tooltip>
                    {{ isMultipleSelectionMode ? 'Single' : 'Multi' }}
                  </v-btn>
                </div>
                <div>
                  <v-btn
                    variant="text"
                    size="small"
                    class="mt-[5px]"
                    @click="selectedVideos.length === availableVideos.length ? deselectAllVideos() : selectAllVideos()"
                  >
                    <v-tooltip open-delay="500" activator="parent" location="bottom">
                      Select {{ selectedVideos.length === availableVideos.length ? 'none' : 'all files' }}
                    </v-tooltip>
                    {{ selectedVideos.length === availableVideos.length ? 'None' : 'All' }}
                  </v-btn>
                </div>
                <div>
                  <v-btn
                    v-if="availableVideos.filter((video) => !video.isProcessed).length > 0"
                    variant="text"
                    size="small"
                    class="mt-[5px]"
                    @click="
                      selectedVideos.every((el) => !el.isProcessed)
                        ? selectProcessedVideos()
                        : selectUnprocessedVideos()
                    "
                  >
                    <v-tooltip open-delay="500" activator="parent" location="bottom">
                      {{
                        selectedVideos.every((el) => !el.isProcessed)
                          ? 'Select all processed videos'
                          : 'Select all unprocessed videos'
                      }}
                    </v-tooltip>
                    {{ selectedVideos.every((el) => !el.isProcessed) ? 'Select Process.' : 'select Unproc.' }}
                  </v-btn>
                </div>
              </div>
            </div>

            <v-divider vertical class="h-[92%] mt-4 opacity-[0.1]"></v-divider>
            <!-- Video Player -->
            <div v-if="availableVideos.length > 0" class="flex flex-col justify-between mt-5 align-center w-[720px]">
              <div>
                <div v-if="loadingVideoBlob" class="text-center w-full aspect-video flex justify-center items-center">
                  Loading video...
                </div>
                <video
                  v-show="
                    !isMultipleSelectionMode &&
                    selectedVideos.length === 1 &&
                    !loadingData &&
                    !loadingVideoBlob &&
                    !videoLoadError &&
                    selectedVideos[0].isProcessed
                  "
                  id="video-player"
                  ref="videoPlayerRef"
                  width="660px"
                  :controls="selectedVideos[0].isProcessed ? true : false"
                  :preload="selectedVideos[0].isProcessed ? 'auto' : 'none'"
                  class="border-[14px] border-white border-opacity-10 rounded-lg min-h-[382px] aspect-video"
                ></video>
                <div
                  v-if="
                    !isMultipleSelectionMode &&
                    selectedVideos.length === 1 &&
                    !loadingData &&
                    !loadingVideoBlob &&
                    ((selectedVideos[0].isProcessed && videoLoadError) ||
                      (!selectedVideos[0].isProcessed && !videoLoadError))
                  "
                  class="w-[660px] border-[14px] border-white border-opacity-10 rounded-lg min-h-[382px] aspect-video flex justify-center items-center bg-black"
                >
                  <div v-if="videoLoadError && selectedVideos[0].isProcessed" class="text-white/70 text-center">
                    <v-icon size="60" class="text-white/30 mb-4">mdi-video</v-icon>
                    <p>This video was processed but cannot be played here.</p>
                    <p>This usually happens with videos of higher resolutions, like 4K.</p>
                    <p>Try downloading it and playing it in your computer.</p>
                  </div>
                  <v-btn
                    v-if="!videoLoadError && !selectedVideos[0].isProcessed"
                    :variant="showOnScreenProgress ? 'text' : 'outlined'"
                    color="white"
                    size="large"
                    :disabled="showOnScreenProgress"
                    class="process-button"
                    @click="processSingleVideo"
                  >
                    {{ showOnScreenProgress ? 'Processing...' : 'Process video' }}
                  </v-btn>
                </div>
                <div class="processing-bar">
                  <v-progress-linear
                    v-if="showOnScreenProgress && !showProgressInteractionDialog"
                    :model-value="errorProcessingVideos ? 100 : overallProcessingProgress"
                    :color="errorProcessingVideos ? 'red' : 'green'"
                    height="8"
                    striped
                  />
                  <div class="w-0">
                    <button
                      v-if="
                        !loadingData && selectedVideos.length === 1 && showOnScreenProgress && errorProcessingVideos
                      "
                      class="bg-red text-[#ffffffaa] flex flex-col justify-center align-center w-[20px] h-[20px] rounded-full mt-[40px] ml-[-25px]"
                      @click="showErrorTooltip = !showErrorTooltip"
                    >
                      <v-icon class="text-[18px]">mdi-alert-circle-outline</v-icon>
                      <v-tooltip
                        v-model="showErrorTooltip"
                        :open-on-hover="false"
                        activator="parent"
                        location="bottom"
                        arrow
                        content-class="border-[#ffffff55] border-2"
                        @click:outside="showErrorTooltip = false"
                      >
                        <div class="flex flex-col p-2 gap-y-2">
                          <div>{{ snackbarMessage }}</div>
                        </div>
                      </v-tooltip>
                    </button>
                  </div>
                </div>
              </div>
              <!-- Selected Videos Card Grid (Only on multiple files selected) -->
              <div
                v-if="availableVideos.length > 0 && selectedVideos.length >= 1 && isMultipleSelectionMode"
                class="flex flex-col justify-start w-full p-2 pt-3"
              >
                <div class="card-grid">
                  <v-card v-for="selectedFile in selectedVideos" :key="selectedFile.fileName" class="video-card">
                    <div>
                      <v-card-text>
                        <div class="text-sm">{{ parseDateFromTitle(selectedFile.fileName) }}</div>
                      </v-card-text>
                      <div class="video-card-dot">
                        <v-icon size="10" :class="selectedFile.isProcessed ? 'text-green-500' : 'text-red-500'">
                          mdi-circle
                        </v-icon>
                      </div>
                    </div>
                  </v-card>
                </div>
                <v-divider class="mb-[-10px] opacity-[0.1] mx-3"></v-divider>
              </div>
              <!-- Video Action Buttons -->
              <div
                v-if="availableVideos.length > 0"
                class="flex flex-row justify-between w-full h-full px-8 overflow-hidden align-center"
              >
                <div class="flex flex-row justify-between pl-2 align-center gap-x-6">
                  <div class="flex flex-row cursor-default text-md">
                    {{
                      isMultipleSelectionMode
                        ? `Files selected: ${selectedVideos.length}`
                        : parseMissionAndDateFromTitle(selectedVideos[0]?.fileName)
                    }}
                  </div>
                  <div
                    v-if="isMultipleSelectionMode"
                    class="flex flex-row w-[320px] justify-center gap-x-4 align-center ml-1"
                  >
                    <div
                      v-if="selectedVideos.every((video) => !video.isProcessed)"
                      class="text-sm text-white border-2 rounded-md mt-[3px] border-[#ffffff44] bg-[#fafafa33] ml-4 px-1"
                    >
                      <button @click="showProcessVideosWarningDialog">Process selected videos</button>
                    </div>
                  </div>
                </div>
                <div class="flex flex-row mt-2">
                  <button
                    v-for="button in fileActionButtons.filter((b) => b.show)"
                    :key="button.name"
                    class="flex flex-col justify-center ml-6 align-center"
                    :disabled="button.disabled"
                    @click="!button.confirmAction && button.action()"
                  >
                    <div
                      :class="[
                        button.disabled ? 'frosted-button-disabled' : 'frosted-button',
                        !button.confirmAction && 'p-2',
                      ]"
                      class="flex flex-col justify-center mb-1 rounded-full frosted-button align-center button"
                    >
                      <v-tooltip v-if="button.tooltip" open-delay="500" activator="parent" location="bottom">
                        {{ button.tooltip }}
                      </v-tooltip>
                      <v-menu
                        v-if="button.confirmAction"
                        location="left center"
                        opacity="0"
                        transition="slide-x-reverse-transition"
                        :disabled="button.disabled"
                      >
                        <template #activator="{ props: buttonProps, isActive }">
                          <div class="flex items-center justify-center w-full h-full" v-bind="buttonProps">
                            <v-icon
                              :size="button.size"
                              :class="{
                                'rotate-[-45deg]': isActive,
                                'outline outline-6 outline-[#ffffff55]': isActive,
                              }"
                              class="rounded-full border-[transparent]"
                              :style="{ borderWidth: `${button.size - 4}px` }"
                            >
                              {{ isActive ? 'mdi-arrow-up' : button.icon }}
                            </v-icon>
                          </div>
                        </template>
                        <v-list class="bg-transparent" elevation="0">
                          <v-list-item>
                            <template #append>
                              <div class="mb-10 slide-right-to-left">
                                <v-btn
                                  fab
                                  small
                                  width="28"
                                  height="28"
                                  color="red"
                                  icon="mdi-close"
                                  class="text-sm outline outline-3 outline-[#ffffff44] hover:outline-[#ffffff77]"
                                  ><v-tooltip open-delay="600" activator="parent" location="bottom"> Cancel </v-tooltip
                                  ><v-icon>mdi-close</v-icon></v-btn
                                >
                                <v-btn
                                  fab
                                  small
                                  width="28"
                                  height="28"
                                  color="green"
                                  icon="mdi-check"
                                  class="ml-4 text-sm outline outline-3 outline-[#ffffff44] hover:outline-[#ffffff77]"
                                  :loading="deleteButtonLoading"
                                  @click="button.action()"
                                  ><v-tooltip open-delay="600" activator="parent" location="bottom"> Confirm </v-tooltip
                                  ><v-icon>mdi-check</v-icon></v-btn
                                >
                              </div>
                            </template>
                          </v-list-item>
                        </v-list>
                      </v-menu>
                      <div v-else>
                        <v-icon :size="button.size">{{ button.icon }}</v-icon>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div
              v-if="availableVideos.length === 0"
              class="flex flex-row justify-center w-full h-full text-xl text-center align-center"
            >
              {{ loadingData ? 'Loading' : 'No videos on storage' }}
            </div>
          </template>
        </div>
      </div>
    </div>
  </v-dialog>
  <InteractionDialog
    :show-dialog="showProcessingInteractionDialog"
    :title="interactionDialogTitle"
    :actions="interactionDialogActions"
    :max-width="600"
  >
    <template #content>
      <div class="flex flex-col mb-2 text-center align-end">
        Processing multiple videos may take a while, depending on the number of videos and their sizes. Cockpit will be
        usable during the process, but the performance may be affected and recording of new videos is disabled.
      </div>
    </template>
  </InteractionDialog>
  <InteractionDialog
    :show-dialog="showProgressInteractionDialog"
    :title="progressInteractionDialogTitle"
    :actions="progressInteractionDialogActions"
    :max-width="600"
  >
    <template #content>
      <div v-if="!errorProcessingVideos" class="flex flex-col -mt-2 text-center align-center">
        <div class="flex flex-col justify-between h-[140px] w-full pb-3">
          <div v-if="currentVideoProcessingProgress.length > 0" class="flex flex-col justify-start">
            <div class="mb-3 text-sm text-center">
              File {{ currentVideoProcessingProgress.length }} of {{ numberOfFilesToProcess }}:
              {{ currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].message }}
            </div>
            <div class="flex flex-row justify-between w-full mb-2 align-center">
              <div class="text-sm font-bold w-[450px] text-nowrap text-start text-ellipsis overflow-x-hidden">
                {{ currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].fileName }}
              </div>
              <div class="text-sm text-end">
                <v-progress-circular width="1" size="10" indeterminate class="mr-1 mb-[2px]"></v-progress-circular>
                {{ `${currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].progress}%` }}
              </div>
            </div>
            <v-progress-linear
              :model-value="currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].progress"
              color="white"
              height="6"
              rounded
              striped
            ></v-progress-linear>
          </div>
          <div>
            <div class="flex flex-row justify-between w-full mb-2">
              <div class="text-sm font-bold text-start">Overall Progress</div>
              <div class="text-sm font-bold text-end">{{ `${Math.ceil(overallProcessingProgress)}%` }}</div>
            </div>
            <v-progress-linear
              :model-value="Math.ceil(overallProcessingProgress)"
              color="blue"
              height="6"
              rounded
              striped
            ></v-progress-linear>
          </div>
        </div>
      </div>
      <div v-if="errorProcessingVideos">
        <div class="flex flex-col justify-center w-full pb-3 text-center text-md">
          {{
            `Error processing video file: ${
              currentVideoProcessingProgress[currentVideoProcessingProgress.length - 1].fileName
            }`
          }}
        </div>
      </div>
    </template>
  </InteractionDialog>
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
import { useWindowSize } from '@vueuse/core'
import * as Hammer from 'hammerjs'
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { reactive, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useSnackbar } from '@/composables/snackbar'
import { isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useSnapshotStore } from '@/stores/snapshot'
import { useVideoStore } from '@/stores/video'
import { DialogActions } from '@/types/general'
import { SnapshotLibraryFile } from '@/types/snapshot'
import { VideoLibraryFile, VideoLibraryLogFile } from '@/types/video'

import InteractionDialog from './InteractionDialog.vue'

const videoStore = useVideoStore()
const interfaceStore = useAppInterfaceStore()
const snapshotStore = useSnapshotStore()
const { openSnackbar } = useSnackbar()

const { showDialog, closeDialog } = useInteractionDialog()
const { width: windowWidth } = useWindowSize()

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
const videoPlayerRef = ref<HTMLVideoElement | null>(null)
const currentTab = ref(interfaceStore.videoLibraryMode || 'videos')
const snackbarMessage = ref('')
const isMultipleSelectionMode = ref(false)
const longPressSelected = ref(false)
const recentlyLongPressed = ref(false)
const hammerInstances = ref<HammerInstances>({})
const showHelpTooltip = ref(false)
const showErrorTooltip = ref(false)
const loadingData = ref(true)
const showProcessingInteractionDialog = ref(false)
const interactionDialogTitle = ref('')
const interactionDialogActions = ref<DialogActions[]>([])
const showProgressInteractionDialog = ref(false)
const progressInteractionDialogTitle = ref('')
const progressInteractionDialogActions = ref<DialogActions[]>([])
const isProcessingVideos = ref(false)
const isPreparingDownload = ref(false)
const overallProcessingProgress = ref(0)
const currentVideoProcessingProgress = ref([{ fileName: '', progress: 0, message: '' }])
const numberOfFilesToProcess = ref(0)
const showOnScreenProgress = ref(false)
const lastSelectedVideo = ref<VideoLibraryFile | null>(null)
const errorProcessingVideos = ref(false)
const deleteButtonLoading = ref(false)
const videoBlobURL = ref<string | null>(null)
const loadingVideoBlob = ref(false)
const videoLoadError = ref(false)
const videoThumbnailURLs = reactive<Record<string, string | null>>({})
const availablePictures = ref<SnapshotLibraryFile[]>([])
const showFullScreenPictureModal = ref(false)
const fullScreenPicture = ref<SnapshotLibraryFile | null>(null)
const selectedPicSet = shallowRef<Set<string>>(new Set())

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

const dialogStyle = computed(() => {
  const scale = interfaceStore.isOnSmallScreen ? windowWidth.value / 1100 : 1
  return {
    transform: `scale(${scale * 0.98}) translate(0, 0)`,
    transformOrigin: 'center',
  }
})

const menuButtons = [
  { name: 'Videos', icon: 'mdi-video-outline', selected: true, disabled: false, tooltip: '' },
  { name: 'Snapshots', icon: 'mdi-image-outline', selected: false, disabled: false, tooltip: '' },
]

const fileActionButtons = computed(() => [
  {
    name: 'Delete',
    icon: 'mdi-delete-outline',
    size: 22,
    tooltip: '',
    confirmAction: true,
    show: true,
    disabled: showOnScreenProgress.value === true || isPreparingDownload.value === true,
    action: () => discardVideosAndUpdateDB(),
  },
  {
    name: 'Download',
    icon: 'mdi-tray-arrow-down',
    size: 28,
    tooltip: 'Download selected videos with logs',
    confirmAction: false,
    show: !isElectron(),
    disabled: showOnScreenProgress.value === true || isPreparingDownload.value === true,
    action: () => downloadVideoAndTelemetryFiles(),
  },
  {
    name: 'Open Folder',
    icon: 'mdi-folder-outline',
    size: 28,
    tooltip: 'Open videos folder',
    confirmAction: false,
    show: isElectron(),
    disabled: false,
    action: () => openVideoFolder(),
  },
])

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

const openPicInFullScreen = (picture: SnapshotLibraryFile): void => {
  fullScreenPicture.value = picture
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

// Extracts a date or any string enclosed within parentheses from a given title string
const parseMissionAndDateFromTitle = (title: string): string => {
  const titleAndDateRegex = /.*\(([^)]+)\)/
  const titleAndDateMatch = title.match(titleAndDateRegex)
  return titleAndDateMatch ? titleAndDateMatch[0] : ''
}

const playVideo = (): void => {
  if (selectedVideos.value.length === 1 && !isMultipleSelectionMode.value) {
    const videoPlayer = document.getElementById(`video-player`) as HTMLVideoElement
    if (!videoPlayer) return
    videoPlayer.play().catch((e: Error) => console.error('Error auto-playing video:', e))
  }
}

// Switches between single and multiple file selection modes
const toggleSelectionMode = (): void => {
  isMultipleSelectionMode.value = !isMultipleSelectionMode.value
  if (!isMultipleSelectionMode.value) {
    deselectAllVideos()
  }
}

const toggleVideoIntoSelectionArray = (video: VideoLibraryFile): void => {
  const index = selectedVideos.value.findIndex((v) => v.fileName === video.fileName)
  if (index !== -1) {
    if (selectedVideos.value.length > 1) {
      selectedVideos.value.splice(index, 1)
    }
  } else {
    selectedVideos.value.push(video)
    isMultipleSelectionMode.value = true
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

const resetProgressBars = (): void => {
  errorProcessingVideos.value = false
  overallProcessingProgress.value = 0
  currentVideoProcessingProgress.value = [{ fileName: '', progress: 0, message: '' }]
  showOnScreenProgress.value = false
}

const processVideos = async (): Promise<void> => {
  try {
    await videoStore.processVideoChunksAndTelemetry(selectedVideos.value.map((video) => video.hash!))
    isMultipleSelectionMode.value = false
    await fetchVideosAndLogData()
  } catch (error) {
    const errorMsg = `Video processing failed: ${(error as Error).message ?? error!.toString()}`
    console.error(errorMsg)
    snackbarMessage.value = errorMsg
    openSnackbar({
      message: errorMsg,
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
    errorProcessingVideos.value = true
  }
}

const closeProcessingDialog = (): void => {
  if (errorProcessingVideos.value) {
    fetchVideosAndLogData()
  }
  showProgressInteractionDialog.value = false
  resetProgressBars()
}

const processSingleVideo = async (): Promise<void> => {
  if (selectedVideos.value.length === 1 && !selectedVideos.value[0].isProcessed) {
    showOnScreenProgress.value = true
  }
  await processVideos()
  await loadVideoBlobIntoPlayer(selectedVideos.value[0].fileName)
}

// Process multiple videos with progress bars dialog
const processMultipleVideosDialog = async (): Promise<void> => {
  numberOfFilesToProcess.value = selectedVideos.value.length
  progressInteractionDialogTitle.value = 'Processing Videos'
  progressInteractionDialogActions.value = [
    {
      text: overallProcessingProgress.value === 100 ? 'Close' : 'Hide',
      size: 'small',
      class: 'font-light',
      action: closeProcessingDialog,
    },
  ]
  showProcessingInteractionDialog.value = false
  showProgressInteractionDialog.value = true
  await processVideos()
  await loadVideoBlobIntoPlayer(selectedVideos.value[0].fileName)
}

const showProcessVideosWarningDialog = (): void => {
  interactionDialogTitle.value = 'Process Multiple Videos'
  interactionDialogActions.value = [
    {
      text: 'Cancel',
      size: 'small',
      class: 'font-light',
      action: () => {
        showProcessingInteractionDialog.value = false
      },
    },
    {
      text: 'Process videos',
      size: 'small',
      class: 'font-bold',
      action: async () => {
        showProcessingInteractionDialog.value = false
        await processMultipleVideosDialog()
      },
    },
  ]
  showProcessingInteractionDialog.value = true
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

const selectUnprocessedVideos = (): void => {
  if (availableVideos.value.some((video) => !video.isProcessed)) {
    selectedVideos.value = availableVideos.value.filter((video) => !video.isProcessed)
    isMultipleSelectionMode.value = true
  } else {
    snackbarMessage.value = 'No unprocessed videos found'
    openSnackbar({
      message: snackbarMessage.value,
      duration: 3000,
      variant: 'info',
      closeButton: true,
    })
  }
}

const selectProcessedVideos = (): void => {
  if (availableVideos.value.some((video) => video.isProcessed)) {
    selectedVideos.value = availableVideos.value.filter((video) => video.isProcessed)
    isMultipleSelectionMode.value = true
  } else {
    snackbarMessage.value = 'No processed videos found'
    openSnackbar({
      message: snackbarMessage.value,
      duration: 3000,
      variant: 'info',
      closeButton: true,
    })
  }
}

// Add the log files to the list of files to be downloaded/discarded
const addLogDataToFileList = (fileNames: string[]): string[] => {
  const filesWithLogData = fileNames.flatMap((fileName) => {
    const filenameWithoutExtension = fileName.split('.').slice(0, -1).join('.')
    const subtitlefileName = `${filenameWithoutExtension}.ass`
    const subtitleExists = availableLogFiles.value.some((video) => video.fileName === subtitlefileName)
    return subtitleExists ? [fileName, subtitlefileName] : [fileName]
  })
  return filesWithLogData
}

const downloadVideoAndTelemetryFiles = async (): Promise<void> => {
  let initialMessageShown = false

  const fillProgressData = async (progress: number, total: number): Promise<void> => {
    const progressPercentage = ((100 * progress) / total).toFixed(1)
    if (!initialMessageShown) return
    snackbarMessage.value = `Preparing download: ${progressPercentage}%.`
    openSnackbar({
      message: snackbarMessage.value,
      duration: 15000,
      variant: 'info',
      closeButton: true,
    })
  }

  snackbarMessage.value = 'Getting your download ready...'
  setTimeout(() => (initialMessageShown = true), 1500)

  let tempProcessedVideos: string[] = []
  let tempUnprocessedVideos: string[] = []

  selectedVideos.value.forEach((video) => {
    if (video.isProcessed) tempProcessedVideos.push(video.fileName)
    if (!video.isProcessed && video.hash) tempUnprocessedVideos.push(video.hash)
  })
  openSnackbar({
    message: snackbarMessage.value,
    duration: 3000,
    variant: 'info',
    closeButton: true,
  })

  if (tempUnprocessedVideos.length > 0) {
    const confirm = await confirmDownloadOfUnprocessedVideos()
    if (!confirm) return
  }

  isPreparingDownload.value = true
  if (tempProcessedVideos.length > 0) {
    const dataLogFilesAdded = addLogDataToFileList(tempProcessedVideos)

    await videoStore.downloadFilesFromVideoDB(dataLogFilesAdded, fillProgressData)
  }
  if (tempUnprocessedVideos.length > 0) {
    await videoStore.downloadTempVideo(tempUnprocessedVideos, fillProgressData)
  }
  isPreparingDownload.value = false
}

const confirmDownloadOfUnprocessedVideos = async (): Promise<boolean> => {
  let confirmDownload = false
  const goBack = (): void => {
    confirmDownload = false
  }
  const downloadAnyway = (): void => {
    confirmDownload = true
  }
  await showDialog({
    maxWidth: 600,
    title: 'You are downloading unprocessed videos',
    message: `One or more videos that you are downloading contains unprocessed chunks, which are not playable. To be
      able to play the downloaded videos, you need to go back and process those videos first.`,
    variant: 'info',
    actions: [
      { text: 'Go back', action: goBack },
      { text: 'Download anyway', action: downloadAnyway },
    ],
  })

  closeDialog()
  return confirmDownload
}

const discardVideosAndUpdateDB = async (): Promise<void> => {
  deleteButtonLoading.value = true
  let selectedVideoArraySize = selectedVideos.value.length
  let processedVideosToDiscard: string[] = []
  let unprocessedVideosToDiscard: string[] = []

  await selectedVideos.value.forEach((video: VideoLibraryFile) => {
    if (video.isProcessed) {
      processedVideosToDiscard.push(video.fileName)
      processedVideosToDiscard.push(videoStore.videoThumbnailFilename(video.fileName))
    }
    if (!video.isProcessed && video.hash) unprocessedVideosToDiscard.push(video.hash)
  })

  if (processedVideosToDiscard.length > 0) {
    const dataLogFilesAdded = addLogDataToFileList(processedVideosToDiscard)

    await videoStore.discardProcessedFilesFromVideoDB(dataLogFilesAdded)
  }

  if (unprocessedVideosToDiscard.length > 0) {
    await videoStore.discardUnprocessedFilesFromVideoDB(unprocessedVideosToDiscard)
  }

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
      videoFilesOperations.push({ fileName: key, isProcessed: true, thumbnail: videoStore.videoStorage.getItem(key) })
      const thumbnail = await videoStore.getVideoThumbnail(key, true)
      videoThumbnailURLs[key] = thumbnail ? createObjectURL(thumbnail) : null
    }
    if (key.endsWith('.ass')) {
      logFileOperations.push({ fileName: key })
    }
  }

  // Fetch unprocessed videos
  const unprocessedVideos = await videoStore.unprocessedVideos
  const unprocessedVideoOperations = Object.entries(unprocessedVideos).map(async ([hash, videoInfo]) => {
    const thumbnail = await videoStore.getVideoThumbnail(hash, false)
    videoThumbnailURLs[hash] = thumbnail ? createObjectURL(thumbnail) : null
    return { ...videoInfo, ...{ hash: hash, isProcessed: false } }
  })

  const videos = await Promise.all(videoFilesOperations)
  const logFiles = await Promise.all(logFileOperations)
  const unprocessedVideosData = await Promise.all(unprocessedVideoOperations)

  // Filter out videos that are currently being recorded
  const validUnprocessedVideos = unprocessedVideosData.filter((video) => {
    return video.dateFinish || videoStore.keysFailedUnprocessedVideos.includes(video.hash)
  })

  availableVideos.value = [...videos, ...validUnprocessedVideos]
  availableLogFiles.value = logFiles

  loadingData.value = false
}

const fetchPictures = async (): Promise<void> => {
  loadingData.value = true
  const keys = await snapshotStore.snapshotStorage.keys()
  const pics: SnapshotLibraryFile[] = []

  for (const key of keys) {
    const blob = (await snapshotStore.snapshotStorage.getItem(key)) as Blob | null
    const entry: SnapshotLibraryFile = {
      filename: key,
      type: 'stream',
      streamName: '',
      date: new Date(),
      url: '',
      blob: new Blob(),
    }
    if (blob) {
      entry.blob = markRaw(blob)
      entry.url = URL.createObjectURL(blob)
    }
    pics.push(entry)
  }
  availablePictures.value = pics
  loadingData.value = false
}

const nextPicture = (): void => {
  if (!fullScreenPicture.value) return
  const currentIndex = availablePictures.value.findIndex((pic) => pic.filename === fullScreenPicture.value!.filename)
  const nextIndex = (currentIndex + 1) % availablePictures.value.length
  fullScreenPicture.value = availablePictures.value[nextIndex]
}

const previousPicture = (): void => {
  if (!fullScreenPicture.value) return
  const currentIndex = availablePictures.value.findIndex((pic) => pic.filename === fullScreenPicture.value!.filename)
  const previousIndex = (currentIndex - 1 + availablePictures.value.length) % availablePictures.value.length
  fullScreenPicture.value = availablePictures.value[previousIndex]
}

const selectAllPictures = (): void => {
  setSelectedPics(availablePictures.value.map((p) => p.filename))
  isMultipleSelectionMode.value = true
}

const deselectAllPictures = (): void => {
  setSelectedPics([])
  isMultipleSelectionMode.value = false
}

watch(
  () => videoStore.currentFileProgress,
  (newCurrentProgress) => {
    currentVideoProcessingProgress.value = newCurrentProgress
  },
  { deep: true }
)

watch(
  () => videoStore.overallProgress,
  (newOverallProgress) => {
    overallProcessingProgress.value = newOverallProgress
    if (newOverallProgress > 0 && newOverallProgress < 100) {
      isProcessingVideos.value = true
      showOnScreenProgress.value = true
    }
    if (newOverallProgress === 100) {
      isProcessingVideos.value = false
      showOnScreenProgress.value = false
      setTimeout(() => {
        showProgressInteractionDialog.value = false
      }, 1000)
    }
  }
)

watch(isVisible, (newValue) => {
  if (!newValue) {
    resetProgressBars()
    isMultipleSelectionMode.value = false
    lastSelectedVideo.value = null
    showOnScreenProgress.value = false
    interfaceStore.videoLibraryVisibility = false
  }
})

const loadVideoBlobIntoPlayer = async (videoFileName: string): Promise<void> => {
  loadingVideoBlob.value = true
  videoLoadError.value = false

  try {
    const videoPlayer = document.getElementById(`video-player`) as HTMLVideoElement
    const videoBlob = await videoStore.videoStorage.getItem(videoFileName)

    if (videoBlob instanceof Blob && videoPlayer) {
      videoBlobURL.value = createObjectURL(videoBlob)
      videoPlayer.src = videoBlobURL.value

      // Set up load error detection
      let loadTimeout: number
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
      if (errorProcessingVideos.value) {
        resetProgressBars()
      }
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

// Gestures library (hammer.js) for video selection
watch(
  availableVideos,
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
          } else if (!isAlreadySelected) {
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
  if (availableVideos.value.length > 0) {
    await loadVideoBlobIntoPlayer(availableVideos.value[0].fileName)
  }
  showOnScreenProgress.value = false
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
  width: 1100px;
  height: 500px;
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
