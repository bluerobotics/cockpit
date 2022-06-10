<template>
  <div class="about">
    <!-- <h1>This is an about page</h1> -->
    <div ref="outerWidgetRef" class="outerWidget">
      <div ref="innerWidgetRef" class="innerWidget">
        <div ref="actualWidgetRef" class="actualWidget"></div>
        <!-- <slot ref="actualWidgetRef" class="children"></slot> -->
        <!-- <slot></slot> -->
      </div>
      <div ref="resizerRef" class="resizer">
        <!-- <v-icon :size="resizerSize">mdi-resize-bottom-right</v-icon> -->
      </div>
    </div>
  </div>
</template>

<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
.outerWidget {
  cursor: grab;
  background-color: blue;
  position: absolute;
  top: 100px;
  left: 100px;
  width: 100px;
  height: 100px;
}
.innerWidget {
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rebeccapurple;
  display: flex;
  justify-content: center;
  align-items: center;
}
.actualWidget {
  background-color: rgb(255, 48, 179);
  width: 150px;
  height: 150px;
}
.children {
  pointer-events: none;
}
.resizer {
  background-color: rgba(0, 0, 0, 0.118);
  width: 20px;
  height: 20px;
  user-select: none;
  position: absolute;
  left: 100%;
  top: 100%;
}
</style>
