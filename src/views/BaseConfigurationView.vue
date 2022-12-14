<template>
  <v-card class="elevation-0">
    <v-card-title class="flex-centered mt-2">
      <slot name="title"></slot>
    </v-card-title>
    <v-divider />
    <v-card-text class="flex-centered">
      <slot name="content"></slot>
    </v-card-text>
  </v-card>
</template>
