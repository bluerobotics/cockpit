<template>
  <div
    v-if="editMode"
    class="flex fixed top-[5vh] 2xl:left-[22.5vw] xl:left-[21.5vw] left-[20.7vw] bg-[#334a5755] border-[1px] border-[#ffffff25] text-[#FFFFFF] backdrop-blur-lg elevation-5 pr-4 rounded-full cursor-pointer hover:brightness-125 2xl:scale-90 xl:scale-75 scale-[60%]"
    @click="() => emit('update:editMode', false)"
  >
    <v-btn icon="mdi-close" size="54" class="bg-[#334a5755] text-[#FFFFFFCC] text-[28px] rounded-full elevation-5" />
    <div class="ml-2 mt-[7px] text-[26px]">Exit</div>
  </div>
  <div v-if="editMode" class="flex fixed top-0 left-0 h-[100vh] w-[22vw] bg-[#031C2B]" />
  <div
    class="relative flex flex-col justify-start overflow-y-auto text-white edit-panel left-panel h-full"
    :class="{ active: editMode }"
  >
    <div class="flex justify-between items-center w-full bg-[#CBCBCB2A] relative">
      <img
        :src="pickVehicleImage(store.currentProfile.name)"
        alt="current-vehicle"
        class="ml-2 my-1 p-1 mr-2 2xl:w-[60px] xl:w-[50px] w-[40px] aspect-square"
      />
      <div ref="dropdownMenuRef" class="flex justify-between items-center relative">
        <div class="flex text-start 2xl:w-[260px] xl:w-[220px] w-[170px]">
          <v-btn
            id="profile"
            variant="text"
            :size="interfaceStore.is2xl ? 'x-large' : 'large'"
            class="2xl:w-[260px] xl:w-[220px] w-[170px]"
            :class="isDialOpen ? 'bg-[#49697c] p-3 border-b-2 border-[#041e2e55]' : 'bg-[#273842]'"
            @click="toggleDial"
          >
            <span
              class="wrapclass text-none 2xl:text-xl xl:text-[16px] lg:text-md text-sm 2xl:max-w-[230px] xl:max-w-[180px] max-w-[160px]"
              >{{ store.currentProfile.name }} {{ store.currentProfile.name.endsWith('profile') ? '' : 'profile' }}
            </span>
          </v-btn>
        </div>
        <div
          v-if="isDialOpen"
          class="absolute flex justify-start flex-col top-full -mt-[1px] bg-transparent backdrop-blur-2xl z-10"
        >
          <div
            v-for="profile in store.savedProfiles.filter((p) => p.hash !== store.currentProfile.hash)"
            :key="profile.hash"
            variant="text"
            size="x-large"
            class="bg-[#FFFFFF33] 2xl:w-[280px] xl:w-[240px] w-[210px] p-3 text-white mb-[1px] border-[1px] border-[#FFFFFF11] text-none flex-nowrap rounded-sm hover:brightness-90 cursor-pointer"
            @click="
              () => {
                store.loadProfile(profile)
                toggleDial()
                isViewsPanelExpanded = false
              }
            "
          >
            <div class="flex">
              <img
                :src="pickVehicleImage(profile.name)"
                alt="current-vehicle"
                class="mr-3 2xl:w-[30px] w-[25px] 2xl:h-[30px] h-[25px] aspect-square"
              />
              <span
                class="text-nowrap wrapclass text-left 2xl:max-w-[270px] xl:max-w-[240px] lg:max-w-[150px] max-w-[120px] mt-[1px] 2xl:text-[18px] xl:text-[18px] text-[16px]"
                >{{ profile.name }} {{ profile.name.endsWith('profile') ? '' : 'profile' }}
              </span>
            </div>
          </div>
        </div>
        <v-btn
          id="select-profile"
          size="20px"
          class="bg-transparent 2xl:text-xl xl:text-md text-sm"
          variant="text"
          @click="toggleDial"
          ><v-icon class="-mt-[1px]">mdi-menu-down</v-icon></v-btn
        >
      </div>
      <div class="flex justify-end items-center 2xl:w-[75px] xl:w-[60px] w-[55px]">
        <v-menu offset-y theme="dark">
          <template #activator="{ props: buttonProps }">
            <v-btn
              icon="mdi-dots-vertical"
              size="xs"
              variant="text"
              class="2xl:text-lg xl:text-md text-sm 2xl:mr-[6px] xl:mr-[5px] mr-[2px] 2xl:mb-[5px] xl:mb-[2px] mb-[2px]"
              v-bind="buttonProps"
            />
          </template>
          <v-list>
            <div class="flex justify-center max-w-[250px] px-2 gap-x-[5px] pb-2">
              <p class="whitespace-nowrap">Settings -</p>
              <p class="overflow-hidden text-ellipsis whitespace-nowrap">{{ store.currentProfile.name }}</p>
            </div>

            <v-divider />
            <v-list-item class="hover:bg-white/[0.04]">
              <label class="flex w-full h-full cursor-pointer justify-between">
                <v-list-item-title>Import</v-list-item-title>
                <input type="file" accept="application/json" hidden @change="(e: Event) => store.importProfile(e)" />
                <v-icon size="20">mdi-upload</v-icon>
              </label>
            </v-list-item>
            <v-list-item @click="store.exportProfile(store.currentProfile)">
              <div class="flex w-full justify-between">
                <v-list-item-title>Export</v-list-item-title>
                <v-icon size="20">mdi-download</v-icon>
              </div>
            </v-list-item>
            <v-list-item @click="store.duplicateProfile(store.currentProfile)">
              <div class="flex w-full justify-between">
                <v-list-item-title>Duplicate</v-list-item-title>
                <v-icon size="20">mdi-content-copy</v-icon>
              </div>
            </v-list-item>
            <v-list-item @click="renameProfile(store.currentProfile)">
              <div class="flex w-full justify-between">
                <v-list-item-title>Config & rename</v-list-item-title>
                <v-icon size="20">mdi-cog</v-icon>
              </div>
            </v-list-item>
            <v-list-item @click="confirmDelete">
              <div class="flex w-full justify-between">
                <v-list-item-title>Delete</v-list-item-title>
                <v-icon size="20">mdi-trash-can</v-icon>
              </div>
            </v-list-item>
            <v-divider class="mb-1" />
            <div class="flex justify-center max-w-[250px] px-2 gap-x-[5px] pb-2 pt-1">
              <p class="whitespace-nowrap">General profile settings</p>
            </div>
            <v-divider class="mb-1" />
            <v-list-item @click="addNewProfile">
              <div class="flex w-full justify-between mt-[6px]">
                <v-list-item-title>Add new profile</v-list-item-title>
                <v-icon size="22">mdi-plus</v-icon>
              </div>
            </v-list-item>
            <v-list-item @click="store.snapToGrid = !store.snapToGrid">
              <div class="flex w-full justify-between mt-[6px]">
                <v-list-item-title>{{ store.snapToGrid ? 'Disable grid' : 'Enable grid' }}</v-list-item-title>
                <v-icon size="22">{{ store.snapToGrid ? 'mdi-grid' : 'mdi-grid-off' }}</v-icon>
              </div>
            </v-list-item>
            <v-list-item @click="resetSavedProfiles">
              <div class="flex w-full justify-between mt-[6px]">
                <v-list-item-title class="mr-6">Reset saved profiles</v-list-item-title>
                <v-icon size="20" class="mt-[2px]">mdi-reload</v-icon>
              </div>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </div>
    <v-divider class="opacity-20" />
    <div
      class="flex flex-row justify-start relative items-center bg-[#CBCBCB2A] elevation-5 2xl:h-full xl:h-[45px] h-[35px] overflow-hidden"
    >
      <v-icon
        size="sm"
        :icon="isViewsPanelExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        class="ml-1 mr-[6px] 2xl:text-[26px] xl:text-[24px] text-[20px]"
        @click="toggleViewsPanel"
      />
      <v-divider vertical />
      <v-btn-toggle theme="dark" tile divided>
        <v-btn
          v-for="view in store.currentProfile.views"
          :key="view.hash"
          size="sm"
          :class="view === store.currentView ? 'bg-[#3B78A8]' : 'bg-transparent'"
          class="wrapclass 2xl:w-[129px] xl:w-[108px] lg:w-[84px] 2xl:h-[85px] xl:h-[75px] lg:h-[65px] 2xl:text-[16px] xl:text-[14px] text-[11px] text-none overflow-x-hidden"
          @click="selectView(view)"
        >
          <span class="wrapclass 2xl:max-w-[119px] xl:max-w-[100px] lg:max-w-[80px]">{{ view.name }}</span>
        </v-btn>
      </v-btn-toggle>
      <v-badge
        v-if="store.currentProfile.views.length > 3"
        :content="`+${store.currentProfile.views.length - 3}`"
        color="#ad1f83"
        overlap
        class="absolute right-4 top-[9px] mr-0 elevation-4 cursor-pointer elevation-3 scale-[85%]"
        @click="toggleViewsPanel"
      />
    </div>
    <div
      :key="forceUpdate"
      ref="content"
      class="bg-[#041e2e99] h-full"
      :class="['content-expand-collapse', { expanding: isViewsPanelExpanded, collapsing: !isViewsPanelExpanded }]"
    >
      <div class="h-full pt-1 bg-[#041e2e99]">
        <div class="flex justify-center w-full bg-[#CBCBCB09]">
          <div class="flex w-[350px] justify-center py-[2px]">
            <p class="overflow-hidden text-[12px] text-ellipsis whitespace-nowrap opacity-60">
              Views on {{ store.currentProfile.name }}
            </p>
          </div>
        </div>
        <div
          v-for="view in store.currentProfile.views"
          :key="view.hash"
          class="flex items-center justify-center border-[1px] border-[#FFFFFF24] rounded-md mx-2 my-[3px] 2xl:p-1 pl-1 pr-[2px] py-[2px] cursor-pointer"
          :class="view === store.currentView ? 'bg-[#CBCBCB64]' : 'bg-[#CBCBCB2A]'"
          @click="store.selectView(view)"
        >
          <p class="overflow-hidden text-sm text-ellipsis ml-3 whitespace-nowrap">{{ view.name }}</p>
          <div class="grow" />
          <div
            class="icon-btn mdi mdi-eye"
            :class="{ 'mdi-eye-closed': !view.visible }"
            @click.stop="toggleViewVisibility(view)"
          />
          <div class="icon-btn mdi mdi-download" @click.stop="store.exportView(view)" />
          <div class="icon-btn mdi mdi-content-copy" @click.stop="store.duplicateView(view)" />
          <div class="icon-btn mdi mdi-cog" @click.stop="renameView(view)" />
          <div class="icon-btn mdi mdi-trash-can" @click.stop="store.deleteView(view)" />
        </div>
        <div ref="managementContainer" class="flex items-end justify-end w-full gap-x-2 mt-2 mb-2 -ml-3 opacity-80">
          <v-icon size="18" icon="mdi-plus-circle" @click="addNewView" />
          <div>
            <label class="flex items-center justify-center w-full h-full cursor-pointer">
              <input type="file" accept="application/json" hidden @change="(e: Event) => store.importView(e)" />
              <v-icon size="18" icon="mdi-upload" class />
            </label>
          </div>
        </div>
      </div>
    </div>
    <v-divider />
    <div id="view-widgets-list" class="overflow-y-scroll h-full">
      <div class="flex justify-center w-full bg-[#CBCBCB09]">
        <div class="flex 2xl:max-w-[400px] xl:max-w-[330px] lg:max-w-[260px] justify-center 2xl:py-2 py-1 text-md">
          <p class="overflow-hidden 2xl:text-sm text-xs text-ellipsis whitespace-nowrap opacity-60">
            Widgets in {{ store.currentView.name }}
          </p>
        </div>
      </div>
      <ExpansiblePanel
        :key="forceUpdate"
        :compact="interfaceStore.isLg || interfaceStore.isOnSmallScreen ? true : false"
        invert-chevron
        hover-effect
        elevation-effect
        no-bottom-divider
        :is-expanded="store.currentView.widgets.length > 0"
      >
        <template #title>
          <div
            class="flex w-[90%] justify-between items-center 2xl:text-[18px] xl:text-[16px] lg:text-[14px] -mb-3 font-normal ml-2"
          >
            Main view area
            <v-badge
              :content="store.currentView.widgets.length"
              color="#3B78A8"
              rounded="md"
              class="ml-10 2xl:mb-1 opacity-90"
              :class="interfaceStore.isLg || interfaceStore.isOnSmallScreen ? 'scale-75' : ''"
            />
          </div>
        </template>
        <template #content>
          <VueDraggable
            v-model="store.currentView.widgets"
            class="flex flex-col items-center w-full 2xl:px-2 px-0 overflow-x-hidden overflow-y-auto grow my-1"
            :animation="150"
            group="regularWidgetsGroup"
          >
            <TransitionGroup name="fade">
              <div
                v-for="widget in store.currentView.widgets"
                :key="widget.hash"
                class="flex items-center justify-between w-full"
              >
                <div
                  class="flex items-center justify-center w-full border-[1px] border-[#FFFFFF15] rounded-md 2xl:mx-2 xl:mx-1 my-[3px] 2xl:p-1 pl-1 pr-[2px] py-[2px] cursor-pointer"
                  :class="store.widgetManagerVars(widget.hash).highlighted ? 'bg-[#CBCBCB64]' : 'bg-[#CBCBCB2A]'"
                  @mouseover="store.widgetManagerVars(widget.hash).highlighted = true"
                  @mouseleave="store.widgetManagerVars(widget.hash).highlighted = false"
                >
                  <v-icon
                    icon="mdi-drag"
                    class="cursor-grab mr-1 -ml-[1px] opacity-40 2xl:text-[24px] xl:text-[22px] text-[18px]"
                  />
                  <v-divider vertical />
                  <p class="ml-3 overflow-hidden 2xl:text-sm text-xs text-ellipsis whitespace-nowrap">
                    {{ widget.name }}
                  </p>
                  <div class="grow" />
                  <v-divider vertical class="opacity-10 mr-[2px]" />
                  <div
                    class="icon-btn mdi mdi-fullscreen"
                    :class="{ 'mdi-fullscreen-exit': store.isFullScreen(widget) }"
                    @click="store.toggleFullScreen(widget)"
                  />
                  <div
                    class="icon-btn mdi mdi-cog"
                    @click="store.widgetManagerVars(widget.hash).configMenuOpen = true"
                  />
                  <div class="icon-btn mdi mdi-trash-can" @click="store.deleteWidget(widget)" />
                </div>
              </div>
            </TransitionGroup>
          </VueDraggable>
        </template>
      </ExpansiblePanel>
      <ExpansiblePanel
        :compact="interfaceStore.isLg || interfaceStore.isOnSmallScreen ? true : false"
        invert-chevron
        hover-effect
        elevation-effect
        no-bottom-divider
        :is-expanded="store.miniWidgetContainersInCurrentView.length > 0"
      >
        <template #title>
          <div
            class="flex w-[90%] justify-between items-center 2xl:text-[18px] xl:text-[16px] lg:text-[14px] -mb-3 font-normal ml-2"
          >
            Top Bar
            <v-badge
              :content="
                store.miniWidgetContainersInCurrentView.reduce((count, container) => {
                  return count + (container.name.startsWith('Top') ? container.widgets.length : 0)
                }, 0)
              "
              color="#3B78A8"
              rounded="md"
              class="ml-10 2xl:mb-1 opacity-90"
              :class="interfaceStore.isLg || interfaceStore.isOnSmallScreen ? 'scale-75' : ''"
            />
          </div>
        </template>
        <template #content>
          <div
            v-for="miniWidgetContainer in store.miniWidgetContainersInCurrentView"
            :key="miniWidgetContainer.name"
            class="w-full mb-1"
          >
            <div v-if="miniWidgetContainer.name.startsWith('Top')">
              <span class="w-full px-1 2xl:text-sm text-xs text-left select-none text-slate-400">{{
                miniWidgetContainer.name
              }}</span>
              <div class="flex flex-col items-center w-full 2xl:px-3 overflow-x-hidden grow">
                <TransitionGroup name="fade">
                  <div v-if="miniWidgetContainer.widgets.isEmpty()" class="flex items-center justify-between w-full">
                    ---
                  </div>
                  <div
                    v-for="widget in miniWidgetContainer.widgets"
                    :key="widget.hash"
                    class="flex items-center justify-center w-full border-[1px] border-[#FFFFFF15] rounded-md 2xl:mx-2 my-[3px] 2xl:p-1 pl-1 pr-[2px] py-[2px] cursor-pointer"
                    :class="store.miniWidgetManagerVars(widget.hash).highlighted ? 'bg-[#CBCBCB64]' : 'bg-[#CBCBCB2A]'"
                    @mouseover="store.miniWidgetManagerVars(widget.hash).highlighted = true"
                    @mouseleave="store.miniWidgetManagerVars(widget.hash).highlighted = false"
                  >
                    <div class="flex items-center justify-start w-full overflow-auto">
                      <p class="overflow-hidden select-none text-ellipsis whitespace-nowrap 2xl:text-sm text-xs ml-3">
                        {{ widget.name || widget.component }}
                      </p>
                    </div>
                    <v-divider vertical class="opacity-10 mr-1" />
                    <div
                      class="icon-btn mdi mdi-cog"
                      @click="store.miniWidgetManagerVars(widget.hash).configMenuOpen = true"
                    />
                    <div class="icon-btn mdi mdi-trash-can" @click="store.deleteMiniWidget(widget)" />
                  </div>
                </TransitionGroup>
              </div>
            </div>
          </div>
        </template>
      </ExpansiblePanel>
      <ExpansiblePanel
        :compact="interfaceStore.isLg || interfaceStore.isOnSmallScreen ? true : false"
        invert-chevron
        hover-effect
        elevation-effect
        :is-expanded="store.miniWidgetContainersInCurrentView.length > 0"
      >
        <template #title>
          <div
            class="flex w-[90%] justify-between items-center 2xl:text-[18px] xl:text-[16px] lg:text-[14px] -mb-3 font-normal ml-2"
          >
            Bottom Bar
            <v-badge
              :content="
                store.miniWidgetContainersInCurrentView.reduce((count, container) => {
                  return count + (container.name.startsWith('Bottom') ? container.widgets.length : 0)
                }, 0)
              "
              color="#3B78A8"
              rounded="md"
              class="ml-10 2xl:mb-1 opacity-90"
              :class="interfaceStore.isLg || interfaceStore.isOnSmallScreen ? 'scale-75' : ''"
            />
          </div>
        </template>
        <template #content>
          <div
            v-for="miniWidgetContainer in store.miniWidgetContainersInCurrentView"
            :key="miniWidgetContainer.name"
            class="w-full overflow-y-auto mb-1"
          >
            <div v-if="miniWidgetContainer.name.startsWith('Bottom')">
              <span class="w-full px-1 2xl:text-sm text-xs text-left select-none text-slate-400">{{
                miniWidgetContainer.name
              }}</span>
              <div class="flex flex-col items-center w-full 2xl:px-3 overflow-x-hidden grow">
                <TransitionGroup name="fade">
                  <div
                    v-if="miniWidgetContainer.widgets.isEmpty()"
                    class="flex items-center justify-between w-full my-1"
                  >
                    ---
                  </div>
                  <div
                    v-for="widget in miniWidgetContainer.widgets"
                    :key="widget.hash"
                    class="flex items-center justify-center w-full border-[1px] border-[#FFFFFF15] rounded-md mx-2 my-[3px] 2xl:p-1 pl-1 pr-[2px] py-[2px] cursor-pointer"
                    :class="store.miniWidgetManagerVars(widget.hash).highlighted ? 'bg-[#CBCBCB64]' : 'bg-[#CBCBCB2A]'"
                    @mouseover="store.miniWidgetManagerVars(widget.hash).highlighted = true"
                    @mouseleave="store.miniWidgetManagerVars(widget.hash).highlighted = false"
                  >
                    <div class="flex items-center justify-start w-full overflow-auto">
                      <p class="overflow-hidden select-none text-ellipsis whitespace-nowrap 2xl:text-sm text-xs ml-3">
                        {{ widget.name || widget.component }}
                      </p>
                    </div>
                    <v-divider vertical class="opacity-10 mr-1" />
                    <div
                      class="icon-btn mdi mdi-cog"
                      @click="store.miniWidgetManagerVars(widget.hash).configMenuOpen = true"
                    />
                    <div class="icon-btn mdi mdi-trash-can" @click="store.deleteMiniWidget(widget)" />
                  </div>
                </TransitionGroup>
              </div>
            </div>
          </div>
        </template>
      </ExpansiblePanel>
    </div>
  </div>
  <div class="flex items-center justify-between edit-panel bottom-panel" :class="{ active: editMode }">
    <div class="w-px h-full bg-[#FFFFFF18]" />
    <div
      class="flex flex-col justify-between items-center 2xl:w-[30%] w-[25%] max-w-[240px] h-full text-white 2xl:pr-2 px-1 2xl:py-5 xl:py-4 lg:py-1"
    >
      <div>
        <p class="2xl:text-md text-xs ml-1">Widget type:</p>
        <v-select
          v-model="widgetMode"
          theme="dark"
          variant="filled"
          density="compact"
          :items="['Regular', 'Mini']"
          class="bg-[#27384255] 2xl:scale-100 scale-[80%]"
          hide-details
          @change="widgetMode = $event"
        />
      </div>
      <div class="flex flex-col items-center justify-start w-full pl-2">
        <div v-show="widgetMode === 'Regular'" class="w-[90%] 2xl:text-[16px] text-xs text-center mt-6">
          To be placed on the main view area
        </div>
        <div
          v-show="widgetMode === 'Regular widgets'"
          class="2xl:text-md text-sm mt-3 2xl:px-3 px-2 bg-[#3B78A8] rounded-lg"
        >
          Click or drag to add
        </div>
        <div v-show="widgetMode === 'Mini'" class="w-[90%] 2xl:text-[16px] text-xs text-center mt-6">
          To be placed on the top and bottom bars
        </div>
        <div v-show="widgetMode === 'Mini'" class="2xl:text-md text-sm mt-3 2xl:px-3 px-2 rounded-lg">
          (Drag card in place to add)
        </div>
      </div>
    </div>
    <div class="w-px h-full mr-3 bg-[#FFFFFF18]" />
    <div
      v-show="widgetMode === 'Regular'"
      ref="availableWidgetsContainer"
      class="flex items-center justify-between w-full h-full gap-3 overflow-x-auto text-white -mb-1 pr-2 cursor-pointer"
    >
      <div
        v-for="widgetType in availableWidgetTypes"
        :key="widgetType"
        class="flex flex-col items-center justify-between rounded-md bg-[#273842] hover:brightness-125 h-[90%] aspect-square cursor-pointer elevation-4"
        draggable="true"
        @dragstart="onRegularWidgetDragStart"
        @dragend="onRegularWidgetDragEnd(widgetType)"
      >
        <v-tooltip text="Click or drag to add" location="top" theme="light">
          <template #activator="{ props: tooltipProps }">
            <div />
            <img
              v-bind="tooltipProps"
              :src="widgetImages[widgetType]"
              alt="widget-icon"
              class="p-4 max-h-[75%] max-w-[95%]"
            />
            <div
              class="flex items-center justify-center w-full p-1 transition-all bg-[#3B78A8] rounded-b-md text-white"
            >
              <span class="whitespace-normal text-center">{{
                widgetType.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (str) => str.toUpperCase()) ||
                'Very Generic Indicator'
              }}</span>
            </div>
          </template>
        </v-tooltip>
      </div>
    </div>
    <div
      v-show="widgetMode === 'Mini'"
      ref="availableMiniWidgetsContainer"
      class="flex items-center w-full h-full gap-3 overflow-auto pr-2"
    >
      <div
        v-for="miniWidget in availableMiniWidgetTypes"
        id="mini-widget-card"
        :ref="(el) => (miniWidgetContainers[miniWidget.component] = el as HTMLElement)"
        :key="miniWidget.hash"
        class="flex flex-col items-center justify-between w-full rounded-md bg-[#273842] hover:brightness-125 h-[90%] aspect-square cursor-pointer elevation-4 overflow-clip pointer-events-none"
        :draggable="false"
      >
        <div />
        <div id="draggable-mini-widget" class="m-2 pointer-events-auto select-auto cursor-grab" :draggable="true">
          <div class="flex justify-center pointer-events-none min-w-[160px]">
            <MiniWidgetInstantiator :mini-widget="miniWidget" />
          </div>
        </div>
        <div class="flex items-center justify-center w-full p-1 transition-all bg-[#3B78A8] rounded-b-md text-white">
          <span class="whitespace-normal text-center">{{
            miniWidget.name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (str) => str.toUpperCase()) ||
            'Very Generic Indicator'
          }}</span>
        </div>
      </div>
    </div>
  </div>
  <teleport to="body">
    <GlassModal :is-visible="viewRenameDialogRevealed" class="rounded-lg">
      <v-card class="bg-transparent text-white w-[36rem] pt-6 px-4 pb-2">
        <v-card-text>
          <p>New view name</p>
          <v-text-field v-model="newViewName" counter="25" variant="filled" />
          <v-switch
            v-model="store.currentView.showBottomBarOnBoot"
            label="Show bottom bar on boot"
            class="mt-2 mx-2"
            :color="store.currentView.showBottomBarOnBoot ? 'white' : undefined"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions class="flex justify-between pt-3">
          <v-btn @click="viewRenameDialog.cancel">Cancel</v-btn>
          <v-btn @click="viewRenameDialog.confirm">Save</v-btn>
        </v-card-actions>
      </v-card>
    </GlassModal>
  </teleport>
  <teleport to="body">
    <GlassModal :is-visible="profileConfigDialogRevealed" class="rounded-lg">
      <v-card class="bg-transparent text-white w-[36rem] pt-6 px-4 pb-2">
        <v-card-text>
          <p>New profile name</p>
          <v-text-field v-model="newProfileName" counter="25" variant="filled" density="compact" />
          <p>Vehicle types that use this profile by default:</p>
          <v-combobox
            v-model="vehicleTypesAssignedToCurrentProfile"
            :items="availableVehicleTypes"
            chips
            density="compact"
            multiple
            theme="dark"
            variant="filled"
            class="w-3/4"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions class="flex justify-between pt-3">
          <v-btn @click="profileConfigDialog.cancel">Cancel</v-btn>
          <v-btn @click="profileConfigDialog.confirm">Save</v-btn>
        </v-card-actions>
      </v-card>
    </GlassModal>
  </teleport>
</template>

<script setup lang="ts">
import { onClickOutside, useConfirmDialog } from '@vueuse/core'
import { v4 as uuid } from 'uuid'
import { computed, onMounted, ref, toRefs, watch } from 'vue'
import { nextTick } from 'vue'
import { type UseDraggableOptions, useDraggable, VueDraggable } from 'vue-draggable-plus'

import { defaultMiniWidgetManagerVars } from '@/assets/defaults'
import BoatThumb from '@/assets/vehicles/BlueBoat_thumb.png'
import BlueRoboticsLogo from '@/assets/vehicles/BlueRoboticsLogo.png'
import RovThumb from '@/assets/vehicles/BlueROV_thumb.png'
import AttitudeImg from '@/assets/widgets/Attitude.png'
import CompassImg from '@/assets/widgets/Compass.png'
import CompassHUDImg from '@/assets/widgets/CompassHUD.png'
import DepthHUDImg from '@/assets/widgets/DepthHUD.png'
import IFrameImg from '@/assets/widgets/IFrame.png'
import ImageViewImg from '@/assets/widgets/ImageView.png'
import MapImg from '@/assets/widgets/Map.png'
import MiniWidgetsBarImg from '@/assets/widgets/MiniWidgetsBar.png'
import URLVideoPlayerImg from '@/assets/widgets/URLVideoPlayer.png'
import VideoPlayerImg from '@/assets/widgets/VideoPlayer.png'
import VirtualHorizonImg from '@/assets/widgets/VirtualHorizon.png'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { isHorizontalScroll } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import { type Profile, type View, type Widget, MiniWidgetType, WidgetType } from '@/types/widgets'

import ExpansiblePanel from './ExpansiblePanel.vue'
import GlassModal from './GlassModal.vue'
import MiniWidgetInstantiator from './MiniWidgetInstantiator.vue'

const { showDialog, closeDialog } = useInteractionDialog()

const interfaceStore = useAppInterfaceStore()
const store = useWidgetManagerStore()

const trashList = ref<Widget[]>([])
watch(trashList, () => {
  nextTick(() => (trashList.value = []))
})

const isDialOpen = ref(false)

const toggleDial = (): void => {
  isDialOpen.value = !isDialOpen.value
}

const forceUpdate = ref(0)

watch(
  () => store.currentView.widgets,
  () => {
    forceUpdate.value++
  },
  { deep: true }
)

const props = defineProps<{
  /**
   * Whether or not the interface is in edit mode
   */
  editMode: boolean
}>()

const emit = defineEmits<{
  (e: 'update:editMode', editMode: boolean): void
}>()

const availableWidgetTypes = computed(() => Object.values(WidgetType))
const availableMiniWidgetTypes = computed(() =>
  Object.values(MiniWidgetType).map((widgetType) => ({
    component: widgetType,
    name: widgetType,
    options: {},
    hash: uuid(),
    managerVars: defaultMiniWidgetManagerVars,
  }))
)

const widgetImages = {
  Attitude: AttitudeImg,
  Compass: CompassImg,
  DepthHUD: DepthHUDImg,
  CompassHUD: CompassHUDImg,
  IFrame: IFrameImg,
  ImageView: ImageViewImg,
  Map: MapImg,
  MiniWidgetsBar: MiniWidgetsBarImg,
  URLVideoPlayer: URLVideoPlayerImg,
  VideoPlayer: VideoPlayerImg,
  VirtualHorizon: VirtualHorizonImg,
}

const selectView = (view: View): void => {
  if (view === store.currentView) {
    toggleViewsPanel()
    return
  }
  store.selectView(view)
}

const confirmDelete = async (): Promise<void> => {
  showDialog({
    maxWidth: '500px',
    message: 'Permanently delete profile?',
    actions: [
      {
        text: 'cancel',
        action: () => closeDialog(),
      },
      {
        text: 'delete',
        action: () => {
          store.deleteProfile(store.currentProfile)
          closeDialog()
        },
      },
    ],
    variant: 'warning',
  }).then((result) => {
    if (result.isConfirmed) store.deleteProfile(store.currentProfile)
  })
}

const pickVehicleImage = (profileName: string): string => {
  const name = profileName.toLowerCase()
  if (name.includes('rov')) return RovThumb
  if (name.includes('boat')) return BoatThumb
  return BlueRoboticsLogo
}

const currentImage = ref('')

watch(
  () => store.currentProfile.name,
  (newName) => {
    currentImage.value = pickVehicleImage(newName)
  },
  { immediate: true }
)

const isViewsPanelExpanded = ref(false)
const toggleViewsPanel = (): void => {
  isViewsPanelExpanded.value = !isViewsPanelExpanded.value
}

const content = ref<HTMLElement | null>(null)

watch(isViewsPanelExpanded, (newValue) => {
  if (content.value) {
    if (newValue) {
      content.value.style.maxHeight = content.value.scrollHeight + 'px'
    } else {
      content.value.style.maxHeight = content.value.scrollHeight + 'px'
      setTimeout(() => {
        content.value!.style.maxHeight = '0px'
      }, 0)
    }
  }
})

onMounted(() => {
  if (content.value && !isViewsPanelExpanded.value) {
    content.value.style.maxHeight = '0px'
  }
})

const widgetAddMenuGroupOptions = {
  name: 'generalGroup',
  pull: 'clone',
  put: false,
  revertClone: false,
}

const editMode = toRefs(props).editMode

const dropdownMenuRef = ref(null)
const viewBeingRenamed = ref(store.currentView)
const newViewName = ref('')
const viewRenameDialogRevealed = ref(false)
const viewRenameDialog = useConfirmDialog(viewRenameDialogRevealed)
viewRenameDialog.onConfirm(() => {
  store.renameView(viewBeingRenamed.value, newViewName.value)
  newViewName.value = ''
})

const profileBeingConfigured = ref(store.currentProfile)
const newProfileName = ref('')
const profileConfigDialogRevealed = ref(false)
const profileConfigDialog = useConfirmDialog(profileConfigDialogRevealed)
profileConfigDialog.onConfirm(() => {
  profileBeingConfigured.value.name = newProfileName.value
  newProfileName.value = ''
})

onClickOutside(dropdownMenuRef, () => {
  isDialOpen.value = false
})

const addNewView = (): void => {
  if (!viewRenameDialogRevealed.value) {
    store.addView()
    forceUpdate.value++
    renameView(store.currentView)
  }
}

const addNewProfile = (): void => {
  store.addProfile()
  renameProfile(store.currentProfile)
}

const renameView = (view: View): void => {
  viewBeingRenamed.value = view
  newViewName.value = view.name
  viewRenameDialogRevealed.value = true
}

const toggleViewVisibility = (view: View): void => {
  if (view.visible && view === store.currentView) {
    showDialog({
      message: 'You cannot hide the current view.',
      variant: 'error',
      maxWidth: 400,
    })
    return
  }
  view.visible = !view.visible
}

const renameProfile = (profile: Profile): void => {
  profileBeingConfigured.value = profile
  newProfileName.value = profile.name
  profileConfigDialogRevealed.value = true
}

const resetSavedProfiles = (): void => {
  showDialog({
    message: 'Are you sure you want to reset your profiles to the default ones?',
    actions: [
      {
        text: 'cancel',
        action: () => {
          closeDialog()
        },
      },
      {
        text: 'reset profiles',
        action: () => {
          store.resetSavedProfiles()
          closeDialog()
        },
      },
    ],
    variant: 'warning',
  })
}

const availableWidgetsContainer = ref()
const availableMiniWidgetsContainer = ref()

// @ts-ignore: Documentation is not clear on what generic should be passed to 'UseDraggableOptions'
const miniWidgetsContainerOptions = ref<UseDraggableOptions>({
  animation: '150',
  group: widgetAddMenuGroupOptions,
  sort: false,
})
useDraggable(availableMiniWidgetsContainer, availableMiniWidgetTypes, miniWidgetsContainerOptions)

onMounted(() => {
  const widgetContainers = [availableWidgetsContainer.value, availableMiniWidgetsContainer.value]
  widgetContainers.forEach((container) => {
    container.addEventListener(
      'wheel',
      function (e: WheelEvent) {
        // In case of horizontal scroll skip the previous wheel event and let the horizontal scroll work
        if (isHorizontalScroll(e)) return

        const scrollBy = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX

        container.scrollLeft += Math.sign(scrollBy) * Math.min(Math.abs(scrollBy), 100)

        // Prevents this wheel to avoid a following scroll to happens and act simultaneously
        e.preventDefault()
      },
      { passive: false }
    )
  })
})

const widgetMode = ref('Regular' || 'Mini')

// Resize mini widgets so they fit the layout when the widget mode is set to mini widgets
const miniWidgetContainers = ref<Record<string, HTMLElement>>({})
watch(widgetMode, () => {
  if (widgetMode.value !== 'Mini widgets') return
  nextTick(() => {
    Object.values(miniWidgetContainers.value).forEach((element) => {
      if (element.scrollWidth > element.clientWidth) {
        let scale = 1
        while (element.scrollWidth > element.clientWidth) {
          scale -= 0.01
          const actualElement = element.children[1] as HTMLElement
          actualElement.style.scale = `${scale}`
        }
      }
    })
  })
})

const onRegularWidgetDragStart = (event: DragEvent): void => {
  const target = event.target as HTMLElement
  if (target) {
    target.style.opacity = '0.5'
  }
}

const onRegularWidgetDragEnd = (widgetType: WidgetType): void => {
  store.addWidget(widgetType, store.currentView)

  const widgetCards = document.querySelectorAll('[draggable="true"]')
  widgetCards.forEach((card) => {
    ;(card as HTMLElement).style.opacity = '1'
  })
}

const availableVehicleTypes = computed(() => Object.keys(MavType))

const vehicleTypesAssignedToCurrentProfile = computed({
  get() {
    return Object.keys(store.vehicleTypeProfileCorrespondency).filter((vType) => {
      // @ts-ignore: Enums in TS such
      return store.vehicleTypeProfileCorrespondency[vType] === profileBeingConfigured.value.hash
    })
  },
  set(selectedVehicleTypes: string[]) {
    availableVehicleTypes.value.forEach((vType) => {
      // @ts-ignore: Enums in TS such
      if (store.vehicleTypeProfileCorrespondency[vType] === profileBeingConfigured.value.hash) {
        // @ts-ignore: Enums in TS such
        store.vehicleTypeProfileCorrespondency[vType] = undefined
      }
      if (selectedVehicleTypes.includes(vType)) {
        // @ts-ignore: Enums in TS such
        store.vehicleTypeProfileCorrespondency[vType] = profileBeingConfigured.value.hash
      }
    })
  },
})
</script>

<style scoped>
.edit-panel {
  transition: all 0.2s;
  position: absolute;
  z-index: 60;
  background-color: #041e2e;
}
.left-panel {
  top: 0%;
  width: 22%;
  left: -22%;
}
.left-panel.active {
  left: 0%;
}
.middle-panel {
  bottom: -20%;
  left: -20%;
  height: 20%;
  width: 22%;
}
.middle-panel.active {
  bottom: 0%;
  left: 0%;
}
.bottom-panel {
  right: 0%;
  bottom: -22%;
  height: 22%;
  width: 78%;
}
.bottom-panel.active {
  bottom: 0%;
}
.v-expansion-panel {
  background-color: rgba(0, 0, 0, 0);
  color: white;
}

.fade-and-suffle-move,
.fade-and-suffle-enter-active,
.fade-and-suffle-leave-active,
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0, 0.1, 1);
}
.fade-and-suffle-enter-from,
.fade-enter-from,
.fade-and-suffle-leave-to,
.fade-leave-to {
  opacity: 0;
  transform: scaleY(0.01) translate(30px, 0);
}

.sortable-ghost {
  cursor: grabbing;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.5rem;
  aspect-ratio: 1;
  font-size: 0.875rem;
  line-height: 1.25rem;
  margin-left: 0.25rem;
  transition: all;
  border-radius: 0.125rem;
  cursor: pointer;
  opacity: 0.8;
}
.icon-bt {
  opacity: 1;
}

.selected-view {
  @apply bg-slate-400;
}

.content-expand-collapse {
  width: 100%;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.content-expand-collapse.expanding {
  max-height: 10000px; /* Set a large enough value to cover the content */
}

.content-expand-collapse.collapsing {
  max-height: 0;
}

.linear-gradient {
  background: linear-gradient(90deg, rgba(39, 56, 66, 0) 0%, rgba(39, 56, 66, 1) 57%, rgba(39, 56, 66, 1) 100%);
}

.wrapclass {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
