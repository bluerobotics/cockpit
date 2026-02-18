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
    <div :key="forceUpdate" class="bg-[#041e2e99]">
      <div class="pt-1 bg-[#041e2e99] pb-2">
        <div class="flex justify-center w-full bg-[#CBCBCB09] relative">
          <div class="flex 2xl:max-w-[400px] xl:max-w-[330px] lg:max-w-[260px] justify-center 2xl:py-2 py-1 text-md">
            <p class="overflow-hidden 2xl:text-sm text-xs text-ellipsis whitespace-nowrap opacity-60">Views</p>
          </div>
          <v-menu offset-y theme="dark">
            <template #activator="{ props: buttonProps }">
              <v-btn
                icon="mdi-dots-vertical"
                size="xs"
                variant="text"
                class="text-sm absolute right-1 top-1/2 -translate-y-1/2"
                v-bind="buttonProps"
              />
            </template>
            <v-list>
              <v-list-item class="hover:bg-white/[0.04]">
                <label class="flex w-full h-full cursor-pointer justify-between">
                  <v-list-item-title>Import views</v-list-item-title>
                  <input
                    type="file"
                    accept="application/json"
                    hidden
                    @change="(e: Event) => store.importViewsGroup(e)"
                  />
                  <v-icon size="20">mdi-upload</v-icon>
                </label>
              </v-list-item>
              <v-list-item @click="store.exportViewsGroup(store.currentProfile)">
                <div class="flex w-full justify-between">
                  <v-list-item-title>Export views</v-list-item-title>
                  <v-icon size="20">mdi-download</v-icon>
                </div>
              </v-list-item>
              <v-list-item @click="store.snapToGrid = !store.snapToGrid">
                <div class="flex w-full justify-between mt-[6px]">
                  <v-list-item-title>{{ store.snapToGrid ? 'Disable grid' : 'Enable grid' }}</v-list-item-title>
                  <v-icon size="22">{{ store.snapToGrid ? 'mdi-grid' : 'mdi-grid-off' }}</v-icon>
                </div>
              </v-list-item>
              <v-list-item @click="resetViewsGroup">
                <div class="flex w-full justify-between mt-[6px]">
                  <v-list-item-title class="mr-6">Reset to default</v-list-item-title>
                  <v-icon size="20" class="mt-[2px]">mdi-reload</v-icon>
                </div>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
        <VueDraggable v-model="store.currentProfile.views" :animation="150" handle=".view-drag-handle">
          <div
            v-for="view in store.currentProfile.views"
            :key="view.hash"
            class="flex items-center justify-center border-[1px] border-[#FFFFFF24] rounded-md mx-2 my-[6px] 2xl:p-1 pl-1 pr-[2px] py-[2px] cursor-pointer"
            :class="view === store.currentView ? 'bg-[#CBCBCB64]' : 'bg-[#CBCBCB2A]'"
            @click="store.selectView(view)"
          >
            <v-icon
              icon="mdi-drag"
              class="view-drag-handle cursor-grab mr-1 -ml-[1px] opacity-40 2xl:text-[24px] xl:text-[22px] text-[18px]"
            />
            <v-divider vertical />
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
        </VueDraggable>
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
    <div class="flex justify-center w-full bg-[#CBCBCB09] shrink-0">
      <div class="flex 2xl:max-w-[400px] xl:max-w-[330px] lg:max-w-[260px] justify-center 2xl:py-2 py-1 text-md">
        <p class="overflow-hidden 2xl:text-sm text-xs text-ellipsis whitespace-nowrap opacity-60">
          Widgets in {{ store.currentView.name }}
        </p>
      </div>
    </div>
    <div id="view-widgets-list" class="overflow-y-scroll h-full">
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
              color="#4FA483"
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
                    :class="{ 'opacity-20 cursor-not-allowed': !isWidgetConfigurable[widget.component as WidgetType] }"
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
              color="#4FA483"
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
                      :class="{ 'opacity-20 cursor-not-allowed': !isCogIconEnabled(widget) }"
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
              color="#4FA483"
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
                      :class="{ 'opacity-20 cursor-not-allowed': !isCogIconEnabled(widget) }"
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
        v-for="miniWidgetContainer in miniWidgetsBars"
        :key="miniWidgetContainer.name"
        :compact="interfaceStore.isLg || interfaceStore.isOnSmallScreen ? true : false"
        invert-chevron
        hover-effect
        elevation-effect
        no-top-divider
        :is-expanded="miniWidgetContainer?.widgets!.length > 0"
      >
        <template #title>
          <div
            class="flex w-[90%] justify-between items-center 2xl:text-[18px] xl:text-[16px] lg:text-[14px] -mb-3 font-normal ml-2"
          >
            {{ miniWidgetContainer.name }}
            <v-badge
              :content="miniWidgetContainer.widgets?.length"
              color="#4FA483"
              rounded="md"
              class="ml-10 2xl:mb-1 opacity-90"
              :class="interfaceStore.isLg || interfaceStore.isOnSmallScreen ? 'scale-75' : ''"
            />
          </div>
        </template>
        <template #content>
          <div class="w-full mb-1">
            <div class="flex flex-col items-center w-full 2xl:px-3 overflow-x-hidden grow">
              <TransitionGroup name="fade">
                <div v-if="miniWidgetContainer?.widgets?.isEmpty()" class="flex items-center justify-between w-full">
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
                    :class="{ 'opacity-20 cursor-not-allowed': !isCogIconEnabled(widget) }"
                    @click="store.miniWidgetManagerVars(widget.hash).configMenuOpen = true"
                  />
                  <div class="icon-btn mdi mdi-trash-can" @click="store.deleteMiniWidget(widget)" />
                </div>
              </TransitionGroup>
            </div>
          </div>
        </template>
      </ExpansiblePanel>
    </div>
  </div>
  <div class="flex items-center justify-between edit-panel bottom-panel" :class="{ active: editMode }">
    <div class="w-px h-full bg-[#FFFFFF18]" />
    <div
      class="flex flex-col justify-around items-center 2xl:w-[30%] w-[25%] max-w-[240px] h-full text-white 2xl:pr-2 px-1 2xl:py-5 xl:py-4 lg:py-1"
    >
      <div>
        <p class="2xl:text-md text-xs ml-1">Widget type:</p>
        <v-select
          v-model="widgetMode"
          theme="dark"
          variant="filled"
          density="compact"
          :items="['Regular', 'Mini', 'Input']"
          class="bg-[#27384255] 2xl:scale-100 scale-[80%]"
          hide-details
          @change="widgetMode = $event"
        />
      </div>
      <div class="flex flex-col items-center justify-start w-full pl-2">
        <div v-show="widgetMode === 'Regular'" class="w-[90%] 2xl:text-[16px] text-xs text-center mt-6">
          To be placed on the main view area
        </div>
        <div v-show="widgetMode === 'Regular'" class="text-xs mt-3 2xl:px-3 px-2 rounded-lg">(Drag card to add)</div>
        <div v-show="widgetMode === 'Mini'" class="w-[90%] 2xl:text-[16px] text-xs text-center mt-6">
          To be placed on the top and bottom bars
        </div>
        <div v-show="widgetMode === 'Mini'" class="text-xs mt-3 2xl:px-3 px-2 rounded-lg">(Drag card to add)</div>
        <div v-show="widgetMode === 'Input'">
          <v-btn
            type="flat"
            class="bg-[#FFFFFF33] text-white w-[95%]"
            @click="store.addWidget(makeNewWidget(WidgetType.CollapsibleContainer), store.currentView)"
            >Add new container
          </v-btn>
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
        v-for="widget in allAvailableWidgets"
        :key="widget.name"
        class="flex flex-col items-center justify-between rounded-md bg-[#273842] hover:brightness-125 h-[90%] aspect-square cursor-pointer elevation-4 relative"
        :class="{ 'border-2 border-[#135da3]': widget.isExternal }"
        draggable="true"
        @dragstart="(event) => onRegularWidgetDragStart(event, widget)"
        @dragend="(event) => onRegularWidgetDragEnd(widget, event)"
        @touchstart="(event) => onRegularWidgetDragStart(event, widget)"
        @touchend="(event) => onRegularWidgetDragEnd(widget, event)"
      >
        <div
          v-if="widget.isExternal"
          class="absolute top-0 left-0 bg-[#135da3] text-white text-xs px-1 py-0.5 rounded-tl-md rounded-br-md"
        >
          External
        </div>

        <v-tooltip text="Drag to add" location="top" theme="light">
          <template #activator="{ props: tooltipProps }">
            <div />
            <img v-bind="tooltipProps" :src="widget.icon" alt="widget-icon" class="p-4 max-h-[75%] max-w-[95%]" />
            <div
              class="flex items-center justify-center w-full p-1 transition-all rounded-b-md text-white"
              :class="{ 'bg-[#135da3]': widget.isExternal, 'bg-[#4fa483]': !widget.isExternal }"
            >
              <span class="whitespace-normal text-center">{{
                widget.name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (str) => str.toUpperCase())
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
        class="flex flex-col items-center w-auto justify-between rounded-md bg-[#273842] hover:brightness-125 h-[90%] cursor-pointer elevation-4 overflow-visible"
        :draggable="false"
      >
        <div />
        <div id="draggable-mini-widget" class="m-2 pointer-events-auto select-auto cursor-grab" :draggable="true">
          <div class="flex justify-center pointer-events-none min-w-[170px]">
            <MiniWidgetInstantiator :mini-widget="miniWidget" />
          </div>
        </div>
        <div
          class="flex items-center justify-center w-full py-1 px-2 transition-all bg-[#4FA483] rounded-b-md text-white"
        >
          <span class="whitespace-normal text-center">{{
            miniWidget.name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (str) => str.toUpperCase()) ||
            'Very generic indicator'
          }}</span>
        </div>
      </div>
    </div>
    <div
      v-show="widgetMode === 'Input'"
      ref="availableCustomWidgetElementsContainer"
      class="flex items-center w-full h-full gap-3 overflow-auto pr-2"
    >
      <div
        v-for="miniWidget in availableCustomWidgetElementsTypes"
        id="mini-widget-card"
        :key="miniWidget.hash"
        class="flex flex-col items-center w-full justify-between rounded-md bg-[#273842] hover:brightness-125 h-[90%] aspect-square cursor-pointer elevation-4 overflow-clip"
        draggable="false"
      >
        <div />
        <div id="draggable-mini-widget" class="m-2 pointer-events-auto select-auto cursor-grab" draggable="true">
          <div class="flex justify-center pointer-events-none min-w-[170px]">
            <MiniWidgetInstantiator :mini-widget="miniWidget" />
          </div>
        </div>
        <div
          class="flex items-center justify-center w-full py-1 px-2 transition-all bg-[#4FA483] rounded-b-md text-white"
        >
          <span class="whitespace-normal text-center">{{
            miniWidget.name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (str) => str.toUpperCase()) ||
            'Very generic indicator'
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

  <SideConfigPanel position="right" hide-button>
    <ElementConfigPanel v-if="store.elementToShowOnDrawer?.hash" />
  </SideConfigPanel>
</template>

<script setup lang="ts">
import { useConfirmDialog } from '@vueuse/core'
import { v4 as uuid } from 'uuid'
import { computed, onMounted, ref, toRefs, watch } from 'vue'
import { nextTick } from 'vue'
import { type UseDraggableOptions, useDraggable, VueDraggable } from 'vue-draggable-plus'

import { defaultMiniWidgetManagerVars } from '@/assets/defaults'
import AttitudeImg from '@/assets/widgets/Attitude.png'
import CollapsibleContainerImg from '@/assets/widgets/CollapsibleContainer.png'
import CompassImg from '@/assets/widgets/Compass.png'
import CompassHUDImg from '@/assets/widgets/CompassHUD.png'
import DepthHUDImg from '@/assets/widgets/DepthHUD.png'
import DoItYourselfImg from '@/assets/widgets/DoItYourself.png'
import IFrameImg from '@/assets/widgets/IFrame.png'
import ImageViewImg from '@/assets/widgets/ImageView.png'
import MapImg from '@/assets/widgets/Map.png'
import MiniWidgetsBarImg from '@/assets/widgets/MiniWidgetsBar.png'
import MissionControlPanelImg from '@/assets/widgets/MissionControlPanel.png'
import PlotterImg from '@/assets/widgets/Plotter.png'
import URLVideoPlayerImg from '@/assets/widgets/URLVideoPlayer.png'
import VideoPlayerImg from '@/assets/widgets/VideoPlayer.png'
import VirtualHorizonImg from '@/assets/widgets/VirtualHorizon.png'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { getWidgetsFromBlueOS } from '@/libs/blueos'
import { isHorizontalScroll } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Point2D, SizeRect2D } from '@/types/general'
import {
  type View,
  type Widget,
  CustomWidgetElementContainer,
  CustomWidgetElementType,
  ExternalWidgetSetupInfo,
  InternalWidgetSetupInfo,
  isMiniWidgetConfigurable,
  isWidgetConfigurable,
  MiniWidget,
  MiniWidgetContainer,
  MiniWidgetType,
  widgetDefaultSizes,
  WidgetType,
} from '@/types/widgets'

import ExpansiblePanel from './ExpansiblePanel.vue'
import GlassModal from './GlassModal.vue'
import ElementConfigPanel from './InputElementConfig.vue'
import MiniWidgetInstantiator from './MiniWidgetInstantiator.vue'
import SideConfigPanel from './SideConfigPanel.vue'

const { showDialog, closeDialog } = useInteractionDialog()

const interfaceStore = useAppInterfaceStore()
const store = useWidgetManagerStore()
const mainVehicleStore = useMainVehicleStore()

const miniWidgetsBars = computed(() => {
  let regularContainers = store.miniWidgetContainersInCurrentView.filter(
    (container) => !container.name.startsWith('Top') && !container.name.startsWith('Bottom')
  )
  let customContainers = getAllMiniWidgetFromCustomWidget()
  return [...regularContainers, ...customContainers]
})

const getAllMiniWidgetFromCustomWidget = (): MiniWidgetContainer[] => {
  const allCustomBases = store.currentView.widgets.filter(
    (widget) => widget.component === WidgetType.CollapsibleContainer
  )

  return allCustomBases.map((base) => {
    const baseName = base.name || 'Unnamed Custom Widget'
    const miniWidgets = base.options.elementContainers.flatMap(
      (container: CustomWidgetElementContainer) => container.elements
    )

    return {
      name: baseName,
      widgets: miniWidgets,
    }
  })
}

const trashList = ref<Widget[]>([])
watch(trashList, () => {
  nextTick(() => (trashList.value = []))
})

const forceUpdate = ref(0)

const ExternalWidgetSetupInfos = ref<ExternalWidgetSetupInfo[]>([])

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

watch(
  () => store.elementToShowOnDrawer,
  (newValue) => {
    if (newValue?.isCustomElement) interfaceStore.configPanelVisible = true
    if (!newValue) interfaceStore.configPanelVisible = false
  }
)

const isCogIconEnabled = (widget: MiniWidget): boolean => {
  return (
    Object.values(CustomWidgetElementType).includes(widget.component as unknown as CustomWidgetElementType) ||
    isMiniWidgetConfigurable[widget.component]
  )
}

const findUniqueName = (name: string): string => {
  let newName = name
  let i = 1
  const existingNames = store.currentView.widgets.map((widget) => widget.name)
  while (existingNames.includes(newName)) {
    newName = `${name} ${i}`
    i++
  }
  return newName
}
/*
 * Makes a new widget with an unique name
 */
const makeNewWidget = (widget: WidgetType, name?: string, options?: Record<string, any>): InternalWidgetSetupInfo => {
  const newName = name || widget
  return {
    name: findUniqueName(newName),
    component: widget,
    options: options || {},
    icon: widgetImages[widget] as string,
    defaultSize: widgetDefaultSizes[widget],
  }
}

const makeWidgetUnique = (widget: InternalWidgetSetupInfo): InternalWidgetSetupInfo => {
  return {
    ...widget,
    name: findUniqueName(widget.name),
  }
}

const availableInternalWidgets = computed(() =>
  Object.values(WidgetType).map((widgetType) => {
    return {
      component: widgetType,
      name: widgetType,
      icon: widgetImages[widgetType] as string,
      options: {},
      defaultSize: widgetDefaultSizes[widgetType],
    }
  })
)

const allAvailableWidgets = computed(() => {
  return [
    ...ExternalWidgetSetupInfos.value.map((widget) => ({
      component: WidgetType.IFrame,
      icon: widget.iframeIcon,
      name: widget.name,
      isExternal: true,
      options: {
        source: widget.iframeUrl,
        containerName: widget.collapsibleContainerName,
        startCollapsed: widget.startCollapsed,
        useVehicleAddressAsBase: widget.useVehicleAddressAsBaseUrl,
      },
      defaultSize: widgetDefaultSizes[WidgetType.IFrame],
    })),
    ...availableInternalWidgets.value.map((widget) => ({
      ...widget,
      isExternal: false,
    })),
  ]
})

const availableMiniWidgetTypes = computed(() =>
  Object.values(MiniWidgetType).map((widgetType) => ({
    component: widgetType,
    name: widgetType,
    options: {},
    hash: uuid(),
    managerVars: defaultMiniWidgetManagerVars,
  }))
)

const availableCustomWidgetElementsTypes = computed(() =>
  Object.values(CustomWidgetElementType).map((widgetType) => ({
    component: widgetType,
    name: widgetType,
    options: {},
    hash: uuid(),
    managerVars: defaultMiniWidgetManagerVars,
  }))
)
const widgetImages = {
  Attitude: AttitudeImg,
  CollapsibleContainer: CollapsibleContainerImg,
  Compass: CompassImg,
  CompassHUD: CompassHUDImg,
  DepthHUD: DepthHUDImg,
  DoItYourself: DoItYourselfImg,
  IFrame: IFrameImg,
  ImageView: ImageViewImg,
  Map: MapImg,
  MiniWidgetsBar: MiniWidgetsBarImg,
  MissionControlPanel: MissionControlPanelImg,
  Plotter: PlotterImg,
  URLVideoPlayer: URLVideoPlayerImg,
  VideoPlayer: VideoPlayerImg,
  VirtualHorizon: VirtualHorizonImg,
}

const widgetAddMenuGroupOptions = {
  name: 'generalGroup',
  pull: 'clone',
  put: false,
  revertClone: false,
}

const editMode = toRefs(props).editMode

const viewBeingRenamed = ref(store.currentView)
const newViewName = ref('')
const viewRenameDialogRevealed = ref(false)
const viewRenameDialog = useConfirmDialog(viewRenameDialogRevealed)
viewRenameDialog.onConfirm(() => {
  store.renameView(viewBeingRenamed.value, newViewName.value)
  newViewName.value = ''
})

const addNewView = (): void => {
  if (!viewRenameDialogRevealed.value) {
    store.addView()
    forceUpdate.value++
    renameView(store.currentView)
  }
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

const resetViewsGroup = (): void => {
  showDialog({
    message: 'Are you sure you want to reset your views to the defaults?',
    actions: [
      {
        text: 'cancel',
        action: () => {
          closeDialog()
        },
      },
      {
        text: 'reset',
        action: () => {
          store.resetViewsGroup()
          closeDialog()
        },
      },
    ],
    variant: 'warning',
  })
}

const availableWidgetsContainer = ref()
const availableMiniWidgetsContainer = ref()
const availableCustomWidgetElementsContainer = ref()

// @ts-ignore: Documentation is not clear on what generic should be passed to 'UseDraggableOptions'
const miniWidgetsContainerOptions = ref<UseDraggableOptions>({
  animation: '150',
  group: widgetAddMenuGroupOptions,
  sort: false,
})
useDraggable(availableMiniWidgetsContainer, availableMiniWidgetTypes, miniWidgetsContainerOptions)

const getExternalWidgetSetupInfos = async (): Promise<void> => {
  try {
    const vehicleAddress = await mainVehicleStore.getVehicleAddress()
    ExternalWidgetSetupInfos.value = await getWidgetsFromBlueOS(vehicleAddress)
  } catch (error) {
    const errorMessage = 'Error getting info around external widgets from BlueOS.'
    openSnackbar({ message: errorMessage, variant: 'error', closeButton: true })
  }
}

// @ts-ignore: Documentation is not clear on what generic should be passed to 'UseDraggableOptions'
const customWidgetElementContainerOptions = ref<UseDraggableOptions>({
  animation: '150',
  group: widgetAddMenuGroupOptions,
  sort: false,
})
useDraggable(
  availableCustomWidgetElementsContainer,
  availableCustomWidgetElementsTypes,
  customWidgetElementContainerOptions
)

onMounted(() => {
  getExternalWidgetSetupInfos()
  const widgetContainers = [
    availableWidgetsContainer.value,
    availableMiniWidgetsContainer.value,
    availableCustomWidgetElementsContainer.value,
  ]
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

const widgetMode = ref('Regular')

// Resize mini widgets so they fit the layout when the widget mode is set to mini widgets
const miniWidgetContainers = ref<Record<string, HTMLElement>>({})
watch(widgetMode, async (newValue: string): Promise<void> => {
  if (newValue !== 'Mini') return
  await nextTick()
  Object.values(miniWidgetContainers.value).forEach((element: HTMLElement) => {
    if (element.scrollWidth > element.clientWidth) {
      const ratio = element.clientWidth / element.scrollWidth
      const actualElement = element.children[1] as HTMLElement
      actualElement.style.transform = `scale(${ratio})`
    }
  })
})

// Cached references for performance
let cachedMainViewElement: HTMLElement | null = null
let cachedMainViewRect: DOMRect | null = null
let cachedWidgetSize: SizeRect2D | null = null
let rafId: number | null = null
let pendingPosition: Point2D | null = null

// Get the coordinates of the widget being dragged and update the drag state
const onRegularWidgetDragStart = (event: Event, widget: InternalWidgetSetupInfo): void => {
  const target = event.target as HTMLElement
  if (target) {
    target.style.opacity = '0.5'
  }

  // Cache references for performance
  cachedMainViewElement = document.querySelector('.main-view') as HTMLElement
  if (cachedMainViewElement) {
    cachedMainViewRect = cachedMainViewElement.getBoundingClientRect()
  }
  cachedWidgetSize = widget.defaultSize ?? { width: 0.2, height: 0.36 }

  store.widgetDragState = {
    widget,
    position: null,
  }

  document.addEventListener('dragover', onDragOver, { passive: false })
  document.addEventListener('touchmove', onTouchMove, { passive: true })
}

// Track drag position for ghost preview
const onDragOver = (event: DragEvent): void => {
  event.preventDefault()
  // Store position but don't update state yet - will be updated in RAF
  if (cachedMainViewElement && cachedMainViewRect) {
    pendingPosition = calculatePosition(event.clientX, event.clientY)
    scheduleUpdate()
  }
}

// Track touch move for ghost preview
const onTouchMove = (event: TouchEvent): void => {
  if (store.widgetDragState.widget && event.touches.length > 0 && cachedMainViewElement && cachedMainViewRect) {
    const touch = event.touches[0]
    pendingPosition = calculatePosition(touch.clientX, touch.clientY)
    scheduleUpdate()
  }
}

// Schedule position update using requestAnimationFrame for smooth 60fps updates
const scheduleUpdate = (): void => {
  if (rafId !== null) {
    return // Already scheduled
  }
  rafId = requestAnimationFrame(() => {
    if (pendingPosition !== null) {
      store.widgetDragState.position = pendingPosition
      pendingPosition = null
    }
    rafId = null
  })
}

// Update the drag position for ghost preview
const calculatePosition = (clientX: number, clientY: number): Point2D | null => {
  if (!cachedMainViewElement || !cachedMainViewRect || !cachedWidgetSize || !store.widgetDragState.widget) {
    return null
  }

  // Will now only recalculate if significantly different to avoid constant recalculation
  const currentRect = cachedMainViewElement.getBoundingClientRect()
  if (
    Math.abs(currentRect.left - (cachedMainViewRect?.left ?? 0)) > 1 ||
    Math.abs(currentRect.top - (cachedMainViewRect?.top ?? 0)) > 1 ||
    Math.abs(currentRect.width - (cachedMainViewRect?.width ?? 0)) > 1 ||
    Math.abs(currentRect.height - (cachedMainViewRect?.height ?? 0)) > 1
  ) {
    cachedMainViewRect = currentRect
  }

  const isWithinMainView =
    clientX >= cachedMainViewRect.left &&
    clientX <= cachedMainViewRect.right &&
    clientY >= cachedMainViewRect.top &&
    clientY <= cachedMainViewRect.bottom

  if (isWithinMainView) {
    // Calculate position relative to main-view
    const dropX = (clientX - cachedMainViewRect.left) / cachedMainViewRect.width
    const dropY = (clientY - cachedMainViewRect.top) / cachedMainViewRect.height
    // Center the widget on the drop position
    const x = Math.max(0, Math.min(1 - cachedWidgetSize.width, dropX - cachedWidgetSize.width / 2))
    const y = Math.max(0, Math.min(1 - cachedWidgetSize.height, dropY - cachedWidgetSize.height / 2))
    return { x, y }
  }

  return null
}

// Places the widget if it is within the main-view
const onRegularWidgetDragEnd = (widget: InternalWidgetSetupInfo, event: DragEvent | TouchEvent): void => {
  // Cancel any pending RAF updates
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  if (pendingPosition !== null) {
    store.widgetDragState.position = pendingPosition
    pendingPosition = null
  }

  // Remove global event listeners added in onRegularWidgetDragStart
  document.removeEventListener('dragover', onDragOver)
  document.removeEventListener('touchmove', onTouchMove)

  let clientX: number
  let clientY: number

  // Gets the coordinates the user released the widget at
  if (event instanceof TouchEvent) {
    const touch = event.changedTouches[0]
    clientX = touch.clientX
    clientY = touch.clientY
  } else {
    clientX = event.clientX
    clientY = event.clientY
  }

  // If the main-view element is not found, return the opacity of the dragged widget card to 1 (previously set to 0.5 on onRegularWidgetDragStart)
  const mainViewElement = cachedMainViewElement || (document.querySelector('.main-view') as HTMLElement)
  if (!mainViewElement) {
    const widgetCards = document.querySelectorAll('[draggable="true"]')
    widgetCards.forEach((card) => {
      ;(card as HTMLElement).style.opacity = '1'
    })
    // Clear drag and other cached references
    store.widgetDragState = { widget: null, position: null }
    cachedMainViewElement = null
    cachedMainViewRect = null
    cachedWidgetSize = null
    return
  }

  // Use cached rect if available, otherwise get it fresh
  const mainViewRect = cachedMainViewRect || mainViewElement.getBoundingClientRect()

  // Checks if the final dragged widget coordinates are within the main-view's bounding rectangle
  const isWithinMainView =
    clientX >= mainViewRect.left &&
    clientX <= mainViewRect.right &&
    clientY >= mainViewRect.top &&
    clientY <= mainViewRect.bottom

  if (isWithinMainView) {
    // Use the last tracked position if available, otherwise calculate from event
    let dropPosition: Point2D
    if (store.widgetDragState.position) {
      dropPosition = store.widgetDragState.position
    } else {
      const dropX = (clientX - mainViewRect.left) / mainViewRect.width
      const dropY = (clientY - mainViewRect.top) / mainViewRect.height
      const widgetSize = cachedWidgetSize || widget.defaultSize || { width: 0.2, height: 0.36 }
      dropPosition = {
        x: Math.max(0, Math.min(1 - widgetSize.width, dropX - widgetSize.width / 2)),
        y: Math.max(0, Math.min(1 - widgetSize.height, dropY - widgetSize.height / 2)),
      }
    }
    store.addWidget(makeWidgetUnique(widget), store.currentView, dropPosition)
  }

  const widgetCards = document.querySelectorAll('[draggable="true"]')
  widgetCards.forEach((card) => {
    ;(card as HTMLElement).style.opacity = '1'
  })

  // Again, clear drag state and cached references
  store.widgetDragState = { widget: null, position: null }
  cachedMainViewElement = null
  cachedMainViewRect = null
  cachedWidgetSize = null
}
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

.wrapclass {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
