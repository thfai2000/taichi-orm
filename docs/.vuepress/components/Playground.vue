<template>
    <iframe
    frameborder="1"
    width="100%"
    height="500px"
    :src="`//unpkg.com/javascript-playgrounds@^1.0.0/public/index.html${hashString}`"
    >
    </iframe>
</template>

<script setup lang="ts">
// import { onMounted, onUpdated, onUnmounted } from 'vue'
import { computed } from 'vue'

const props = defineProps({
  parameters: {
    type: Object,
    default: () => ({})
  }
})

const hashString = computed(
    () => '#data=' + encodeURIComponent(JSON.stringify(props.parameters))
)
</script>
