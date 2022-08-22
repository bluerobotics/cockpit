<template>
  <video muted loop autoplay>
    <source src="@/assets/bbb.mp4" type="video/mp4" disablePictureInPicture />
    Your browser does not support the video tag.
  </video>
</template>

<style scoped>
video {
  height: 100%;
  width: 100%;
  object-fit: cover;
  position: absolute;
}
</style>
