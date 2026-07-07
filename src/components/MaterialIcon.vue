<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    fill?: boolean
    label?: string
    name: string
    size?: number | string
    weight?: number
  }>(),
  {
    fill: false,
    label: undefined,
    size: 20,
    weight: 500,
  },
)

const iconSize = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
const opticalSize = computed(() => (typeof props.size === 'number' ? props.size : 24))
const iconStyle = computed(() => ({
  fontSize: iconSize.value,
  fontVariationSettings: `'FILL' ${props.fill ? 1 : 0}, 'wght' ${props.weight}, 'GRAD' 0, 'opsz' ${opticalSize.value}`,
}))
</script>

<template>
  <span
    class="material-symbols-rounded material-icon inline-block shrink-0 align-middle leading-none"
    :aria-hidden="label ? undefined : true"
    :aria-label="label"
    :style="iconStyle"
  >
    {{ name }}
  </span>
</template>
